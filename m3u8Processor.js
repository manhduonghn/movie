import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const VIDEO_ASPECT_RATIO = 9 / 16; 

function cleanManifest(manifest) {
    let cleanedManifest = manifest
        .replace(/\n#EXT-X-DISCONTINUITY\n#EXT-X-KEY:METHOD=NONE[\s\S]*?#EXT-X-DISCONTINUITY\n/g, '\n')
        .replace(/#EXT-X-DISCONTINUITY\n/g, '')
        .replace(/\/convertv7\//g, '/')
        .replace(/\n{2,}/g, '\n')
        .trim();
    return cleanedManifest;
}

export async function fetchAndProcessPlaylist(playlistUrl) {
    let req;
    try {
        req = await fetch(playlistUrl);
        if (!req.ok) throw new Error(`Failed to fetch playlist: ${req.statusText}`);
    } catch (error) {
        return playlistUrl; 
    }

    let playlistText = await req.text();
    playlistText = playlistText.replace(/^[^#].*$/gm, (line) => {
        try {
            const parsedUrl = new URL(line, playlistUrl);
            return parsedUrl.toString();
        } catch {
            return line;
        }
    });

    if (playlistText.includes('#EXT-X-STREAM-INF')) {
        const subPlaylistUrl = playlistText.trim().split('\n').filter(line => !line.startsWith('#') && line.trim() !== '').slice(-1)[0];
        if (subPlaylistUrl) {
            return fetchAndProcessPlaylist(subPlaylistUrl);
        }
    }

    const processedPlaylist = cleanManifest(playlistText);
    const fileUri = `${FileSystem.cacheDirectory}processed_playlist_${Date.now()}.m3u8`;
    
    try {
        await FileSystem.writeAsStringAsync(fileUri, processedPlaylist, { encoding: 'utf8' });
        
        if (Platform.OS === 'android') {
            const contentUri = await FileSystem.getContentUriAsync(fileUri);
            return contentUri;
        } else {
            return fileUri;
        }

    } catch (e) {
        return playlistUrl; 
    }
}

export const getVideoHeight = (screenWidth, screenHeight) => {
    
    if (screenWidth > screenHeight) {
        const videoWidthInLandscape = screenWidth / 2; 
        const calculatedHeight = videoWidthInLandscape * VIDEO_ASPECT_RATIO;
        return calculatedHeight; 
    } else {
        return screenWidth * VIDEO_ASPECT_RATIO;
    }
};

export const CONSTANTS = {
    HISTORY_KEY_PREFIX: 'history_',
    SAVE_INTERVAL_MS: 10000, 
    VIDEO_ASPECT_RATIO,
};
