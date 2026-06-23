/**
 * MoodMap — Audio Cache Manager
 * Uses expo-file-system to cache remote music files locally.
 */

import { File, Paths } from 'expo-file-system';

// Safe alphanumeric character sanitization for filenames
function sanitizeFilename(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Gets the local URI of a track. If it's not cached, it downloads it first.
 * @param trackId Unique identifier of the track
 * @param remoteUrl Secure remote URL of the audio file
 * @param onProgress Optional progress callback (0.0 to 1.0)
 */
export async function getCachedAudioUri(
  trackId: string,
  remoteUrl: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const filename = `music_${sanitizeFilename(trackId)}.mp3`;
  const file = new File(Paths.cache, filename);

  try {
    // 1. Check if the file is already cached using New Architecture API
    if (file.exists) {
      console.log(`[AudioCache] Cache hit for track: ${trackId}`);
      return file.uri;
    }

    // 2. Download from remote if not cached
    console.log(`[AudioCache] Cache miss. Downloading track: ${trackId} from ${remoteUrl}`);
    
    let lastReportedProgress = 0;
    const downloadTask = File.createDownloadTask(
      remoteUrl,
      file,
      {
        onProgress: (downloadProgress) => {
          if (onProgress) {
            const progress = downloadProgress.bytesWritten / downloadProgress.totalBytes;
            const rounded = isNaN(progress) ? 0 : Math.round(progress * 100) / 100;
            if (rounded - lastReportedProgress >= 0.05 || rounded === 1.0) {
              lastReportedProgress = rounded;
              onProgress(rounded);
            }
          }
        }
      }
    );

    const result = await downloadTask.downloadAsync();
    if (result && result.uri) {
      console.log(`[AudioCache] Successfully cached track: ${trackId} to ${result.uri}`);
      return result.uri;
    }

    return remoteUrl;
  } catch (error) {
    console.error(`[AudioCache] Error caching track ${trackId}:`, error);
    return remoteUrl;
  }
}

/**
 * Calculates the total size of all cached music files in Megabytes (MB).
 */
export async function getAudioCacheSize(): Promise<number> {
  try {
    const cacheDir = Paths.cache;
    if (!cacheDir.exists) return 0;

    const contents = cacheDir.list();
    const musicFiles = contents.filter(
      (item): item is File =>
        item instanceof File &&
        item.name.startsWith('music_') &&
        item.name.endsWith('.mp3')
    );

    let totalBytes = 0;
    for (const file of musicFiles) {
      if (file.exists) {
        totalBytes += file.size;
      }
    }

    const sizeInMB = totalBytes / (1024 * 1024);
    return parseFloat(sizeInMB.toFixed(2));
  } catch (error) {
    console.error('[AudioCache] Failed to compute cache size:', error);
    return 0;
  }
}

/**
 * Deletes all cached music files.
 */
export async function clearAudioCache(): Promise<boolean> {
  try {
    const cacheDir = Paths.cache;
    if (!cacheDir.exists) return false;

    const contents = cacheDir.list();
    const musicFiles = contents.filter(
      (item): item is File =>
        item instanceof File &&
        item.name.startsWith('music_') &&
        item.name.endsWith('.mp3')
    );

    for (const file of musicFiles) {
      if (file.exists) {
        file.delete();
      }
    }

    console.log(`[AudioCache] Safely cleared ${musicFiles.length} cached track files.`);
    return true;
  } catch (error) {
    console.error('[AudioCache] Error clearing cache:', error);
    return false;
  }
}
