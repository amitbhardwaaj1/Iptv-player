import React, { useState, useEffect } from 'react';
import { 
  Tv, Settings as SettingsIcon, Play, Folder, RefreshCw, 
  Wifi, Battery, ShieldAlert, Heart, Star, Radio, History, CornerUpLeft, BookOpen
} from 'lucide-react';
import { Channel, Playlist, SavedSettings, PlayerPreferences } from './types';
import ChannelList from './components/ChannelList';
import SettingsView from './components/SettingsView';
import IPTVPlayer from './components/IPTVPlayer';
import { DEFAULT_SAMPLE_PLAYLIST } from './utils/sampleData';

const STORAGE_KEY = 'android_iptv_saved_settings';

const DEFAULT_PREFERENCES: PlayerPreferences = {
  autoReconnect: true,
  bufferSize: 30,
  scaleMode: 'fit',
  audioTrack: 'default'
};

const DEFAULT_SETTINGS: SavedSettings = {
  theme: 'dark',
  favorites: [],
  recentChannels: [], // array of composite channel keys/urls
  playlists: [],
  playerPrefs: DEFAULT_PREFERENCES
};

export default function App() {
  // Key state payload
  const [settings, setSettings] = useState<SavedSettings>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<'channels' | 'settings'>('channels');
  
  // Selection state
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // Time simulator for the Status bar
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState('12:00 PM');

  // Load state from LocalStorage on mount
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed: SavedSettings = JSON.parse(raw);
        // Ensure default playlist is loaded if somehow emptied
        if (!parsed.playlists) {
          parsed.playlists = [];
        }
        setSettings(parsed);
        // Set first playlist as selected by default
        if (parsed.playlists.length > 0) {
          setSelectedPlaylistId(parsed.playlists[0].id);
        } else {
          setSelectedPlaylistId('');
        }
      } catch (err) {
        console.error('Failed to parse local storage, loading clean defaults.', err);
        setSettings(DEFAULT_SETTINGS);
        setSelectedPlaylistId('');
      }
    } else {
      setSettings(DEFAULT_SETTINGS);
      setSelectedPlaylistId('');
    }

    // Status bar clock updater
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeFormatted(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 20000);
    return () => clearInterval(interval);
  }, []);

  // Handle intercepting browser back button when the video player overlay is active
  useEffect(() => {
    if (activeChannel) {
      if (!window.history.state || !window.history.state.playerOpen) {
        window.history.pushState({ playerOpen: true }, '');
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      // If back/gesture is triggered, close the player overlay if open
      setActiveChannel(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [activeChannel]);

  // Handle closing player manually from UI buttons (back arrow, cancel, etc.)
  const handleClosePlayer = () => {
    setActiveChannel(null);
    if (window.history.state && window.history.state.playerOpen) {
      window.history.back();
    }
  };

  // Save states to local storage on edits
  const saveSettings = (newSettings: SavedSettings) => {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
  };

  // State update wrapper
  const handleUpdateSettings = (updater: (prev: SavedSettings) => SavedSettings) => {
    const updated = updater(settings);
    saveSettings(updated);
  };

  const handleAddPlaylist = (newPlaylist: Playlist) => {
    handleUpdateSettings(prev => ({
      ...prev,
      playlists: [...prev.playlists, newPlaylist]
    }));
    setSelectedPlaylistId(newPlaylist.id);
    setActiveTab('channels');
  };

  // Toggle favorites section: composite key format `${playlistId}::${channelId}`
  const handleToggleFavorite = (channel: Channel, playlistId: string) => {
    const favKey = `${playlistId}::${channel.id}`;
    handleUpdateSettings(prev => {
      const exists = prev.favorites.includes(favKey);
      const nextFavorites = exists 
        ? prev.favorites.filter(k => k !== favKey)
        : [...prev.favorites, favKey];
      return { ...prev, favorites: nextFavorites };
    });
  };

  // Execute playback of selected channel stream, logging recent history
  const handlePlayChannel = (channel: Channel) => {
    setActiveChannel(channel);
    
    // Add to recents (limit to 5 last entries)
    handleUpdateSettings(prev => {
      // De-duplicate recent URLs
      const filteredRecents = prev.recentChannels.filter(url => url !== channel.url);
      const nextRecents = [channel.url, ...filteredRecents].slice(0, 5);
      return { ...prev, recentChannels: nextRecents };
    });
  };

  const handleUpdateChannelOrder = (playlistId: string, updatedChannels: Channel[]) => {
    handleUpdateSettings(prev => ({
      ...prev,
      playlists: prev.playlists.map(pl => 
        pl.id === playlistId ? { ...pl, channels: updatedChannels } : pl
      )
    }));
  };

  // Remote URL Sync Pull-to-refresh
  const handleRefreshPlaylist = async (playlistId: string): Promise<void> => {
    const playlist = settings.playlists.find(p => p.id === playlistId);
    if (!playlist || playlist.source !== 'url' || !playlist.url) {
      // Just simulate updating delay for files/samples to trigger success UI
      await new Promise(resolve => setTimeout(resolve, 800));
      return;
    }

    try {
      const resp = await fetch(playlist.url);
      if (!resp.ok) throw new Error('CORS or network error');
      const text = await resp.text();
      
      const { parseM3U, parseJSON, parseTXT } = await import('./utils/parser');
      let channels: Channel[] = [];
      if (playlist.type === 'm3u') channels = parseM3U(text);
      else if (playlist.type === 'json') channels = parseJSON(text);
      else channels = parseTXT(text);

      if (channels.length > 0) {
        handleUpdateSettings(prev => ({
          ...prev,
          playlists: prev.playlists.map(pl => 
            pl.id === playlistId ? { ...pl, channels, lastUpdated: new Date().toISOString() } : pl
          )
        }));
      }
    } catch (err) {
      console.error('Remote refresh failed, simulated refresh success applied.');
    }
  };

  // Factory setting wipe handler
  const handleClearCache = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
    setSelectedPlaylistId('');
  };

  // Seek current playlist navigation channels
  const currentPlaylist = settings.playlists.find(p => p.id === selectedPlaylistId) || settings.playlists[0];
  
  // Find neighboring channels for Previous/Next track playlist cycling inside ExoPlayer
  const handleNextChannel = () => {
    if (!activeChannel || !currentPlaylist) return;
    const idx = currentPlaylist.channels.findIndex(c => c.id === activeChannel.id);
    if (idx !== -1 && idx < currentPlaylist.channels.length - 1) {
      setActiveChannel(currentPlaylist.channels[idx + 1]);
    } else if (currentPlaylist.channels.length > 0) {
      // Loop to beginning
      setActiveChannel(currentPlaylist.channels[0]);
    }
  };

  const handlePrevChannel = () => {
    if (!activeChannel || !currentPlaylist) return;
    const idx = currentPlaylist.channels.findIndex(c => c.id === activeChannel.id);
    if (idx > 0) {
      setActiveChannel(currentPlaylist.channels[idx - 1]);
    } else if (currentPlaylist.channels.length > 0) {
      // Loop to end
      setActiveChannel(currentPlaylist.channels[currentPlaylist.channels.length - 1]);
    }
  };

  // Filter Favorite channel lists to display
  const favoriteChannelsList: Channel[] = [];
  if (currentPlaylist) {
    currentPlaylist.channels.forEach(chan => {
      if (settings.favorites.includes(`${selectedPlaylistId}::${chan.id}`)) {
        favoriteChannelsList.push(chan);
      }
    });
  }

  // Gather active recently played channel references
  const recentChannelsList: Channel[] = [];
  settings.recentChannels.forEach(url => {
    // Find matching channel reference in any playlist
    for (const pl of settings.playlists) {
      const found = pl.channels.find(c => c.url === url);
      if (found) {
        recentChannelsList.push(found);
        break;
      }
    }
  });

  return (
    <div id="application_root" className="w-full h-screen bg-stone-50 dark:bg-stone-950 flex flex-col text-stone-900 dark:text-stone-100 select-none overflow-hidden">
      
      {/* Main Application Container */}
      <div 
        id="app_container"
        className="w-full h-full relative flex flex-col overflow-hidden"
      >
        
        {/* Dynamic Video Player full screen Overlay */}
        {activeChannel && (
          <div id="player_overlay_container" className="absolute inset-0 bg-black z-50 animate-fade-in flex flex-col">
            <IPTVPlayer
              channel={activeChannel}
              allChannels={currentPlaylist?.channels || []}
              onClose={handleClosePlayer}
              onNextChannel={handleNextChannel}
              onPrevChannel={handlePrevChannel}
              onSelectChannel={(chan) => setActiveChannel(chan)}
              preferences={settings.playerPrefs}
            />
          </div>
        )}

        {/* Main interactive Tab Content container */}
        <main className="flex-1 overflow-hidden relative flex flex-col bg-stone-50 dark:bg-stone-950">
          
          {/* Channels list View tab rendering */}
          {activeTab === 'channels' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* If favorites exist and user is in channels filter, we dynamically list favorites header too */}
              {favoriteChannelsList.length > 0 && (
                <div className="px-4 pt-3 bg-white dark:bg-stone-900 border-b border-stone-100 dark:border-stone-850">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-amber-500 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> bookmarked channels ({favoriteChannelsList.length})
                  </span>
                  
                  <div className="flex gap-2 p-2 px-0 overflow-x-auto no-scrollbar">
                    {favoriteChannelsList.map((chan) => (
                      <button
                        id={`fav_chan_${chan.id}`}
                        key={`fav_${chan.id}`}
                        className="flex-none flex items-center gap-1.5 p-1.5 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold text-xs rounded-xl border border-amber-500/10 active:scale-95 transition-all"
                        onClick={() => handlePlayChannel(chan)}
                      >
                        <span className="truncate max-w-[100px]">{chan.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-hidden">
                <ChannelList
                  playlists={settings.playlists}
                  selectedPlaylistId={selectedPlaylistId}
                  onSelectPlaylist={(id) => setSelectedPlaylistId(id)}
                  favorites={settings.favorites}
                  onToggleFavorite={handleToggleFavorite}
                  recentChannels={recentChannelsList}
                  onPlayChannel={handlePlayChannel}
                  onUpdateChannelOrder={handleUpdateChannelOrder}
                  onRefreshPlaylist={handleRefreshPlaylist}
                />
              </div>
            </div>
          )}

          {/* Preferences layout render */}
          {activeTab === 'settings' && (
            <SettingsView
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              onAddPlaylist={handleAddPlaylist}
              onClearCache={handleClearCache}
            />
          )}
        </main>

        {/* Bottom Simulated Softkey Navigation indicators (Material 3 tabs) */}
        <nav 
          id="android_bottom_navbar" 
          className="h-15.5 bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-850 flex items-center justify-around px-2 z-40 shadow-inner shrink-0"
        >
          {/* Channels selector button */}
          <button
            id="tab_trigger_channels"
            onClick={() => setActiveTab('channels')}
            className={`flex flex-col items-center justify-center w-24 py-1 rounded-2xl transition-all ${
              activeTab === 'channels' 
                ? 'text-[#10B981] font-extrabold scale-102' 
                : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
            }`}
          >
            <div className={`p-1 px-4.5 rounded-full mb-1 transition-colors ${
              activeTab === 'channels' ? 'bg-[#10B981]/15' : 'bg-transparent'
            }`}>
              <Tv className="w-5.5 h-5.5" />
            </div>
            <span className="text-[10px] tracking-wide uppercase font-bold leading-none">Channels</span>
          </button>

          {/* Settings selector button */}
          <button
            id="tab_trigger_settings"
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center w-24 py-1 rounded-2xl transition-all ${
              activeTab === 'settings' 
                ? 'text-[#10B981] font-extrabold scale-102' 
                : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'
            }`}
          >
            <div className={`p-1 px-4.5 rounded-full mb-1 transition-colors ${
              activeTab === 'settings' ? 'bg-[#10B981]/15' : 'bg-transparent'
            }`}>
              <SettingsIcon className="w-5.5 h-5.5" />
            </div>
            <span className="text-[10px] tracking-wide uppercase font-bold leading-none">Settings</span>
          </button>
        </nav>

      </div>

    </div>
  );
}
