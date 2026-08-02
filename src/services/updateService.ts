/**
 * MoodMap — App Update Service
 * Handles version checking, release detection, and update prompts.
 */

import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

export interface AppVersionInfo {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  publishedAt?: string;
}

/**
 * Compare two semver strings (e.g. "1.0.1" vs "1.0.0").
 * Returns > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal.
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = v1.replace(/^v/, '').split('.').map(Number);
  const p2 = v2.replace(/^v/, '').split('.').map(Number);

  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const val1 = p1[i] || 0;
    const val2 = p2[i] || 0;
    if (val1 > val2) return 1;
    if (val1 < val2) return -1;
  }
  return 0;
}

/**
 * Get current installed app version from Expo constants or fallback.
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * Check GitHub latest release or remote manifest for app update.
 */
export async function checkForAppUpdates(): Promise<AppVersionInfo> {
  const currentVersion = getCurrentAppVersion();

  try {
    // 1. Fetch latest release from GitHub API
    const res = await fetch('https://api.github.com/repos/as5104/MooDMap/releases/latest', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const rawTag = (data.tag_name || data.name || '').replace(/^v/, '');
      const latestVersion = rawTag || currentVersion;
      const releaseNotes = data.body || 'Performance enhancements, bug fixes, and stability improvements.';
      const apkAsset = data.assets?.find((a: any) => a.name.endsWith('.apk'));
      const downloadUrl = apkAsset?.browser_download_url || data.html_url || 'https://github.com/as5104/MooDMap/releases';

      const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

      return {
        currentVersion,
        latestVersion,
        hasUpdate,
        releaseNotes,
        downloadUrl,
        publishedAt: data.published_at,
      };
    }
  } catch (err) {
    console.warn('[UpdateService] Remote update check failed:', err);
  }

  // Fallback if network/offline
  return {
    currentVersion,
    latestVersion: currentVersion,
    hasUpdate: false,
    releaseNotes: 'You are running the latest version of MoodMap.',
    downloadUrl: 'https://github.com/as5104/MooDMap/releases',
  };
}

/**
 * Open the download URL in the device browser to download the latest APK/update.
 */
export async function openUpdateDownload(url?: string): Promise<void> {
  const targetUrl = url || 'https://github.com/as5104/MooDMap/releases';
  try {
    await Linking.openURL(targetUrl);
  } catch (err) {
    console.error('[UpdateService] Failed to open download link:', err);
  }
}

/**
 * Download APK directly inside app with progress callback, then trigger native Android Package Installer.
 */
export async function downloadAndInstallUpdate(
  apkUrl: string,
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    await openUpdateDownload(apkUrl);
    return true;
  }

  try {
    const fileUri = `${Paths.cache.uri}/MooDMap-Update.apk`;

    // Resolve direct download URL if GitHub redirects (302/301) to AWS S3
    let targetDownloadUrl = apkUrl;
    try {
      const headRes = await fetch(apkUrl, { method: 'HEAD', redirect: 'follow' });
      if (headRes.url) {
        targetDownloadUrl = headRes.url;
      }
    } catch (_) {
      // Ignore head check error
    }

    let downloadedUri: string | null = null;

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        targetDownloadUrl,
        fileUri,
        {},
        (downloadProgress) => {
          const progress =
            downloadProgress.totalBytesWritten /
            (downloadProgress.totalBytesExpectedToWrite || 120000000);
          if (onProgress) onProgress(Math.min(Math.max(progress, 0.05), 1));
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri && result.status < 400) {
        downloadedUri = result.uri;
      }
    } catch (resumableErr) {
      console.warn('[UpdateService] Resumable download failed, using direct downloadAsync:', resumableErr);
    }

    // Direct downloadAsync fallback if resumable download failed
    if (!downloadedUri) {
      if (onProgress) onProgress(0.5);
      const directResult = await FileSystem.downloadAsync(targetDownloadUrl, fileUri);
      if (directResult && directResult.uri) {
        downloadedUri = directResult.uri;
      }
    }

    if (!downloadedUri) {
      throw new Error('Download failed');
    }

    if (onProgress) onProgress(1);

    // Get content URI for Android Package Installer
    const contentUri = await FileSystem.getContentUriAsync(downloadedUri);

    // Launch Android Package Installer directly without browser redirect
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 268435457, // FLAG_GRANT_READ_URI_PERMISSION (1) | FLAG_ACTIVITY_NEW_TASK (268435456)
      type: 'application/vnd.android.package-archive',
    });

    return true;
  } catch (err) {
    console.warn('[UpdateService] In-app direct update failed, falling back to browser:', err);
    await openUpdateDownload(apkUrl);
    return false;
  }
}
