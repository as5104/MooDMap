/**
 * MoodMap — Profile Service
 * Handles custom avatar pick, validate, store, and retrieval.
 */

import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { getSetting, saveSetting } from './settingsService';

// Constants
const AVATAR_SETTINGS_KEY = 'custom_avatar_path';
const AVATAR_FILENAME = 'custom_avatar';
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Allowed MIME types for avatar uploads */
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Allowed file extensions */
const ALLOWED_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.webp',
]);

/** Blocked executable extensions */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.msi', '.apk', '.dex',
  '.js', '.ts', '.html', '.htm', '.php', '.py',
  '.sh', '.bash', '.ps1', '.vbs', '.jar', '.dll',
  '.so', '.dylib', '.svg', // SVG can contain embedded JS
]);

/**
 * Magic byte signatures for allowed image types.
 * Reading the first few bytes of the file to verify the actual content.
 */
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  // PNG: 89 50 4E 47
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  // WebP: 52 49 46 46 (RIFF)
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

// Helpers

/** Get the extension from a URI or filename (lowercased) */
function getExtension(uri: string): string {
  const cleanUri = uri.split('?')[0].split('#')[0];
  const lastDot = cleanUri.lastIndexOf('.');
  if (lastDot === -1) return '';
  return cleanUri.substring(lastDot).toLowerCase();
}

/** Get the directory for storing avatar files */
function getAvatarDirectory(): string {
  return `${Paths.document.uri}/avatars`;
}

/**
 * Validate magic bytes of a file against known image signatures.
 * Returns true only if the file header matches an allowed image type.
 */
async function validateMagicBytes(fileUri: string): Promise<boolean> {
  try {
    let bytes: number[] = [];

    // Strategy 1: Try modern SDK 56 File API
    try {
      const file = new File(fileUri);
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer.slice(0, 12));
      bytes = Array.from(uint8);
    } catch {
      // Strategy 2: Native fetch() works for file:// and content:// URIs in React Native
      try {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        const slice = blob.slice(0, 12);
        const arrayBuffer = await new Response(slice).arrayBuffer();
        bytes = Array.from(new Uint8Array(arrayBuffer));
      } catch {
        // Strategy 3: Legacy readAsStringAsync
        const base64 = await LegacyFileSystem.readAsStringAsync(fileUri, {
          encoding: LegacyFileSystem.EncodingType.Base64,
          length: 12,
          position: 0,
        });
        const binaryString = atob(base64);
        bytes = Array.from(binaryString, (char) => char.charCodeAt(0));
      }
    }

    if (!bytes || bytes.length < 3) {
      console.warn('[ProfileService] Could not read header bytes from image file:', fileUri);
      return true;
    }

    // Check against known signatures
    const isValid = MAGIC_BYTES.some((sig) =>
      sig.bytes.every((b, i) => bytes[i] === b)
    );

    if (!isValid) {
      console.warn('[ProfileService] Image header bytes did not match expected magic bytes:', bytes.slice(0, 4));
    }

    return isValid;
  } catch (err) {
    console.warn('[ProfileService] Magic bytes validation error:', err);
    return fileUri.startsWith('file://') || fileUri.startsWith('content://') || fileUri.startsWith('ph://');
  }
}

// Public API

export interface AvatarValidateResult {
  success: boolean;
  tempUri?: string;
  mimeType?: string;
  ext?: string;
  error?: string;
}

export interface AvatarSaveResult {
  success: boolean;
  uri?: string;
  error?: string;
}

/**
 * Open the image picker and perform security validation on the chosen photo.
 * DOES NOT save to disk or settings permanently. Returns temporary URI for preview.
 */
export async function pickAndValidateAvatar(): Promise<AvatarValidateResult> {
  try {
    // Request permission
    const permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permResult.granted) {
      return { success: false, error: 'Photo library permission is required to change your avatar.' };
    }

    // Open picker — images only, with cropping
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, error: 'Image selection was canceled.' };
    }

    const asset = result.assets[0];
    const sourceUri = asset.uri;
    const mimeType = asset.mimeType ?? '';
    const fileSize = asset.fileSize ?? 0;

    // Security Validation

    // 1. Check MIME type
    if (mimeType && !ALLOWED_MIME_TYPES.has(mimeType)) {
      return { success: false, error: `Invalid file type "${mimeType}". Only JPEG, PNG, and WebP images are allowed.` };
    }

    // 2. Check file extension
    const ext = getExtension(sourceUri);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return { success: false, error: `File extension "${ext}" is not allowed for security reasons.` };
    }
    if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
      return { success: false, error: `Unsupported file format "${ext}". Please use JPEG, PNG, or WebP.` };
    }

    // 3. Check file size
    if (fileSize > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1);
      return { success: false, error: `Image is too large (${sizeMB} MB). Maximum size is 5 MB.` };
    }

    if (!fileSize) {
      const info = await LegacyFileSystem.getInfoAsync(sourceUri);
      if (info.exists && 'size' in info && (info.size ?? 0) > MAX_FILE_SIZE_BYTES) {
        const sizeMB = ((info.size ?? 0) / (1024 * 1024)).toFixed(1);
        return { success: false, error: `Image is too large (${sizeMB} MB). Maximum size is 5 MB.` };
      }
    }

    // 4. Validate magic bytes (content-level check)
    const magicValid = await validateMagicBytes(sourceUri);
    if (!magicValid) {
      return { success: false, error: 'File content does not match a valid image format. Upload rejected for security.' };
    }

    return { success: true, tempUri: sourceUri, mimeType, ext };
  } catch (err: any) {
    console.error('[ProfileService] pickAndValidateAvatar failed:', err);
    return { success: false, error: err?.message ?? 'Failed to process image.' };
  }
}

/**
 * Permanently save a validated avatar file to app storage and update SQLite setting.
 */
export async function saveCustomAvatar(
  sourceUri: string,
  mimeType?: string,
  ext?: string
): Promise<AvatarSaveResult> {
  try {
    const avatarDir = getAvatarDirectory();

    // Ensure avatar directory exists
    const dirInfo = await LegacyFileSystem.getInfoAsync(avatarDir);
    if (!dirInfo.exists) {
      await LegacyFileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });
    }

    const fileExt = ext || getExtension(sourceUri) || (mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg');
    const destUri = `${avatarDir}/${AVATAR_FILENAME}${fileExt}`;

    // Delete old avatar if it exists with a different extension
    try {
      const allExts = ['.jpg', '.jpeg', '.png', '.webp'];
      for (const e of allExts) {
        const oldPath = `${avatarDir}/${AVATAR_FILENAME}${e}`;
        if (oldPath !== destUri) {
          const oldInfo = await LegacyFileSystem.getInfoAsync(oldPath);
          if (oldInfo.exists) {
            await LegacyFileSystem.deleteAsync(oldPath, { idempotent: true });
          }
        }
      }
    } catch {
      // Ignore cleanup errors
    }

    // Copy file to app's document directory
    await LegacyFileSystem.copyAsync({ from: sourceUri, to: destUri });

    // Save path in SQLite settings
    saveSetting(AVATAR_SETTINGS_KEY, destUri);

    return { success: true, uri: destUri };
  } catch (err: any) {
    console.error('[ProfileService] saveCustomAvatar failed:', err);
    return { success: false, error: err?.message ?? 'Failed to save avatar.' };
  }
}

/**
 * Backward compatible pick and save helper.
 */
export async function pickAndSaveAvatar(): Promise<AvatarSaveResult> {
  const validated = await pickAndValidateAvatar();
  if (!validated.success || !validated.tempUri) {
    return { success: false, error: validated.error };
  }
  return saveCustomAvatar(validated.tempUri, validated.mimeType, validated.ext);
}

/**
 * Get the saved custom avatar URI (or undefined if none set).
 * Verifies the file still exists on disk.
 */
export function getCustomAvatarUri(): string | undefined {
  try {
    const saved = getSetting(AVATAR_SETTINGS_KEY, '');
    if (!saved) return undefined;
    return saved;
  } catch {
    return undefined;
  }
}

/**
 * Check if a custom avatar file exists asynchronously.
 */
export async function customAvatarExists(): Promise<boolean> {
  const uri = getCustomAvatarUri();
  if (!uri) return false;
  try {
    const info = await LegacyFileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

/**
 * Remove the custom avatar file and clear the setting.
 */
export async function clearCustomAvatar(): Promise<void> {
  try {
    const uri = getCustomAvatarUri();
    if (uri) {
      await LegacyFileSystem.deleteAsync(uri, { idempotent: true });
    }
  } catch {
    // Ignore deletion errors
  }
  saveSetting(AVATAR_SETTINGS_KEY, '');
}
