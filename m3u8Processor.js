import { File, Directory, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

const VIDEO_ASPECT_RATIO = 9 / 16;
const CACHE_LIFETIME_DAYS = 7;

export function extractNameFromUrl(url) {
  try {
    const parts = url.split('/');
    const datePart = parts.find(p => /^\d{8}$/.test(p)) || 'nodate';
    const idPart = parts[parts.length - 2] || 'playlist';
    return `${datePart}_${idPart}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  } catch {
    return 'playlist';
  }
}

export async function cleanupOldCache() {
  try {
    const cacheDir = Paths.cache;
    const directory = new Directory(cacheDir);
    const files = directory.list();

    const now = Date.now();
    const expiry = CACHE_LIFETIME_DAYS * 24 * 60 * 60 * 1000;

    for (const file of files) {
      if (file.name.endsWith('.m3u8')) {
        if (file.modificationTime && now - file.modificationTime > expiry) {
          file.delete();
        }
      }
    }
  } catch (err) {
    console.warn('cleanupOldCache error:', err);
  }
}

function cleanManifest(manifest) {
  const rules = [
    [/\n#EXT-X-DISCONTINUITY\n#EXT-X-KEY:METHOD=NONE[\s\S]*?#EXT-X-DISCONTINUITY\n/g, "\n"],
    [/\n#EXT-X-DISCONTINUITY(?:\n#EXTINF:[\d.]+,\n.*?){10,18}\n#EXT-X-DISCONTINUITY/g, "\n"],
    [/#EXT-X-DISCONTINUITY\n/g, ""],
    [/\/convertv7\//g, "/"],
    [/\n{2,}/g, "\n"],
  ];

  return rules.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    manifest
  ).trim();
}

export async function fetchAndProcessPlaylist(playlistUrl) {
  try {
    await cleanupOldCache();

    const res = await fetch(playlistUrl);
    if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);

    let text = await res.text();
    text = text.replace(/^[^#].*$/gm, (line) => {
      try {
        const parsed = new URL(line, playlistUrl);
        return parsed.toString();
      } catch {
        return line;
      }
    });

    if (text.includes('#EXT-X-STREAM-INF')) {
      const subUrl = text
        .trim()
        .split('\n')
        .filter(line => !line.startsWith('#') && line.trim() !== '')
        .slice(-1)[0];
      if (subUrl) return fetchAndProcessPlaylist(subUrl);
    }

    const processed = cleanManifest(text);
    const fileName = `${extractNameFromUrl(playlistUrl)}.m3u8`;
    const file = new File(Paths.cache, fileName);

    file.write(processed);
    return file.uri;
  } catch (e) {
    return playlistUrl;
  }
}

export const getVideoHeight = (screenWidth, screenHeight) => {
  if (screenWidth > screenHeight) {
    const videoWidthInLandscape = screenWidth / 2;
    return videoWidthInLandscape * VIDEO_ASPECT_RATIO;
  } else {
    return screenWidth * VIDEO_ASPECT_RATIO;
  }
};

export const CONSTANTS = {
  HISTORY_KEY_PREFIX: 'history_',
  SAVE_INTERVAL_MS: 10000,
  VIDEO_ASPECT_RATIO,
};
