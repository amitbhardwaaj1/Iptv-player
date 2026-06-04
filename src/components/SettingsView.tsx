import React, { useState, useRef } from 'react';
import { 
  Sun, Moon, Monitor, Settings, Radio, Plus, Layers, Database, RefreshCw, 
  Trash2, Edit, Save, Download, Upload, Info, Heart, Volume2, ShieldCheck, 
  Trash, Sparkles, FolderUp, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { Playlist, PlayerPreferences, SavedSettings } from '../types';
import { parseM3U, parseJSON, parseTXT } from '../utils/parser';

interface SettingsProps {
  settings: SavedSettings;
  onUpdateSettings: (updater: (prev: SavedSettings) => SavedSettings) => void;
  onAddPlaylist: (playlist: Playlist) => void;
  onClearCache: () => void;
}

export default function SettingsView({
  settings,
  onUpdateSettings,
  onAddPlaylist,
  onClearCache
}: SettingsProps) {
  // Playlist addition state
  const [playlistName, setPlaylistName] = useState('');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [playlistFormat, setPlaylistFormat] = useState<'m3u' | 'json' | 'txt'>('m3u');
  const [isUrlImporting, setIsUrlImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Edit playlist names state
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // Drag and Drop State
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Player preferences state handlers
  const handleScaleModeChange = (mode: 'fit' | 'fill' | 'stretch') => {
    onUpdateSettings(prev => ({
      ...prev,
      playerPrefs: { ...prev.playerPrefs, scaleMode: mode }
    }));
  };

  const handleAutoReconnectChange = (val: boolean) => {
    onUpdateSettings(prev => ({
      ...prev,
      playerPrefs: { ...prev.playerPrefs, autoReconnect: val }
    }));
  };

  const handleBufferSizeChange = (size: number) => {
    onUpdateSettings(prev => ({
      ...prev,
      playerPrefs: { ...prev.playerPrefs, bufferSize: size }
    }));
  };

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    onUpdateSettings(prev => ({ ...prev, theme }));
    
    // Apply styling class
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  };

  // Import Playlist via Web/Remote URL URL Support
  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistUrl.trim()) return;

    setIsUrlImporting(true);
    setImportFeedback(null);

    const nameToUse = playlistName.trim() || `Remote Playlist ${new Date().toLocaleDateString()}`;

    try {
      // Fetch playlist file
      // Since fetch might be blocked by CORS in client-side widgets, we offer client-side parser & fallback
      const resp = await fetch(playlistUrl);
      if (!resp.ok) {
        throw new Error(`Server returned status: ${resp.status}`);
      }
      const rawText = await resp.text();
      let channels = [];

      if (playlistFormat === 'm3u') {
        channels = parseM3U(rawText);
      } else if (playlistFormat === 'json') {
        channels = parseJSON(rawText);
      } else {
        channels = parseTXT(rawText);
      }

      if (channels.length === 0) {
        throw new Error('Check file formatting. No streams extracted successfully.');
      }

      const nextPlaylist: Playlist = {
        id: `playlist_remote_${Date.now()}`,
        name: nameToUse,
        type: playlistFormat,
        source: 'url',
        url: playlistUrl,
        lastUpdated: new Date().toISOString(),
        channels
      };

      onAddPlaylist(nextPlaylist);
      setImportFeedback({ type: 'success', text: `Imported remote URL! ${channels.length} channels loaded successfully.` });
      setPlaylistName('');
      setPlaylistUrl('');
    } catch (err: any) {
      console.error('URL import failure, applying simulated channels:', err);
      // In web applets, CORS proxy may prevent direct fetching from some raw github URLs.
      // We will gracefully bundle an alternate option or alert user, but we can also use a fallback
      // parsing mechanism or let them know. Let's show a helpful instructions page.
      setImportFeedback({ 
        type: 'error', 
        text: `Network CORS error. In-browser direct fetching may be restricted by playlist server security. Try uploading/dragging the local file directly!` 
      });
    } finally {
      setIsUrlImporting(false);
    }
  };

  // Local File Parser helper
  const processPlaylistFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const fileName = file.name;
      const lowerName = fileName.toLowerCase();
      let detectedFormat: 'm3u' | 'json' | 'txt' = 'm3u';
      let parsedChannels = [];

      if (lowerName.endsWith('.json')) {
        detectedFormat = 'json';
        parsedChannels = parseJSON(content);
      } else if (lowerName.endsWith('.txt')) {
        detectedFormat = 'txt';
        parsedChannels = parseTXT(content);
      } else {
        parsedChannels = parseM3U(content);
      }

      if (parsedChannels.length === 0) {
        setImportFeedback({ type: 'error', text: `Failed to extract channels from file. Check formatting!` });
        return;
      }

      const nextPlaylist: Playlist = {
        id: `playlist_file_${Date.now()}`,
        name: playlistName.trim() || fileName.replace(/\.[^/.]+$/, ""), // stripe extension
        type: detectedFormat,
        source: 'file',
        lastUpdated: new Date().toISOString(),
        channels: parsedChannels
      };

      onAddPlaylist(nextPlaylist);
      setImportFeedback({ type: 'success', text: `Uploaded "${file.name}"! Loaded ${parsedChannels.length} stream channels.` });
      setPlaylistName('');
    };

    reader.readAsText(file);
  };

  // Drag and Drop elements
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processPlaylistFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processPlaylistFile(e.target.files[0]);
    }
  };

  // Playlist modification managers: Editing name
  const handleSavePlaylistName = (id: string) => {
    if (!editingName.trim()) return;
    onUpdateSettings(prev => ({
      ...prev,
      playlists: prev.playlists.map(p => p.id === id ? { ...p, name: editingName.trim() } : p)
    }));
    setEditingPlaylistId(null);
    setEditingName('');
  };

  // Remove playlists
  const handleRemovePlaylist = (id: string) => {
    if (confirm('Are you sure you want to remove this playlist entirely?')) {
      onUpdateSettings(prev => ({
        ...prev,
        playlists: prev.playlists.filter(p => p.id !== id)
      }));
    }
  };

  // Backup & Restore settings (JSON payload download / upload)
  const handleBackup = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `android_iptv_backup_${new Date().toISOString().split('T')[0]}.json`);
    dlAnchorElem.click();
  };

  const handleRestoreUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.playlists && parsed.playerPrefs) {
            onUpdateSettings(() => parsed);
            alert('IPTV Player backup restored successfully!');
          } else {
            alert('Invalid backup structure!');
          }
        } catch (err) {
          alert('Failed to parse backup JSON file.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-stone-50 dark:bg-stone-950 p-4 space-y-6" id="settings_view_panel">
      {/* Visual Header */}
      <div className="flex items-center gap-2 pb-1.5 border-b border-stone-200 dark:border-stone-850">
        <Settings className="w-6 h-6 text-emerald-500" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-stone-50">App Configuration</h2>
      </div>

      {/* 1. Theme Preferences */}
      <section className="bg-white dark:bg-stone-900 p-4 rounded-3xl border border-stone-200 dark:border-stone-850 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[#10B981]" /> Material Design Theme Selection
        </h3>
        <p className="text-xs text-gray-400">Choose between light, dark or system ambient aesthetics.</p>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { id: 'light', label: 'Light Theme', icon: Sun },
            { id: 'dark', label: 'Dark Theme', icon: Moon },
            { id: 'system', label: 'System Theme', icon: Monitor }
          ].map(({ id, label, icon: Icon }) => {
            const isSel = settings.theme === id;
            return (
              <button
                id={`btn_theme_${id}`}
                key={id}
                onClick={() => handleThemeChange(id as any)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  isSel 
                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold' 
                    : 'bg-stone-50 dark:bg-stone-850 hover:bg-stone-100 dark:hover:bg-stone-860 border-stone-205 dark:border-stone-800 text-gray-600 dark:text-stone-300'
                }`}
              >
                <Icon className="w-5 h-5 mb-1.5" />
                <span className="text-[11px] font-medium leading-none">{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Playlist Manager / Import Section */}
      <section className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-850 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 flex items-center gap-2">
          <Radio className="w-4.5 h-4.5 text-[#10B981]" /> Import New IPTV Playlist Catalog
        </h3>

        {/* Input playlist fields */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
              Playlist Custom Name (Optional)
            </label>
            <input 
              id="ipt_playlist_name"
              type="text" 
              placeholder="e.g. My Premium Streams"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-stone-50 dark:bg-stone-850 text-gray-950 dark:text-stone-150 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:border-emerald-500/90"
            />
          </div>

          {/* Tab selector for Web URL Import vs Drag-Drop local upload */}
          <form onSubmit={handleImportUrl} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(['m3u', 'json', 'txt'] as const).map((fmt) => (
                <button
                  id={`btn_format_${fmt}`}
                  key={fmt}
                  type="button"
                  onClick={() => setPlaylistFormat(fmt)}
                  className={`py-1 rounded-lg text-xs font-semibold uppercase tracking-wider border ${
                    playlistFormat === fmt 
                      ? 'bg-[#10B981] border-[#10B981] text-white'
                      : 'bg-stone-50 dark:bg-stone-850 border-stone-200 dark:border-stone-800 text-gray-600 dark:text-stone-400'
                  }`}
                >
                  {fmt} Format
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                Playlist Remote Web URL
              </label>
              <div className="flex gap-2">
                <input 
                  id="ipt_playlist_url"
                  type="url" 
                  placeholder="https://example.com/playlist.m3u"
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  className="flex-1 text-xs px-3.5 py-2 bg-stone-50 dark:bg-stone-850 text-gray-950 dark:text-stone-150 border border-stone-200 dark:border-stone-800 rounded-xl focus:outline-none focus:border-emerald-500"
                />
                <button
                  id="btn_submit_playlist_url"
                  type="submit"
                  disabled={isUrlImporting || !playlistUrl.trim()}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-400 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 min-w-[85px]"
                >
                  {isUrlImporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Add URL</span>
                </button>
              </div>
            </div>
          </form>

          {/* Feedback badge */}
          {importFeedback && (
            <div 
              id="import_feedback_overlay"
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                importFeedback.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/15'
                  : 'bg-amber-500/10 text-amber-600 border border-amber-500/15'
              }`}
            >
              <AlertCircle className="w-4.5 h-4.5 shrink-0" />
              <span>{importFeedback.text}</span>
            </div>
          )}

          {/* Drag & Drop File Container layout */}
          <div 
            id="drag_drop_container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer p-6 rounded-2xl border-2 border-dashed text-center transition-all flex flex-col items-center justify-center gap-2 ${
              isDragOver 
                ? 'border-[#10B981] bg-emerald-500/10 text-[#10B981]'
                : 'border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-850 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <FolderUp className="w-9 h-9 opacity-80" />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-gray-800 dark:text-stone-200">
                Drag & Drop Playlist file here
              </span>
              <span className="text-[11px] text-gray-400 mt-1">
                Supports .m3u, .json or .txt files or click to manual select
              </span>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".m3u,.m3u8,.json,.txt"
              onChange={handleFileSelect}
              className="hidden" 
            />
          </div>
        </div>
      </section>

      {/* 3. Playlist edit & rename registry */}
      <section className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-850 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 flex items-center gap-2">
          <Layers className="w-4.5 h-4.5 text-[#10B981]" /> Active Playlist Registries ({settings.playlists.length})
        </h3>
        <p className="text-xs text-gray-400">Edit, rename, or purge loaded streams registries securely.</p>

        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {settings.playlists.map((pl) => (
            <div 
              id={`playlist_edit_row_${pl.id}`}
              key={pl.id}
              className="p-3 bg-stone-50 dark:bg-stone-855 border border-stone-200 dark:border-stone-800 rounded-2xl flex items-center justify-between gap-3"
            >
              <div className="flex-1 min-w-0">
                {editingPlaylistId === pl.id ? (
                  <div className="flex gap-2">
                    <input
                      id={`input_edit_name_${pl.id}`}
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 text-xs p-1 px-2.5 bg-white dark:bg-stone-800 border rounded-lg text-gray-905 dark:text-white"
                    />
                    <button
                      id={`btn_save_name_${pl.id}`}
                      onClick={() => handleSavePlaylistName(pl.id)}
                      className="p-1 px-2.5 bg-[#10B981] text-white text-[11px] font-bold rounded-lg flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" /> Save
                    </button>
                  </div>
                ) : (
                  <div>
                    <h4 className="font-semibold text-xs text-gray-900 dark:text-white truncate">
                      {pl.name}
                    </h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5">
                      {pl.type} format • {pl.channels.length} channels
                    </p>
                  </div>
                )}
              </div>

              {editingPlaylistId !== pl.id && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    id={`btn_trigger_edit_${pl.id}`}
                    onClick={() => {
                      setEditingPlaylistId(pl.id);
                      setEditingName(pl.name);
                    }}
                    className="p-1.5 hover:bg-stone-200 dark:hover:bg-stone-700 text-gray-500 dark:text-stone-400 rounded-lg transition-colors"
                    title="Rename Playlist Name"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  
                  {pl.id !== 'playlist_sample_default' && (
                    <button
                      id={`btn_delete_pl_${pl.id}`}
                      onClick={() => handleRemovePlaylist(pl.id)}
                      className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-colors"
                      title="Purge playlist list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 4. Player Preferences Configuration */}
      <section className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-850 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 flex items-center gap-2">
          <Volume2 className="w-4.5 h-4.5 text-[#10B981]" /> Media Video Player Preferences
        </h3>

        {/* Scaling Mode Selection Option */}
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-1.5">
              Video Aspect Ratio / Scaling Mode
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['fit', 'fill', 'stretch'] as const).map((mode) => {
                const isSel = settings.playerPrefs.scaleMode === mode;
                return (
                  <button
                    id={`btn_player_pref_scale_${mode}`}
                    key={mode}
                    onClick={() => handleScaleModeChange(mode)}
                    className={`py-1.5 rounded-lg text-xs font-semibold capitalize border transition-all ${
                      isSel 
                        ? 'bg-emerald-500 border-emerald-500 text-white font-bold shadow-xs'
                        : 'bg-stone-50 dark:bg-stone-850 border-stone-200 dark:border-stone-800 text-gray-600'
                    }`}
                  >
                    {mode} Aspect
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">
              * FIT: Preserve original aspect. FILL: Crop to cover panel. STRETCH: Fill container fully.
            </p>
          </div>

          {/* Auto Reconnect */}
          <div className="flex items-center justify-between p-3 bg-stone-100 dark:bg-stone-850 rounded-2xl">
            <div className="flex flex-col pr-3">
              <span className="text-xs font-bold text-gray-800 dark:text-stone-200">
                Auto-Reconnect Stream
              </span>
              <span className="text-[10px] text-gray-400 mt-0.5">
                Automatically retries connection up to 5 times on loss.
              </span>
            </div>
            <input 
              id="pref_checkbox_reconnect"
              type="checkbox" 
              checked={settings.playerPrefs.autoReconnect}
              onChange={(e) => handleAutoReconnectChange(e.target.checked)}
              className="accent-[#10B981] w-5 h-5 rounded-md cursor-pointer" 
            />
          </div>

          {/* Buffer Size slider */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                Max HLS Buffer Target Load
              </label>
              <span className="text-xs font-bold font-mono text-emerald-500">
                {settings.playerPrefs.bufferSize} Seconds
              </span>
            </div>
            <input 
              id="slider_buffer_size"
              type="range" 
              min="10" 
              max="120" 
              step="5"
              value={settings.playerPrefs.bufferSize}
              onChange={(e) => handleBufferSizeChange(parseInt(e.target.value))}
              className="w-full accent-[#10B981] h-1.5 bg-gray-300 dark:bg-stone-800 rounded-lg cursor-pointer" 
            />
          </div>
        </div>
      </section>

      {/* 5. Backup/Restore and Storage Cache clear */}
      <section className="bg-white dark:bg-stone-900 p-5 rounded-3xl border border-stone-200 dark:border-stone-850 shadow-xs space-y-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-stone-100 flex items-center gap-2">
          <Database className="w-4.5 h-4.5 text-[#10B981]" /> Storage Backup & Restore
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            id="btn_backup_export"
            onClick={handleBackup}
            className="flex items-center justify-center gap-2 p-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-850 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs font-bold text-gray-700 dark:text-stone-200 transition-colors"
          >
            <Download className="w-4.5 h-4.5 text-indigo-500" /> Export Backup File (.json)
          </button>

          <label
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 p-3 bg-stone-50 hover:bg-stone-100 dark:bg-stone-850 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl text-xs font-bold text-gray-700 dark:text-stone-200 transition-colors cursor-pointer"
          >
            <Upload className="w-4.5 h-4.5 text-emerald-500" /> Import Backup File (.json)
            <input 
              type="file" 
              accept=".json" 
              onChange={handleRestoreUpload} 
              className="hidden" 
            />
          </label>
        </div>

        <button
          id="btn_clear_data"
          onClick={() => {
            if (confirm('Attention! This action will reset All playlists, favorites, theme preferences, and recents back to default factory clean states. Do you want to continue?')) {
              onClearCache();
              alert('Playlists cleared and cache wiped completely.');
            }
          }}
          className="w-full flex items-center justify-center gap-2 p-3.5 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl text-xs font-extrabold uppercase text-rose-500 transition-all border border-rose-500/10"
        >
          <Trash className="w-4.5 h-4.5" /> Purge Cache & Restore Factory Presets
        </button>
      </section>

      {/* 6. About Section */}
      <section className="bg-stone-900 border border-stone-800 p-5 rounded-3xl text-white shadow-xl space-y-4 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-emerald-500/10 blur-xl rounded-full" />
        
        <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
          <Sparkles className="w-4.5 h-4.5 text-amber-500" /> IPTV Web Player
        </h3>

        <div className="space-y-2.5 text-xs text-stone-300 leading-relaxed">
          <p>
            A high-performance modern web-based IPTV player, featuring:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-stone-400">
            <li>Robust client-side parsers for M3U, M3U8, structured JSON, and TXT channels lists.</li>
            <li>Fluid fluid navigation across channels and categories.</li>
            <li>Local storage persistence directly in your browser.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
