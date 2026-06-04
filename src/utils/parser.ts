import { Channel } from '../types';

/**
 * Robustly parses an M3U playlist file content.
 */
export function parseM3U(content: string): Channel[] {
  const lines = content.split('\n');
  const channels: Channel[] = [];
  let currentGroup = 'Uncategorized';
  let currentLogo = '';
  let currentName = '';
  let idCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      // Parse metadata from EXTINF line
      // Format: #EXTINF:-1 tvg-id="ID" tvg-name="Name" tvg-logo="https://..." group-title="News",Channel Name
      currentLogo = '';
      currentGroup = 'Uncategorized';

      // Parse tvg-logo
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch) {
        currentLogo = logoMatch[1];
      }

      // Parse group-title
      const groupMatch = line.match(/group-title="([^"]+)"/i);
      if (groupMatch) {
        currentGroup = groupMatch[1];
      }

      // Channel name is everything after the last comma
      const commaIndex = line.lastIndexOf(',');
      if (commaIndex !== -1) {
        currentName = line.substring(commaIndex + 1).trim();
      } else {
        currentName = 'Unknown Channel';
      }
    } else if (line.startsWith('#')) {
      // Other comment or unknown directive, ignore or parse additional metadata if needed
      continue;
    } else if (line.startsWith('http://') || line.startsWith('https://') || line.includes('://')) {
      // This line is the stream URL
      if (currentName === '') {
        currentName = `Channel ${idCounter}`;
      }
      channels.push({
        id: `chan_${Date.now()}_${idCounter++}`,
        name: currentName,
        url: line,
        logo: currentLogo || getPlaceholderLogo(currentName),
        group: currentGroup,
        order: channels.length,
      });
      // Reset for next channel
      currentName = '';
      currentLogo = '';
    }
  }

  return channels;
}

/**
 * Parses JSON channel lists.
 * Supports standard arrays of channel objects.
 */
export function parseJSON(content: string): Channel[] {
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      throw new Error('JSON format is not an array');
    }

    return data.map((item: any, index: number) => {
      const name = item.name || item.title || `Channel ${index + 1}`;
      return {
        id: item.id || `chan_${Date.now()}_${index}`,
        name: name,
        url: item.url || item.streamUrl || item.link || '',
        logo: item.logo || item.logoUrl || item.icon || getPlaceholderLogo(name),
        group: item.group || item.category || 'Uncategorized',
        order: index,
      };
    }).filter(c => c.url); // filter out empty URLs
  } catch (e) {
    console.error('Failed to parse JSON playlist:', e);
    return [];
  }
}

/**
 * Parses TXT channel lists.
 * Supported format formats:
 * Format A: Name, URL
 * Format B: Alternating lines
 *   Name
 *   URL
 */
export function parseTXT(content: string): Channel[] {
  const lines = content.split('\n').map(l => l.trim()).filter(l => l);
  const channels: Channel[] = [];
  let idCounter = 1;

  // Let's analyze if it looks like comma separated (Format A) or alternating (Format B)
  const isCommaSeparated = lines.some(l => l.includes(',') && (l.includes('://') || l.match(/https?:\/\//)));

  if (isCommaSeparated) {
    for (const line of lines) {
      const commaIndex = line.indexOf(',');
      if (commaIndex !== -1) {
        const name = line.substring(0, commaIndex).trim();
        const url = line.substring(commaIndex + 1).trim();
        if (url.startsWith('http')) {
          channels.push({
            id: `chan_txt_${Date.now()}_${idCounter++}`,
            name,
            url,
            logo: getPlaceholderLogo(name),
            group: 'Uncategorized',
            order: channels.length,
          });
        }
      }
    }
  } else {
    // Alternating format
    for (let i = 0; i < lines.length - 1; i += 2) {
      const name = lines[i];
      const url = lines[i + 1];
      if (url && (url.startsWith('http://') || url.startsWith('https://') || url.includes('://'))) {
        channels.push({
          id: `chan_txt_${Date.now()}_${idCounter++}`,
          name,
          url,
          logo: getPlaceholderLogo(name),
          group: 'Uncategorized',
          order: channels.length,
        });
      } else {
        // Fallback: search next lines or just step by 1
        i--; // decrement to check next lines
      }
    }
  }

  return channels;
}

/**
 * Simple generator for dynamic elegant channel logos based on stream name initials.
 */
export function getPlaceholderLogo(name: string): string {
  const cleanName = name.replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const parts = cleanName.split(' ');
  let initials = '';
  if (parts.length > 0 && parts[0]) initials += parts[0][0];
  if (parts.length > 1 && parts[1]) initials += parts[1][0];
  if (!initials) initials = 'TV';

  // Seeded color based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'EF4444', 'F97316', 'F59E0B', '10B981', '06B6D4',
    '3B82F6', '6366F1', '8B5CF6', 'EC4899', '14B8A6'
  ];
  const colorIndex = Math.abs(hash) % colors.length;
  const color = colors[colorIndex];

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=128&bold=true`;
}
