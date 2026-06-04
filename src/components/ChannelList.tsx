import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, Star, ChevronDown, RefreshCw, ArrowUp, ArrowDown, 
  Trash2, Edit, ListFilter, Play, Folder, MoreVertical, Heart, AlertCircle
} from 'lucide-react';
import { Channel, Playlist } from '../types';

interface ChannelListProps {
  playlists: Playlist[];
  selectedPlaylistId: string;
  onSelectPlaylist: (playlistId: string) => void;
  favorites: string[];
  onToggleFavorite: (channel: Channel, playlistId: string) => void;
  recentChannels: Channel[];
  onPlayChannel: (channel: Channel) => void;
  onUpdateChannelOrder: (playlistId: string, channels: Channel[]) => void;
  onRefreshPlaylist: (playlistId: string) => Promise<void>;
}

export default function ChannelList({
  playlists,
  selectedPlaylistId,
  onSelectPlaylist,
  favorites,
  onToggleFavorite,
  recentChannels,
  onPlayChannel,
  onUpdateChannelOrder,
  onRefreshPlaylist
}: ChannelListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('ALL');
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Custom dialog or bottom sheet for long-pressed channel actions
  const [activeActionChannel, setActiveActionChannel] = useState<{ channel: Channel; playlistId: string } | null>(null);

  // Long press timer references
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressActive = useRef(false);

  const playlist = playlists.find(p => p.id === selectedPlaylistId) || playlists[0];

  // Auto-reset group selection when playlist changes
  useEffect(() => {
    setSelectedGroup('ALL');
  }, [selectedPlaylistId]);

  if (!playlist) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-stone-100">No Playlist Available</h3>
        <p className="text-sm text-gray-500 dark:text-stone-400 mt-1 max-w-sm">
          Go to the Settings tab to add your first M3U, M3U8, Web link, JSON, or TXT playlist!
        </p>
      </div>
    );
  }

  // Extract unique category groups from current playlist channels
  const groups = ['ALL', ...Array.from(new Set(playlist.channels.map(c => c.group || 'Uncategorized')))];

  // Filter channels based on Search and Selected Category Group
  const filteredChannels = playlist.channels
    .filter(channel => {
      const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            (channel.group && channel.group.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedGroup === 'ALL' || (channel.group || 'Uncategorized') === selectedGroup;
      return matchesSearch && matchesCategory;
    });

  // Handle single tap and double-tap behaviors described in the requirements:
  // "Single tap on a playlist loads its channels. Double tap on the selected playlist name opens a category/group selector for that playlist."
  const lastPlaylistClickTime = useRef<{ [key: string]: number }>({});
  
  const handlePlaylistClick = (playlistId: string) => {
    const now = Date.now();
    const lastClick = lastPlaylistClickTime.current[playlistId] || 0;
    
    if (now - lastClick < 300) {
      // Double tap detected: Open Category/group selector for that playlist!
      setShowPlaylistDropdown(false);
      setShowGroupSelector(true);
    } else {
      // Single tap: Load its channels
      onSelectPlaylist(playlistId);
    }
    lastPlaylistClickTime.current[playlistId] = now;
  };

  // Pull-to-refresh simulator
  const handlePullToRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefreshPlaylist(playlist.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Long press emulator
  const handleChannelTouchStart = (channel: Channel, playlistId: string) => {
    isLongPressActive.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      setActiveActionChannel({ channel, playlistId });
      // Trigger subtle phone vibrator simulator sound/visual cue
    }, 600); // 600ms hold triggers the action sheet
  };

  const handleChannelTouchEnd = (channel: Channel) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    if (!isLongPressActive.current) {
      // It's a standard tap, play the channel
      onPlayChannel(channel);
    }
  };

  // Manual sorting and positions: Up/Down channel order swapping
  const moveChannel = (direction: 'up' | 'down') => {
    if (!activeActionChannel) return;
    const { channel, playlistId } = activeActionChannel;
    
    // Find current indices in original channels list
    const originalChannels = [...playlist.channels];
    const currentIndex = originalChannels.findIndex(c => c.id === channel.id);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < originalChannels.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex !== currentIndex) {
      // Swap order
      const temp = originalChannels[currentIndex];
      originalChannels[currentIndex] = originalChannels[targetIndex];
      originalChannels[targetIndex] = temp;
      
      // Update internal order indexes
      const updated = originalChannels.map((c, i) => ({ ...c, order: i }));
      onUpdateChannelOrder(playlistId, updated);
      setActiveActionChannel({ channel: updated[targetIndex], playlistId });
    }
  };

  return (
    <div className="flex flex-col h-full bg-stone-50 dark:bg-stone-950" id="channel_list_view">
      
      {/* Header with Playlist selector / Dynamic dropdown with MD3 styling */}
      <div className="p-4 bg-white dark:bg-stone-900 border-b border-stone-200 dark:border-stone-800 shadow-xs">
        <label className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-stone-500 uppercase block mb-1">
          Active IPTV Playlist
        </label>
        
        <div className="relative">
          <button
            id="btn_playlist_selector_dropdown"
            onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)}
            className="w-full flex items-center justify-between px-3.5 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700/80 rounded-xl text-left transition-all border border-stone-200 dark:border-stone-700/50"
            title="Single tap selects, Double tap opens Categories directly"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 dark:text-stone-100 truncate">
                  {playlist.name}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-stone-400">
                  {playlist.channels.length} Streams • Double-click for categories
                </span>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Playlist Dropdown */}
          {showPlaylistDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowPlaylistDropdown(false)} />
              <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-stone-100 dark:divide-stone-850">
                {playlists.map((p) => {
                  const isCur = p.id === playlist.id;
                  return (
                    <button
                      id={`dropdown_playlist_item_${p.id}`}
                      key={p.id}
                      onClick={() => handlePlaylistClick(p.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                        isCur 
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium' 
                          : 'hover:bg-stone-50 dark:hover:bg-stone-800 text-gray-700 dark:text-stone-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">{p.type.toUpperCase()} • {p.channels.length} channels</p>
                      </div>
                      {isCur && <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-700 px-2.5 py-0.5 rounded-full font-bold">ACTIVE</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Dynamic Horizontal Category selectors / Groups */}
        <div className="flex items-center gap-2 mt-4 overflow-x-auto no-scrollbar pb-1">
          <button
            id="cfg_group_selector_trigger"
            onClick={() => setShowGroupSelector(true)}
            className="flex-none p-2 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 rounded-lg text-gray-600 dark:text-stone-300 transition-all border border-stone-200 dark:border-stone-700/50"
            title="Browse all categories dialog"
          >
            <ListFilter className="w-4 h-4" />
          </button>

          {groups.slice(0, 7).map((grp) => {
            const isSel = selectedGroup === grp;
            return (
              <button
                id={`grp_tab_${grp}`}
                key={grp}
                onClick={() => setSelectedGroup(grp)}
                className={`flex-none px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isSel 
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10' 
                    : 'bg-stone-100 dark:bg-stone-800 text-gray-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700'
                }`}
              >
                {grp === 'ALL' ? '🚨 All Channels' : grp}
              </button>
            );
          })}

          {groups.length > 7 && (
            <button
              onClick={() => setShowGroupSelector(true)}
              className="flex-none px-3.5 py-1.5 rounded-full text-xs font-semibold bg-stone-150 dark:bg-stone-800 text-emerald-500 hover:brightness-105"
            >
              + {groups.length - 7} More
            </button>
          )}
        </div>
      </div>

      {/* Recents banner if any channels watched recently */}
      {recentChannels.length > 0 && selectedGroup === 'ALL' && !searchQuery && (
        <div className="px-4 pt-3 bg-stone-50 dark:bg-stone-950 flex flex-col gap-2">
          <h4 className="text-[10px] font-bold text-gray-400 dark:text-stone-500 tracking-wider uppercase">Recently Watched</h4>
          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {recentChannels.map((c) => (
              <button
                id={`recent_chan_${c.id}`}
                key={`recent_${c.id}`}
                onClick={() => onPlayChannel(c)}
                className="flex-none flex items-center gap-2 p-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800/80 rounded-xl hover:scale-101 transition-all text-left w-48 shadow-xs line-clamp-1"
              >
                <img 
                  src={c.logo} 
                  alt={c.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name.slice(0, 2))}&background=10B981&color=fff`;
                  }}
                  className="w-10 h-10 rounded-lg object-contain bg-stone-50 dark:bg-black p-1 border border-stone-100 dark:border-stone-800"
                  referrerPolicy="no-referrer"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-stone-800 dark:text-stone-100 truncate">{c.name}</p>
                  <p className="text-[9px] text-gray-400 uppercase truncate leading-tight">{c.group || 'Live'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar & Stats info */}
      <div className="p-4 py-2 bg-stone-50 dark:bg-stone-950 flex gap-2 items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input_channel_search"
            type="text"
            placeholder="Search channels or groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-4 py-2 bg-white dark:bg-stone-900 text-gray-800 dark:text-stone-200 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:border-emerald-500/90 transition-all shadow-xs"
          />
        </div>

        {/* Pull to refresh / Playlist Refresh command button */}
        <button
          id="btn_pull_to_refresh"
          onClick={handlePullToRefresh}
          disabled={isRefreshing}
          className="p-2 sm:px-3 sm:py-2 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-gray-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 active:scale-95 rounded-xl transition-all text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-1.5 min-w-[36px]"
          title="Refresh Playlist URLs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-500' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

      {/* Channels Catalog Grid/List Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-12" id="channel_list_container">
        {filteredChannels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center p-6 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-800/60 shadow-xs mt-2">
            <AlertCircle className="w-10 h-10 text-gray-400 mb-2" />
            <h4 className="font-bold text-sm text-gray-700 dark:text-stone-350">No Channels Found</h4>
            <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
              We couldn't find any matches. Try a different search query or group filter!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {filteredChannels.map((chan) => {
              const isFav = favorites.includes(`${playlist.id}::${chan.id}`);
              return (
                <div
                  id={`channel_card_${chan.id}`}
                  key={chan.id}
                  onTouchStart={() => handleChannelTouchStart(chan, playlist.id)}
                  onTouchEnd={() => handleChannelTouchEnd(chan)}
                  onMouseDown={() => handleChannelTouchStart(chan, playlist.id)}
                  onMouseUp={() => handleChannelTouchEnd(chan)}
                  className="group relative flex items-center justify-between p-3.5 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-emerald-500/45 dark:hover:border-emerald-500/40 rounded-2xl cursor-pointer active:scale-98 transform hover:-translate-y-0.5 hover:shadow-xs transition-all select-none"
                  title="Direct-click to play Stream. Hold-down (long press) to configure orders & favorites"
                >
                  <div className="flex items-center gap-3.5 min-w-0 flex-1">
                    {chan.logo ? (
                      <img 
                        src={chan.logo} 
                        alt={chan.name} 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(chan.name.slice(0, 2))}&background=random&color=fff&size=128&bold=true`;
                        }}
                        className="w-12 h-12 rounded-xl object-contain bg-stone-50 dark:bg-stone-950 p-1.5 border border-stone-100 dark:border-stone-800 shadow-inner"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-500/10 text-emerald-600 rounded-xl font-bold flex items-center justify-center">
                        {chan.name.slice(0, 2)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-950 dark:text-stone-50 text-sm truncate group-hover:text-emerald-500 transition-colors">
                        {chan.name}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-stone-500 font-medium uppercase tracking-wide truncate mt-0.5">
                        {chan.group || 'Uncategorized'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {isFav && (
                      <Star className="w-4.5 h-4.5 text-amber-500 fill-current animate-pulse" />
                    )}
                    
                    {/* Triple-dot settings button as accessibility fallback / desktop option */}
                    <button
                      id={`btn_config_chan_${chan.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
                        setActiveActionChannel({ channel: chan, playlistId: playlist.id });
                      }}
                      className="p-1 px-2 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                      title="Manage Channel"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* --- EXTRA DIALOG: Category / Group selector dialog (triggers on double-tap as described in requirements) --- */}
      {showGroupSelector && (
        <>
          <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-xs z-50 animate-fade-in" onClick={() => setShowGroupSelector(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-85 max-h-[75vh] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl z-50 flex flex-col p-5 overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Folder className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-base text-gray-900 dark:text-stone-100">Browse Categories</h3>
              </div>
              <button 
                onClick={() => setShowGroupSelector(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-stone-200 text-xs font-bold tracking-wider uppercase"
              >
                Done
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {groups.map((grp) => {
                const count = grp === 'ALL' 
                  ? playlist.channels.length 
                  : playlist.channels.filter(c => (c.group || 'Uncategorized') === grp).length;
                const isSel = selectedGroup === grp;

                return (
                  <button
                    id={`dialog_grp_item_${grp}`}
                    key={`all_${grp}`}
                    onClick={() => {
                      setSelectedGroup(grp);
                      setShowGroupSelector(false);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                      isSel 
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold shadow-xs' 
                        : 'bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-800 text-gray-700 dark:text-stone-300'
                    }`}
                  >
                    <span className="truncate">{grp === 'ALL' ? '🚨 All Channels' : grp}</span>
                    <span className="text-[10px] bg-stone-200 dark:bg-stone-800 px-2.5 py-1 rounded-full font-mono text-gray-500 dark:text-stone-400">
                      {count} streams
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* --- MD3 ACTION SHEET: Long-Press or Quick Config Channel Sheet --- */}
      {activeActionChannel && (
        <>
          <div className="fixed inset-0 bg-stone-950/65 backdrop-blur-xs z-50" onClick={() => setActiveActionChannel(null)} />
          <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-stone-900 border-t border-stone-200 dark:border-stone-800 rounded-t-[32px] shadow-2xl z-50 flex flex-col p-6 animate-slide-up pb-8">
            <div className="flex flex-col items-center text-center mb-5">
              <div className="w-12 h-1 bg-gray-300 dark:bg-stone-700 rounded-full mb-4" />
              {activeActionChannel.channel.logo ? (
                <img 
                  src={activeActionChannel.channel.logo} 
                  alt={activeActionChannel.channel.name} 
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(activeActionChannel.channel.name.slice(0, 2))}&background=random&color=fff`;
                  }}
                  className="w-14 h-14 rounded-2xl object-contain bg-stone-50 dark:bg-stone-950 p-2 border border-stone-250 dark:border-stone-800 shadow-md mb-2" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 rounded-2xl font-bold flex items-center justify-center shadow-md mb-2">
                  {activeActionChannel.channel.name.slice(0,2)}
                </div>
              )}
              <h4 className="font-bold text-gray-950 dark:text-white text-base leading-snug">{activeActionChannel.channel.name}</h4>
              <p className="text-xs text-gray-400 mt-0.5 leading-none uppercase font-mono">{activeActionChannel.channel.group || 'Live Stream'}</p>
            </div>

            <div className="space-y-2">
              {/* Star / Unstar Favorite channel */}
              <button
                id="btn_sheet_toggle_fav"
                onClick={() => {
                  onToggleFavorite(activeActionChannel.channel, activeActionChannel.playlistId);
                  setActiveActionChannel(null);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-2xl text-left border border-transparent hover:border-amber-500/20 text-gray-800 dark:text-stone-200 transition-all font-semibold text-sm"
              >
                <Heart className={`w-5 h-5 ${favorites.includes(`${activeActionChannel.playlistId}::${activeActionChannel.channel.id}`) ? 'text-rose-500 fill-current' : 'text-gray-400'}`} />
                {favorites.includes(`${activeActionChannel.playlistId}::${activeActionChannel.channel.id}`) 
                  ? 'Remove from Favorites section' 
                  : 'Bookmark as Favorite stream'}
              </button>

              {/* Move Channel Position Up (Reordering) */}
              <button
                id="btn_sheet_move_up"
                onClick={() => moveChannel('up')}
                className="w-full flex items-center gap-3.5 p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-2xl text-left text-gray-850 dark:text-stone-200 transition-all font-semibold text-sm"
              >
                <ArrowUp className="w-5 h-5 text-indigo-500" />
                Move Position Upwards (Elevate Channel)
              </button>

              {/* Move Channel Position Down (Reordering) */}
              <button
                id="btn_sheet_move_down"
                onClick={() => moveChannel('down')}
                className="w-full flex items-center gap-3.5 p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800 rounded-2xl text-left text-gray-850 dark:text-stone-200 transition-all font-semibold text-sm"
              >
                <ArrowDown className="w-5 h-5 text-indigo-500" />
                Move Position Downwards (Lower Channel)
              </button>

              {/* Directly play item */}
              <button
                id="btn_sheet_launch_player"
                onClick={() => {
                  onPlayChannel(activeActionChannel.channel);
                  setActiveActionChannel(null);
                }}
                className="w-full flex items-center gap-3.5 p-3.5 bg-[#10B981]/15 hover:bg-[#10B981]/25 text-emerald-600 dark:text-emerald-400 rounded-2xl text-left transition-all font-semibold text-sm border border-emerald-500/10"
              >
                <Play className="w-5 h-5" />
                Start Stream Playback
              </button>
            </div>

            <button
              onClick={() => setActiveActionChannel(null)}
              className="mt-4 w-full py-3 bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold rounded-2xl text-xs uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

    </div>
  );
}
