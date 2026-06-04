import { Playlist, Channel } from '../types';

export const SAMPLE_CHANNELS: Channel[] = [
  // --- NEWS ---
  {
    id: 'sample_f24',
    name: 'France 24 English',
    url: 'https://static.france24.com/live/F24_EN_LO_HLS/live_tv.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/France_24_logo_eng.svg/1200px-France_24_logo_eng.svg.png',
    group: 'News',
    order: 0
  },
  {
    id: 'sample_dw',
    name: 'Deutsche Welle News',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015532/dwamdstream102/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Deutsche_Welle_logo_2012.svg/300px-Deutsche_Welle_logo_2012.svg.png',
    group: 'News',
    order: 1
  },
  {
    id: 'sample_nhk',
    name: 'NHK World Japan',
    url: 'https://nhkwlive-ojp.akamaized.net/hls/live/2003459/nhkwlive-ojp-en/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/NHK_World-Japan_logo.svg/330px-NHK_World-Japan_logo.svg.png',
    group: 'News',
    order: 2
  },
  {
    id: 'sample_alj',
    name: 'Al Jazeera English',
    url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Al_Jazeera_English_logo.svg/1200px-Al_Jazeera_English_logo.svg.png',
    group: 'News',
    order: 3
  },
  // --- SCIENCE & NATURE ---
  {
    id: 'sample_nasa',
    name: 'NASA TV Public',
    url: 'https://ntv1.nasatv.live/nasatv/NTV-Public-IPS/playlist.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/NASA_logo.svg/1224px-NASA_logo.svg.png',
    group: 'Science',
    order: 4
  },
  // --- ENTERTAINMENT & MOVIES ---
  {
    id: 'sample_bbb',
    name: 'Big Buck Bunny (Feature Demo)',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_Buck_Bunny_Logo.svg/1200px-Big_Buck_Bunny_Logo.svg.png',
    group: 'Entertainment',
    order: 5
  },
  {
    id: 'sample_sintel',
    name: 'Sintel Animated Stream',
    url: 'https://hls.vimeo.com/external/371433846.hd.m3u8?s=231616c0e81eefb803c9dee26002b8d00339dcfd',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Sintel_logo.png/640px-Sintel_logo.png',
    group: 'Entertainment',
    order: 6
  },
  {
    id: 'sample_elephants',
    name: 'Elephants Dream Movie',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/3/30/Elephants_Dream_Logo.png',
    group: 'Entertainment',
    order: 7
  },
  // --- SPORTS & OUTDOORS ---
  {
    id: 'sample_redbull',
    name: 'Red Bull TV Live',
    url: 'https://rbmn-live.akamaized.net/hls/live/590964/global/master.m3u8',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b3/Red_Bull_logo.svg/640px-Red_Bull_logo.svg.png',
    group: 'Sports',
    order: 8
  }
];

export const DEFAULT_SAMPLE_PLAYLIST: Playlist = {
  id: 'playlist_sample_default',
  name: 'World Free-to-Air live IPTV',
  type: 'm3u',
  source: 'sample',
  lastUpdated: new Date().toISOString(),
  channels: SAMPLE_CHANNELS
};
