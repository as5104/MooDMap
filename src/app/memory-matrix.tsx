/**
 * MoodMap — Memory Matrix (Cognitive Focus & Mindful Flow Game)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GradientBackground, Button } from '@/components/ui';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing, Radius, SCREEN_PADDING } from '@/constants/layout';
import { getSetting, saveSetting } from '@/services/settingsService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const GRID_SIZE = 9; // 3x3 grid

const TILE_COLORS = [
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#84CC16', // Lime
  '#F43F5E', // Rose
  '#14B8A6', // Teal
];

type GameState = 'idle' | 'showing' | 'player' | 'success' | 'failure';

const BEST_SCORE_KEY = 'memory_matrix_best_level';

export default function MemoryMatrixScreen() {
  const insets = useSafeAreaInsets();
  const [level, setLevel] = useState(1);
  const [sequence, setSequence] = useState<number[]>([]);
  const [playerInputIndex, setPlayerInputIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [activeFlashIndex, setActiveFlashIndex] = useState<number | null>(null);
  const [bestLevel, setBestLevel] = useState(1);
  const [isNewBest, setIsNewBest] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved high score from SQLite on mount
  useEffect(() => {
    try {
      const saved = getSetting(BEST_SCORE_KEY, '1');
      const parsed = parseInt(saved, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setBestLevel(parsed);
      }
    } catch (e) {
      console.log('[MemoryMatrix] Failed to load best score:', e);
    }
  }, []);

  const saveNewBestLevel = useCallback((newBest: number) => {
    setBestLevel(newBest);
    setIsNewBest(true);
    try {
      saveSetting(BEST_SCORE_KEY, String(newBest));
    } catch (e) {
      console.log('[MemoryMatrix] Failed to save best score:', e);
    }
  }, []);

  const startNewGame = useCallback(() => {
    setLevel(1);
    setIsNewBest(false);
    const initialStepCount = 3;
    const initialSeq: number[] = [];
    for (let i = 0; i < initialStepCount; i++) {
      initialSeq.push(Math.floor(Math.random() * GRID_SIZE));
    }
    setSequence(initialSeq);
    setGameState('showing');
    playSequence(initialSeq);
  }, []);

  const playSequence = (seq: number[]) => {
    setGameState('showing');
    setActiveFlashIndex(null);

    seq.forEach((tileIdx, stepIdx) => {
      setTimeout(() => {
        setActiveFlashIndex(tileIdx);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        setTimeout(() => {
          setActiveFlashIndex(null);
          if (stepIdx === seq.length - 1) {
            setGameState('player');
            setPlayerInputIndex(0);
          }
        }, 450);
      }, (stepIdx + 1) * 750);
    });
  };

  const advanceLevel = (currentSeq: number[]) => {
    const nextLevel = level + 1;
    setLevel(nextLevel);

    if (nextLevel > bestLevel) {
      saveNewBestLevel(nextLevel);
    }

    const nextSeq = [...currentSeq, Math.floor(Math.random() * GRID_SIZE)];
    setSequence(nextSeq);
    setGameState('showing');

    setTimeout(() => {
      playSequence(nextSeq);
    }, 800);
  };

  const handleTilePress = (tileIndex: number) => {
    if (gameState !== 'player') return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFlashIndex(tileIndex);
    setTimeout(() => setActiveFlashIndex(null), 250);

    const expectedTile = sequence[playerInputIndex];

    if (tileIndex === expectedTile) {
      const nextInputIdx = playerInputIndex + 1;
      setPlayerInputIndex(nextInputIdx);

      if (nextInputIdx === sequence.length) {
        // Completed this level
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setGameState('success');
        setTimeout(() => {
          advanceLevel(sequence);
        }, 600);
      }
    } else {
      // Mistake
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setGameState('failure');
    }
  };

  const handleRetry = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    playSequence(sequence);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <GradientBackground variant="glow">
      <View style={[styles.container, { paddingTop: insets.top + Spacing.md }]}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.closeBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.back();
            }}
          >
            <Feather name="arrow-left" size={22} color={Colors.text.primary} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Memory Matrix</Text>
            <Text style={styles.headerSubtitle}>Cognitive Focus Game</Text>
          </View>
          <View style={styles.bestBadge}>
            <Feather name="award" size={12} color="#F59E0B" />
            <Text style={styles.bestBadgeText}>Best: Lvl {bestLevel}</Text>
          </View>
        </View>

        {/* Current Score & Streak Banner */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>Level {level}</Text>
            <Text style={styles.statLabel}>Current Stage</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#F59E0B' }]}>Level {bestLevel}</Text>
            <Text style={styles.statLabel}>{isNewBest ? 'New Record!' : 'All-Time Best'}</Text>
          </View>
        </View>

        {/* Status Prompt Banner */}
        <View style={styles.promptBanner}>
          <Feather
            name={
              gameState === 'showing'
                ? 'eye'
                : gameState === 'player'
                ? 'play'
                : gameState === 'success'
                ? 'check-circle'
                : gameState === 'failure'
                ? 'refresh-cw'
                : 'compass'
            }
            size={18}
            color={
              gameState === 'showing'
                ? '#06B6D4'
                : gameState === 'player'
                ? Colors.accent.primary
                : gameState === 'success'
                ? '#10B981'
                : gameState === 'failure'
                ? '#F59E0B'
                : Colors.text.secondary
            }
          />
          <Text style={styles.promptBannerText}>
            {gameState === 'idle'
              ? 'Watch the pattern and tap in harmony'
              : gameState === 'showing'
              ? 'Watch the glowing sequence...'
              : gameState === 'player'
              ? `Your turn: Step ${playerInputIndex + 1} of ${sequence.length}`
              : gameState === 'success'
              ? 'Sequence complete! Advancing...'
              : 'Pattern missed. Take a breath and retry!'}
          </Text>
        </View>

        {/* 3x3 Matrix Board */}
        <View style={styles.gridContainer}>
          <View style={styles.matrixBoard}>
            {Array.from({ length: 3 }).map((_, rowIndex) => (
              <View key={rowIndex} style={styles.matrixRow}>
                {Array.from({ length: 3 }).map((_, colIndex) => {
                  const tileIndex = rowIndex * 3 + colIndex;
                  const isFlashing = activeFlashIndex === tileIndex;
                  const tileColor = TILE_COLORS[tileIndex];

                  return (
                    <Pressable
                      key={tileIndex}
                      style={[
                        styles.matrixTile,
                        isFlashing
                          ? [styles.matrixTileActive, { backgroundColor: tileColor, shadowColor: tileColor }]
                          : styles.matrixTileInactive,
                      ]}
                      onPress={() => handleTilePress(tileIndex)}
                      disabled={gameState !== 'player'}
                    >
                      <View
                        style={[
                          styles.tileDot,
                          { backgroundColor: isFlashing ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)' },
                        ]}
                      />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={[styles.bottomActions, { paddingBottom: insets.bottom + Spacing.md }]}>
          {gameState === 'idle' ? (
            <Button
              title="Start Focus Game"
              variant="primary"
              size="lg"
              fullWidth
              onPress={startNewGame}
            />
          ) : gameState === 'failure' ? (
            <View style={{ flexDirection: 'row', gap: Spacing.md, width: '100%' }}>
              <Button
                title="Retry Pattern"
                variant="secondary"
                size="md"
                style={{ flex: 1 }}
                onPress={handleRetry}
              />
              <Button
                title="Restart Game"
                variant="primary"
                size="md"
                style={{ flex: 1 }}
                onPress={startNewGame}
              />
            </View>
          ) : (
            <Button
              title="Reset Game"
              variant="ghost"
              size="md"
              fullWidth
              onPress={startNewGame}
            />
          )}
        </View>
      </View>
    </GradientBackground>
  );
}

const TILE_SIZE = Math.min((SCREEN_WIDTH - 90) / 3, 94);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    height: 48,
    marginBottom: Spacing.sm,
  },
  closeBtn: {
    position: 'absolute',
    left: 0,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: Colors.text.primary,
  },
  headerSubtitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.caption,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: 1,
  },
  bestBadge: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    zIndex: 10,
  },
  bestBadgeText: {
    fontFamily: Fonts.bodyBold,
    fontSize: FontSizes.caption,
    color: '#F59E0B',
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#1E1E24',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: Spacing.xs,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.body + 2,
    color: Colors.text.primary,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },

  promptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: Spacing.xs,
  },
  promptBannerText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.caption,
    color: Colors.text.primary,
  },

  gridContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  matrixBoard: {
    backgroundColor: '#18181B',
    borderRadius: 28,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  matrixRow: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 6,
  },
  matrixTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixTileInactive: {
    backgroundColor: '#27272A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  matrixTileActive: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.05 }],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  tileDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  bottomActions: {
    width: '100%',
  },
});
