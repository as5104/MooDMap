/**
 * MoodMap — VIP Tier Store
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { cancelPendingPlayback, clearSpotifyRequestCache } from '../services/spotify';

// SecureStore keys
const KEYS = {
  IS_VIP: 'moodmap_is_vip',
  VIP_STATUS: 'moodmap_vip_status',
  VIP_UNLOCKED_AT: 'moodmap_vip_unlocked_at',
  SPOTIFY_ACCESS_TOKEN: 'moodmap_spotify_access',
  SPOTIFY_REFRESH_TOKEN: 'moodmap_spotify_refresh',
  SPOTIFY_TOKEN_EXPIRY: 'moodmap_spotify_expiry',
} as const;

// Dedup concurrent token refresh calls to avoid race conditions
let _refreshPromise: Promise<string | null> | null = null;
let credentialRevision = 0;
let spotifySessionGeneration = 0;
export function getSpotifySessionGeneration(): number { return spotifySessionGeneration; }
let refreshRetryAt = 0;
let credentialWrites: Promise<unknown> = Promise.resolve();
function persistCredentials(task: () => Promise<unknown>): Promise<unknown> {
  const result = credentialWrites.then(task);
  credentialWrites = result.catch(() => {});
  return result;
}

interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp ms
}

interface TierState {
  // VIP
  isVIP: boolean;
  vipStatus: 'none' | 'pending' | 'approved' | 'declined';
  vipUnlockedAt: string | null;
  isLoadingTier: boolean;

  // Spotify
  spotifyConnected: boolean;
  spotifyTokens: SpotifyTokens | null;

  // Actions
  loadTierState: () => Promise<void>;
  checkVIPStatus: (userId: string, email?: string) => Promise<void>;
  requestVIPAccess: (userId: string, email: string) => Promise<boolean>;
  deactivateVIP: () => Promise<void>;
  setSpotifyTokens: (tokens: SpotifyTokens) => Promise<void>;
  clearSpotifyTokens: () => Promise<void>;
  getValidAccessToken: () => Promise<string | null>;
}

export const useTierStore = create<TierState>((set, get) => ({
  // Initial state
  isVIP: false,
  vipStatus: 'none',
  vipUnlockedAt: null,
  isLoadingTier: true,
  spotifyConnected: false,
  spotifyTokens: null,

  /**
   * Load persisted VIP state and Spotify tokens from SecureStore
   */
  loadTierState: async () => {
    const revision = credentialRevision;
    try {
      const [isVip, status, unlockedAt, accessToken, refreshToken, expiry] =
        await Promise.all([
          SecureStore.getItemAsync(KEYS.IS_VIP),
          SecureStore.getItemAsync(KEYS.VIP_STATUS),
          SecureStore.getItemAsync(KEYS.VIP_UNLOCKED_AT),
          SecureStore.getItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN),
          SecureStore.getItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN),
          SecureStore.getItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY),
        ]);

      if (revision !== credentialRevision) return;
      const vipActive = isVip === 'true';
      const hasSpotify = !!(accessToken && refreshToken);

      set({
        isVIP: vipActive,
        vipStatus: (status as any) || (vipActive ? 'approved' : 'none'),
        vipUnlockedAt: unlockedAt,
        spotifyConnected: vipActive && hasSpotify,
        spotifyTokens: hasSpotify
          ? {
              accessToken: accessToken!,
              refreshToken: refreshToken!,
              expiresAt: expiry ? parseInt(expiry, 10) : 0,
            }
          : null,
        isLoadingTier: false,
      });
    } catch (e) {
      console.error('[Tier] Failed to load tier state:', e);
      set({ isLoadingTier: false });
    }
  },

  /**
   * Check VIP approval status from Supabase backend
   */
  checkVIPStatus: async (userId: string, email?: string) => {
    const generation = spotifySessionGeneration;
    try {
      const { supabase } = require('../lib/supabase');
      const { data, error } = await supabase
        .from('vip_requests')
        .select('status, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      if (generation !== spotifySessionGeneration) return;

      if (data) {
        const status = data.status as 'pending' | 'approved' | 'declined';
        const isVip = status === 'approved';
        const unlockedAt = isVip ? data.updated_at : null;

        await persistCredentials(() => Promise.all([
          SecureStore.setItemAsync(KEYS.IS_VIP, isVip ? 'true' : 'false'),
          SecureStore.setItemAsync(KEYS.VIP_STATUS, status),
          unlockedAt
            ? SecureStore.setItemAsync(KEYS.VIP_UNLOCKED_AT, unlockedAt)
            : SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        ]));

        if (generation !== spotifySessionGeneration) return;
        set({
          vipStatus: status,
          isVIP: isVip,
          vipUnlockedAt: unlockedAt,
        });
      } else {
        // If no request exists, default to none
        await persistCredentials(() => Promise.all([
          SecureStore.setItemAsync(KEYS.IS_VIP, 'false'),
          SecureStore.setItemAsync(KEYS.VIP_STATUS, 'none'),
          SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        ]));

        if (generation !== spotifySessionGeneration) return;
        set({ vipStatus: 'none', isVIP: false, vipUnlockedAt: null });
      }
    } catch (e) {
      console.error('[Tier] Failed to check VIP status:', e);
    }
  },

  /**
   * Create/Upsert a VIP request in Supabase
   */
  requestVIPAccess: async (userId: string, email: string): Promise<boolean> => {
    const generation = spotifySessionGeneration;
    try {
      const { supabase } = require('../lib/supabase');
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('vip_requests')
        .upsert({
          user_id: userId,
          email: email,
          status: 'pending',
          updated_at: now,
        });

      if (error) throw error;
      if (generation !== spotifySessionGeneration) return false;

      await persistCredentials(() => Promise.all([
        SecureStore.setItemAsync(KEYS.IS_VIP, 'false'),
        SecureStore.setItemAsync(KEYS.VIP_STATUS, 'pending'),
      ]));

      if (generation !== spotifySessionGeneration) return false;
      set({ vipStatus: 'pending', isVIP: false });
      return true;
    } catch (e) {
      console.error('[Tier] Failed to submit VIP request:', e);
      return false;
    }
  },

  /**
   * Deactivate VIP and clear all local and remote Spotify states
   */
  deactivateVIP: async () => {
    credentialRevision++;
    spotifySessionGeneration++;
    set({ isVIP: false, vipStatus: 'none', vipUnlockedAt: null, spotifyConnected: false, spotifyTokens: null, isLoadingTier: false });
    cancelPendingPlayback();
    clearSpotifyRequestCache();
    try {
      await persistCredentials(() => Promise.all([
        SecureStore.deleteItemAsync(KEYS.IS_VIP),
        SecureStore.deleteItemAsync(KEYS.VIP_STATUS),
        SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY),
      ]));
    } catch (e) {
      console.error('[Tier] VIP deactivation failed:', e);
    }
  },

  /**
   * Store Spotify OAuth tokens securely
   */
  setSpotifyTokens: async (tokens: SpotifyTokens) => {
    const revision = ++credentialRevision;
    refreshRetryAt = 0;
    try {
      await persistCredentials(() => Promise.all([
        SecureStore.setItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN, tokens.accessToken),
        SecureStore.setItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN, tokens.refreshToken),
        SecureStore.setItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY, String(tokens.expiresAt)),
      ]));
      if (revision === credentialRevision) set({ spotifyConnected: true, spotifyTokens: tokens });
    } catch (e) {
      console.error('[Tier] Failed to save Spotify tokens:', e);
    }
  },

  /**
   * Clear Spotify tokens (disconnect)
   */
  clearSpotifyTokens: async () => {
    credentialRevision++;
    spotifySessionGeneration++;
    set({ spotifyConnected: false, spotifyTokens: null });
    cancelPendingPlayback();
    clearSpotifyRequestCache();
    try {
      await persistCredentials(() => Promise.all([
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY),
      ]));
    } catch (e) {
      console.error('[Tier] Failed to clear Spotify tokens:', e);
    }
  },

  /**
   * Get a valid access token, refreshing if expired.
   * Returns null if no tokens are available.
   */
  getValidAccessToken: async (): Promise<string | null> => {
    const { spotifyTokens, spotifyConnected } = get();
    if (!spotifyConnected || !spotifyTokens) return null;

    // Check if token is still valid (with 60s buffer)
    const now = Date.now();
    if (spotifyTokens.expiresAt > now + 60_000) {
      return spotifyTokens.accessToken;
    }

    // Deduplicate concurrent refresh calls — if one is already in-flight, reuse it
    if (_refreshPromise) return _refreshPromise;
    if (Date.now() < refreshRetryAt) return spotifyTokens.expiresAt > Date.now() ? spotifyTokens.accessToken : null;
    const revision = credentialRevision;

    _refreshPromise = (async () => {
      try {
        const { refreshSpotifyToken } = require('../services/spotify');
        const res = await refreshSpotifyToken(spotifyTokens.refreshToken);
        if (revision !== credentialRevision) return null;
        if (res.tokens) {
          await get().setSpotifyTokens(res.tokens);
          return get().spotifyTokens?.accessToken === res.tokens.accessToken ? res.tokens.accessToken : null;
        } else if (res.isRevoked) {
          console.warn('[Tier] Spotify refreshToken is revoked. Clearing stored credentials.');
          await get().clearSpotifyTokens();
        } else {
          refreshRetryAt = Date.now() + Math.max(30_000, res.retryAfterMs ?? 0);
          // During the early-refresh buffer the existing token may still be usable.
          if (spotifyTokens.expiresAt > Date.now()) return spotifyTokens.accessToken;
        }
      } catch (e) {
        refreshRetryAt = Date.now() + 30_000;
        console.error('[Tier] Token refresh failed:', e);
        if (revision === credentialRevision && spotifyTokens.expiresAt > Date.now()) return spotifyTokens.accessToken;
      }
      return null;
    })();

    try {
      return await _refreshPromise;
    } finally {
      _refreshPromise = null;
    }
  },
}));
