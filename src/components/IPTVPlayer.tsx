import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { 
  Play, Pause, SkipBack, SkipForward, Maximize, Minimize, 
  Volume2, VolumeX, ArrowLeft, RefreshCw, List, Radio,
  Tv, Eye, PictureInPicture
} from 'lucide-react';
import { Channel, PlayerPreferences } from '../types';

interface IPTVPlayerProps {
  channel: Channel;
  allChannels: Channel[];
  onClose: () => void;
  onNextChannel: () => void;
  onPrevChannel: () => void;
  onSelectChannel: (chan: Channel) => void;
  preferences: PlayerPreferences;
}

export default function IPTVPlayer({
  channel,
  allChannels,
  onClose,
  onNextChannel,
  onPrevChannel,
  onSelectChannel,
  preferences
}: IPTVPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  // Overlay state
  const [showControls, setShowControls] = useState(true);
  const [isChannelListOpen, setIsChannelListOpen] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [isBuffering, setIsBuffering] = useState(false);
  const [isPiP, setIsPiP] = useState(false);

  // Load stream
  useEffect(() => {
    setIsReconnecting(false);
    setErrorCount(0);
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    loadStream();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      destroyHls();
    };
  }, [channel.url]);

  const destroyHls = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const loadStream = () => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();
    setIsPlaying(true);
    setIsBuffering(true);

    const isM3U8 = channel.url.toLowerCase().split('?')[0].endsWith('.m3u8') || channel.url.includes('m3u8');

    if (isM3U8) {
      if (Hls.isSupported()) {
        const hls = new Hls({
          maxBufferLength: preferences.bufferSize || 30,
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;
        hls.loadSource(channel.url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch((err) => {
            console.log('Play interrupted:', err);
            setIsPlaying(false);
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS Error:', data);
          if (data.fatal) {
            setIsBuffering(false);
            handlePlayBackError();
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        video.src = channel.url;
        video.play().catch(() => { setIsPlaying(false); setIsBuffering(false); });
      } else {
        // Fallback
        video.src = channel.url;
        video.play().catch(() => { setIsPlaying(false); setIsBuffering(false); });
      }
    } else {
      // Standard MP4 stream or other video format directly
      video.src = channel.url;
      video.play().catch((err) => {
        console.error('Direct playback error:', err);
        setIsPlaying(false);
        setIsBuffering(false);
        handlePlayBackError();
      });
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChannelListOpen) return; // Don't trigger if drawer is open and user might be typing

      switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          handleFullscreenToggle();
          break;
        case 'p':
          e.preventDefault();
          togglePiP();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeKeyboard(0.1);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeKeyboard(-0.1);
          break;
        case 'arrowleft':
          e.preventDefault();
          if (duration) handleSeekKeyboard(-10);
          break;
        case 'arrowright':
          e.preventDefault();
          if (duration) handleSeekKeyboard(10);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, duration, currentTime, isFullscreen, isChannelListOpen]);

  const handleVolumeKeyboard = (delta: number) => {
    const newVal = Math.min(Math.max(volume + delta, 0), 1.0);
    setVolume(newVal);
    if (videoRef.current) {
      videoRef.current.volume = newVal;
      videoRef.current.muted = newVal === 0;
    }
    setIsMuted(newVal === 0);
    triggerShowControls();
  };

  const handleSeekKeyboard = (delta: number) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const newVal = Math.min(Math.max(currentTime + delta, 0), duration);
    video.currentTime = newVal;
    setCurrentTime(newVal);
    triggerShowControls();
  };

  // Error handling and auto reconnect
  const handlePlayBackError = () => {
    if (!preferences.autoReconnect) return;

    // Use a ref to check the latest error count properly, or functional update properly
    // It's checked during call.
    if (errorCount < 3) {
      setIsReconnecting(true);
      setErrorCount(prev => prev + 1);
      
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log(`Reconnecting attempt ${errorCount + 1}...`);
        loadStream();
      }, 5000); // 5 second delay to avoid rapid reattempt
    } else {
      setIsReconnecting(false);
    }
  };

  // Fade controls after inactivity
  const triggerShowControls = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isChannelListOpen) {
        setShowControls(false);
      }
    }, 4000);
  };

  useEffect(() => {
    triggerShowControls();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, isChannelListOpen]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().catch(console.error);
      setIsPlaying(true);
    }
    triggerShowControls();
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
    triggerShowControls();
  };

  const handleFullscreenToggle = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(err => console.error(err));
    } else {
      document.exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(err => console.error(err));
    }
    triggerShowControls();
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPiP(false);
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
        setIsPiP(true);
      }
    } catch (err) {
      console.error("PiP failed: ", err);
    }
    triggerShowControls();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    const video = videoRef.current;
    const handleEnterPiP = () => setIsPiP(true);
    const handleLeavePiP = () => setIsPiP(false);
    
    if (video) {
        video.addEventListener('enterpictureinpicture', handleEnterPiP);
        video.addEventListener('leavepictureinpicture', handleLeavePiP);
    }

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (video) {
          video.removeEventListener('enterpictureinpicture', handleEnterPiP);
          video.removeEventListener('leavepictureinpicture', handleLeavePiP);
      }
    };
  }, []);

  // Format progress time
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === Infinity) return 'Live';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.currentTime = val;
    setCurrentTime(val);
    triggerShowControls();
  };

  // Scaling style based on preferences
  const getScalingStyle = (): string => {
    if (preferences.scaleMode === 'fill') return 'object-cover';
    if (preferences.scaleMode === 'stretch') return 'object-fill';
    return 'object-contain'; // 'fit'
  };

  return (
    <div 
      id="iptv_player_container"
      ref={containerRef}
      className={`relative w-full h-full bg-black select-none overflow-hidden touch-none flex items-center justify-center ${!showControls && isPlaying ? 'cursor-none' : ''}`}
      onClick={triggerShowControls}
      onMouseMove={triggerShowControls}
    >
      {/* Video Instance */}
      <video
        id="iptv_video_element"
        ref={videoRef}
        className={`w-full h-full ${getScalingStyle()} transition-all`}
        playsInline
        crossOrigin="anonymous"
        onTimeUpdate={() => {
            if (videoRef.current) setCurrentTime(videoRef.current.currentTime);
        }}
        onDurationChange={() => {
            if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
            setIsBuffering(false);
            setIsPlaying(true);
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={onNextChannel}
      />

      {/* Buffer/Reconnecting state overlay */}
      {isReconnecting && (
        <div id="reconnecting_hud" className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xs text-white z-50">
          <RefreshCw className="w-12 h-12 text-amber-500 animate-spin mb-4" />
          <h3 className="font-medium text-lg">Stream Lost - Auto-Reconnecting...</h3>
          <p className="text-sm text-gray-400 mt-1 mb-4">Attempt {errorCount} of 3</p>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
              setIsReconnecting(false);
              onClose();
            }}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
          >
            Cancel & Go Back
          </button>
        </div>
      )}

      {/* Buffering indicator */}
      {isBuffering && !isReconnecting && (
         <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
            <div className="w-16 h-16 border-4 border-white/20 border-t-emerald-500 rounded-full animate-spin"></div>
         </div>
      )}

      {/* ExoPlayer-like HUD & Controls Layout */}
      <div 
        id="player_controls_hud"
        className={`absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-black/80 transition-all duration-300 z-40 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => {
          // Prevent standard background taps from triggering togglePlay
          e.stopPropagation();
          triggerShowControls();
        }}
      >
        {/* Top toolbar */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              id="btn_player_close"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full text-white transitionBack"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2.5">
              {channel.logo ? (
                <img 
                  src={channel.logo} 
                  alt={channel.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(channel.name.slice(0, 2))}&background=random&color=fff`;
                  }}
                  className="w-10 h-10 object-contain rounded-lg border border-white/10 bg-black/40 p-0.5" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">
                  {channel.name.slice(0,2)}
                </div>
              )}
              <div className="flex flex-col">
                <h2 className="text-white font-semibold text-sm leading-tight md:text-base">{channel.name}</h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-ping" />
                  <span className="text-xs text-semibold tracking-wide text-gray-300 flex items-center gap-1 uppercase">
                    {channel.group || 'Live TV'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Source info */}
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-white font-xs rounded-full border border-white/5 font-mono text-xs">
              <Radio className="w-3.5 h-3.5 text-rose-400" />
              {channel.url.toLowerCase().includes('.m3u8') ? 'HLS (M3U8)' : 'MP4 Direct'}
            </span>

            {/* Scale mode status badge */}
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/10 text-white rounded-full text-xs font-medium">
              <Eye className="w-3.5 h-3.5 mr-1" /> Scale: {preferences.scaleMode.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Center play controls */}
        <div className="flex items-center justify-center gap-6 md:gap-12">
          {/* Previous Channel */}
          <button 
            id="btn_player_prev"
            onClick={(e) => {
              e.stopPropagation();
              onPrevChannel();
            }}
            className="p-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full text-white transition-all transform hover:scale-105 active:scale-95"
            title="Previous Channel"
          >
            <SkipBack className="w-6 h-6 md:w-8 md:h-8" />
          </button>

          {/* PLAY / PAUSE BUTTON */}
          <button 
            id="btn_player_play_pause"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="p-5.5 bg-brand-primary bg-[#10B981] hover:brightness-110 active:scale-95 rounded-full text-white shadow-lg transition-all"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 fill-current" />
            ) : (
              <Play className="w-8 h-8 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Next Channel */}
          <button 
            id="btn_player_next"
            onClick={(e) => {
              e.stopPropagation();
              onNextChannel();
            }}
            className="p-3 bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full text-white transition-all transform hover:scale-105 active:scale-95"
            title="Next Channel"
          >
            <SkipForward className="w-6 h-6 md:w-8 md:h-8" />
          </button>
        </div>

        {/* Bottom controls panel */}
        <div 
          className="p-4 bg-gradient-to-t from-black/98 to-transparent"
          onClick={(e) => e.stopPropagation()} // Stop propagation from timeline area
        >
          {/* Progress Timeline (only interactive if VOD, otherwise live indicator) */}
          <div className="flex items-center gap-3 mb-2.5">
            <span className="text-xs font-mono font-bold text-gray-300">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 relative group py-2">
              {duration && duration !== Infinity ? (
                <input
                  id="player_seek_bar"
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-[#10B981] cursor-pointer h-1.5 focus:outline-none rounded-lg bg-gray-700/80"
                />
              ) : (
                <div className="w-full flex items-center gap-1.5">
                  <div className="h-1 flex-1 bg-red-600/50 rounded-full overflow-hidden relative">
                    <div className="absolute top-0 left-0 bottom-0 right-0 bg-gradient-to-r from-emerald-500 to-red-500 animate-pulse" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-600 text-[10px] font-extrabold uppercase text-white animate-pulse">
                    Live Stream
                  </span>
                </div>
              )}
            </div>
            <span className="text-xs font-mono font-bold text-gray-300">
              {duration ? formatTime(duration) : 'Live'}
            </span>
          </div>

          {/* Lower Toolbar controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Volume Controller button */}
              <div className="flex items-center gap-2 group">
                <button 
                  id="btn_player_mute"
                  onClick={toggleMute}
                  className="p-2 hover:bg-white/15 rounded-full text-white transition-all"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-gray-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input 
                  id="player_volume_slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const nextVal = parseFloat(e.target.value);
                    setVolume(nextVal);
                    if (videoRef.current) {
                      videoRef.current.volume = nextVal;
                      videoRef.current.muted = nextVal === 0;
                    }
                    setIsMuted(nextVal === 0);
                  }}
                  className="w-0 group-hover:w-16 focus:w-16 transition-all duration-300 accent-[#10B981] cursor-pointer h-1 rounded-full bg-gray-700" 
                />
              </div>

              {/* Channels overlay toggle button */}
              <button 
                id="btn_player_channel_drawer"
                onClick={(e) => {
                    e.stopPropagation();
                    setIsChannelListOpen(!isChannelListOpen);
                }}
                className={`p-2 hover:bg-white/15 rounded-full transition-all flex items-center gap-1.5 text-xs text-bold tracking-wider font-semibold uppercase ${
                  isChannelListOpen ? 'bg-[#10B981]/20 text-[#10B981]' : 'text-white'
                }`}
                title="Channel Selection Overlay"
              >
                <List className="w-5 h-5" />
                <span className="hidden sm:inline">Drawer</span>
              </button>
            </div>

            {/* Scale, PiP and Fullscreen toggle */}
            <div className="flex items-center gap-2">
              <button 
                id="btn_player_pip"
                onClick={(e) => {
                    e.stopPropagation();
                    togglePiP();
                }}
                className={`p-2 hover:bg-white/15 rounded-full transition-all ${isPiP ? 'text-emerald-500' : 'text-white'}`}
                title="Picture in Picture"
              >
                  <PictureInPicture className="w-5 h-5" />
              </button>
              <button 
                id="btn_player_fullscreen"
                onClick={(e) => {
                    e.stopPropagation();
                    handleFullscreenToggle();
                }}
                className="p-2 hover:bg-white/15 rounded-full text-white transition-all"
                title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              >
                {isFullscreen ? (
                  <Minimize className="w-5 h-5" />
                ) : (
                  <Maximize className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Side drawer displaying the list of categories and channel catalog natively within the player overlay! */}
      {isChannelListOpen && (
        <div 
          id="player_channel_drawer"
          className="absolute right-0 top-0 bottom-0 w-80 bg-stone-900/95 backdrop-blur-md border-l border-white/10 z-50 flex flex-col p-4 text-white shadow-2xl animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <h3 className="font-bold text-base flex items-center gap-1.5">
              <Tv className="w-5 h-5 text-[#10B981]" /> All Channels
            </h3>
            <button 
              id="btn_close_channel_drawer"
              onClick={() => setIsChannelListOpen(false)}
              className="text-gray-400 hover:text-white p-1 text-xs uppercase font-extrabold tracking-wider"
            >
              Close
            </button>
          </div>

          {/* Quick Filter */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 py-1">
            {allChannels.map((c) => {
              const isSelected = c.id === channel.id;
              return (
                <button
                  id={`drawer_chan_${c.id}`}
                  key={c.id}
                  onClick={() => {
                    onSelectChannel(c);
                    setIsChannelListOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-all ${
                    isSelected 
                      ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30 font-semibold'
                      : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <img 
                    src={c.logo} 
                    alt={c.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name.slice(0, 2))}&background=random&color=fff`;
                    }}
                    className="w-8 h-8 rounded-md object-contain bg-black border border-white/5" 
                    referrerPolicy="no-referrer"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{c.name}</p>
                    <p className="text-[10px] text-gray-500 truncate uppercase mt-0.5">{c.group || 'Live'}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
