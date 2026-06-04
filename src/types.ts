export interface Channel {
  id: string;
  name: string;
  url: string;
  logo: string;
  group: string; // Category or Group
  order: number;
}

export interface Playlist {
  id: string;
  name: string;
  type: 'm3u' | 'm3u8' | 'json' | 'txt';
  source: 'url' | 'file' | 'sample';
  url?: string;
  lastUpdated: string;
  channels: Channel[];
}

export interface PlayerPreferences {
  autoReconnect: boolean;
  bufferSize: number; // in seconds
  scaleMode: 'fit' | 'fill' | 'stretch';
  audioTrack: string;
}

export interface SavedSettings {
  theme: 'light' | 'dark' | 'system';
  favorites: string[]; // List of channel URLs or unique IDs (e.g., "${playlistId}::${channelName}")
  recentChannels: string[]; // List of channel URLs
  playlists: Playlist[];
  playerPrefs: PlayerPreferences;
}
