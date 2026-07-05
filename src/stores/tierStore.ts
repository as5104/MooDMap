/**
 * MoodMap — VIP Tier Store
 */

import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

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
    try {
      const { supabase } = require('../lib/supabase');
      const { data, error } = await supabase
        .from('vip_requests')
        .select('status, updated_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const status = data.status as 'pending' | 'approved' | 'declined';
        const isVip = status === 'approved';
        const unlockedAt = isVip ? data.updated_at : null;

        await Promise.all([
          SecureStore.setItemAsync(KEYS.IS_VIP, isVip ? 'true' : 'false'),
          SecureStore.setItemAsync(KEYS.VIP_STATUS, status),
          unlockedAt
            ? SecureStore.setItemAsync(KEYS.VIP_UNLOCKED_AT, unlockedAt)
            : SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        ]);

        set({
          vipStatus: status,
          isVIP: isVip,
          vipUnlockedAt: unlockedAt,
        });
      } else {
        // If no request exists, default to none
        await Promise.all([
          SecureStore.setItemAsync(KEYS.IS_VIP, 'false'),
          SecureStore.setItemAsync(KEYS.VIP_STATUS, 'none'),
          SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        ]);

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

      await Promise.all([
        SecureStore.setItemAsync(KEYS.IS_VIP, 'false'),
        SecureStore.setItemAsync(KEYS.VIP_STATUS, 'pending'),
      ]);

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
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.IS_VIP),
        SecureStore.deleteItemAsync(KEYS.VIP_STATUS),
        SecureStore.deleteItemAsync(KEYS.VIP_UNLOCKED_AT),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY),
      ]);

      set({
        isVIP: false,
        vipStatus: 'none',
        vipUnlockedAt: null,
        spotifyConnected: false,
        spotifyTokens: null,
      });
    } catch (e) {
      console.error('[Tier] VIP deactivation failed:', e);
    }
  },

  /**
   * Store Spotify OAuth tokens securely
   */
  setSpotifyTokens: async (tokens: SpotifyTokens) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN, tokens.accessToken),
        SecureStore.setItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN, tokens.refreshToken),
        SecureStore.setItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY, String(tokens.expiresAt)),
      ]);

      set({ spotifyConnected: true, spotifyTokens: tokens });
    } catch (e) {
      console.error('[Tier] Failed to save Spotify tokens:', e);
    }
  },

  /**
   * Clear Spotify tokens (disconnect)
   */
  clearSpotifyTokens: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_ACCESS_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_REFRESH_TOKEN),
        SecureStore.deleteItemAsync(KEYS.SPOTIFY_TOKEN_EXPIRY),
      ]);

      set({ spotifyConnected: false, spotifyTokens: null });
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

    _refreshPromise = (async () => {
      try {
        const { refreshSpotifyToken } = require('../services/spotify');
        const newTokens = await refreshSpotifyToken(spotifyTokens.refreshToken);
        if (newTokens) {
          await get().setSpotifyTokens(newTokens);
          return newTokens.accessToken;
        }
      } catch (e) {
        console.error('[Tier] Token refresh failed:', e);
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
