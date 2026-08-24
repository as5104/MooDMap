/**
 * MoodMap — SwipableCardDeck
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import { Colors } from '@/constants/colors';
import { Spacing, Radius } from '@/constants/layout';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_CARD_WIDTH = SCREEN_WIDTH - 48;
const DEFAULT_CARD_HEIGHT = Math.min(SCREEN_HEIGHT * 0.58, 470);
const SWIPE_THRESHOLD = 75;

export interface BaseDeckCard {
  id: string | number;
  solidColor: string;
  baseRotation?: number;
}

interface SwipableCardDeckProps<T extends BaseDeckCard> {
  cards: T[];
  renderCard: (card: T, isTop: boolean, onNext: () => void, onPrev: () => void) => React.ReactNode;
  onCardChange?: (card: T, index: number) => void;
  cardWidth?: number;
  cardHeight?: number;
  showDots?: boolean;
}

// Inner persistent deck card layer
function DeckCardLayer<T extends BaseDeckCard>({
  card,
  index,
  isTop,
  totalCards,
  activeIndex,
  translateX,
  translateY,
  cardWidth,
  cardHeight,
  renderCard,
  onNext,
  onPrev,
}: {
  card: T;
  index: number;
  isTop: boolean;
  totalCards: number;
  activeIndex: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  cardWidth: number;
  cardHeight: number;
  renderCard: (card: T, isTop: boolean, onNext: () => void, onPrev: () => void) => React.ReactNode;
  onNext: () => void;
  onPrev: () => void;
}) {
  const baseRotation = card.baseRotation ?? (index % 2 === 0 ? -4 : 4.5);

  const animatedStyle = useAnimatedStyle(() => {
    const currentActive = activeIndex.value;
    const relPos = (index - currentActive + totalCards) % totalCards;

    if (relPos === 0) {
      // Top Card (Active dragging layer)
      const rot = interpolate(
        translateX.value,
        [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
        [-22, 0, 22],
        Extrapolation.CLAMP
      );
      const op = interpolate(
        Math.abs(translateX.value),
        [0, SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 0.9],
        [1, 0.9, 0],
        Extrapolation.CLAMP
      );

      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { rotate: `${rot}deg` },
          { scale: 1 },
        ],
        opacity: op,
        zIndex: 10,
      };
    }

    if (relPos === 1) {
      // Second Card (Promoting seamlessly to top)
      const absDrag = Math.abs(translateX.value);
      const sc = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [0.94, 1.0], Extrapolation.CLAMP);
      const ty = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [14, 0], Extrapolation.CLAMP);
      const rot = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [baseRotation, 0], Extrapolation.CLAMP);
      const op = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [0.90, 1.0], Extrapolation.CLAMP);

      return {
        transform: [
          { translateY: ty },
          { scale: sc },
          { rotate: `${rot}deg` },
        ],
        opacity: op,
        zIndex: 8,
      };
    }

    // Third / Background Cards
    const absDrag = Math.abs(translateX.value);
    const sc = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [0.88, 0.94], Extrapolation.CLAMP);
    const ty = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [26, 14], Extrapolation.CLAMP);
    const rot = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [-baseRotation, baseRotation], Extrapolation.CLAMP);
    const op = interpolate(absDrag, [0, SCREEN_WIDTH * 0.6], [0.75, 0.90], Extrapolation.CLAMP);

    return {
      transform: [
        { translateY: ty },
        { scale: sc },
        { rotate: `${rot}deg` },
      ],
      opacity: op,
      zIndex: 6,
    };
  });

  return (
    <Animated.View
      style={[
        styles.portraitCardWrapper,
        { width: cardWidth, height: cardHeight },
        animatedStyle,
      ]}
    >
      {renderCard(card, isTop, onNext, onPrev)}
    </Animated.View>
  );
}

export function SwipableCardDeck<T extends BaseDeckCard>({
  cards,
  renderCard,
  onCardChange,
  cardWidth = DEFAULT_CARD_WIDTH,
  cardHeight = DEFAULT_CARD_HEIGHT,
  showDots = true,
}: SwipableCardDeckProps<T>) {
  const [currentIdx, setCurrentIdx] = useState(0);

  const activeIndex = useSharedValue(0);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const totalCards = cards.length;

  const handleCardSwiped = useCallback(
    (newIdx: number) => {
      setCurrentIdx(newIdx);
      if (onCardChange && cards[newIdx]) {
        onCardChange(cards[newIdx], newIdx);
      }
    },
    [cards, onCardChange]
  );

  const triggerHaptic = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.4;
    })
    .onEnd((e) => {
      const isSwipedRight = e.translationX > SWIPE_THRESHOLD || e.velocityX > 500;
      const isSwipedLeft = e.translationX < -SWIPE_THRESHOLD || e.velocityX < -500;

      if (isSwipedRight || isSwipedLeft) {
        const toX = isSwipedRight ? SCREEN_WIDTH + 120 : -SCREEN_WIDTH - 120;
        runOnJS(triggerHaptic)();

        translateX.value = withTiming(toX, { duration: 220 }, (finished) => {
          if (finished) {
            const nextIdx = (activeIndex.value + 1) % totalCards;
            activeIndex.value = nextIdx;
            translateX.value = 0;
            translateY.value = 0;
            runOnJS(handleCardSwiped)(nextIdx);
          }
        });
      } else {
        // Snap back to center
        translateX.value = withSpring(0, { damping: 16, stiffness: 180 });
        translateY.value = withSpring(0, { damping: 16, stiffness: 180 });
      }
    });

  const handleNext = useCallback(() => {
    triggerHaptic();
    translateX.value = withTiming(-SCREEN_WIDTH - 120, { duration: 220 }, (finished) => {
      if (finished) {
        const nextIdx = (activeIndex.value + 1) % totalCards;
        activeIndex.value = nextIdx;
        translateX.value = 0;
        translateY.value = 0;
        runOnJS(handleCardSwiped)(nextIdx);
      }
    });
  }, [activeIndex, translateX, translateY, totalCards, triggerHaptic, handleCardSwiped]);

  const handlePrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const prevIdx = (activeIndex.value - 1 + totalCards) % totalCards;
    activeIndex.value = prevIdx;
    translateX.value = 0;
    translateY.value = 0;
    handleCardSwiped(prevIdx);
  }, [activeIndex, translateX, translateY, totalCards, handleCardSwiped]);

  const handleJumpTo = useCallback(
    (targetIdx: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      activeIndex.value = targetIdx;
      translateX.value = 0;
      translateY.value = 0;
      handleCardSwiped(targetIdx);
    },
    [activeIndex, translateX, translateY, handleCardSwiped]
  );

  return (
    <View style={styles.deckContainer}>
      {/* Main Gesture Deck Stage */}
      <GestureDetector gesture={panGesture}>
        <View style={[styles.cardStage, { height: cardHeight }]}>
          {cards.map((card, idx) => (
            <DeckCardLayer
              key={card.id}
              card={card}
              index={idx}
              isTop={idx === currentIdx}
              totalCards={totalCards}
              activeIndex={activeIndex}
              translateX={translateX}
              translateY={translateY}
              cardWidth={cardWidth}
              cardHeight={cardHeight}
              renderCard={renderCard}
              onNext={handleNext}
              onPrev={handlePrev}
            />
          ))}
        </View>
      </GestureDetector>

      {/* Indicator Dots below the cards */}
      {showDots && (
        <View style={styles.dotsRow}>
          {cards.map((c, i) => {
            const isCurrent = currentIdx === i;
            return (
              <Pressable
                key={c.id}
                onPress={() => handleJumpTo(i)}
                style={[
                  styles.stepDot,
                  isCurrent && { backgroundColor: c.solidColor, width: 26 },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  deckContainer: {
    width: '100%',
    alignItems: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.lg + 2,
    marginBottom: Spacing.xs,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardStage: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: Spacing.sm,
  },
  portraitCardWrapper: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
});
