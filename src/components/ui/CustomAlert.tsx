import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Pressable,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useAlertStore } from '@/stores/alertStore';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Radius, Spacing, Shadows } from '@/constants/layout';
import { GlassCard } from './GlassCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const CustomAlert: React.FC = () => {
  const { visible, title, message, buttons, hideAlert } = useAlertStore();
  
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          damping: 15,
          stiffness: 150,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

  const handleButtonPress = async (onPress?: () => void | Promise<void>) => {
    // Fade out first for smooth transition
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(async () => {
      hideAlert();
      if (onPress) {
        try {
          await onPress();
        } catch (error) {
          console.error('[CustomAlert] Button callback error:', error);
        }
      }
    });
  };

  const renderButtons = () => {
    if (buttons.length === 2) {
      // Side-by-side buttons
      return (
        <View style={styles.buttonRow}>
          {buttons.map((btn, index) => {
            const isCancel = btn.style === 'cancel';
            const isDestructive = btn.style === 'destructive';
            
            let btnBg: string = 'rgba(255, 255, 255, 0.05)';
            let btnBorder: string = 'rgba(255, 255, 255, 0.08)';
            let textColor: string = Colors.text.primary;

            if (isDestructive) {
              btnBg = Colors.accent.coralMuted;
              btnBorder = Colors.accent.coral + '30';
              textColor = Colors.accent.coral;
            } else if (isCancel) {
              btnBg = 'rgba(190, 255, 108, 0.08)';
              btnBorder = 'rgba(190, 255, 108, 0.2)';
              textColor = Colors.accent.primary;
            } else {
              btnBg = Colors.accent.primary;
              btnBorder = Colors.accent.primary;
              textColor = Colors.background.primary;
            }

            return (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  styles.flexButton,
                  {
                    backgroundColor: btnBg,
                    borderColor: btnBorder,
                  },
                  pressed && styles.buttonPressed,
                ]}
                onPress={() => handleButtonPress(btn.onPress)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    { color: textColor },
                    !isCancel && !isDestructive && styles.buttonTextBold,
                  ]}
                >
                  {btn.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    }

    // Stacked buttons (1 button or 3+ buttons)
    return (
      <View style={styles.buttonStack}>
        {buttons.map((btn, index) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          
          let btnBg: string = 'rgba(255, 255, 255, 0.05)';
          let btnBorder: string = 'rgba(255, 255, 255, 0.08)';
          let textColor: string = Colors.text.primary;

          if (isDestructive) {
            btnBg = Colors.accent.coralMuted;
            btnBorder = Colors.accent.coral + '30';
            textColor = Colors.accent.coral;
          } else if (isCancel) {
            btnBg = 'rgba(190, 255, 108, 0.08)';
            btnBorder = 'rgba(190, 255, 108, 0.2)';
            textColor = Colors.accent.primary;
          } else {
            btnBg = Colors.accent.primary;
            btnBorder = Colors.accent.primary;
            textColor = Colors.background.primary;
          }

          return (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.stackButton,
                {
                  backgroundColor: btnBg,
                  borderColor: btnBorder,
                },
                pressed && styles.buttonPressed,
              ]}
              onPress={() => handleButtonPress(btn.onPress)}
            >
              <Text
                style={[
                  styles.buttonText,
                  { color: textColor },
                  !isCancel && !isDestructive && styles.buttonTextBold,
                ]}
              >
                {btn.text}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={() => handleButtonPress()}
    >
      <View style={styles.modalOverlay}>
        {/* Blurred background overlay */}
        {Platform.OS === 'ios' ? (
          <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0, 0, 0, 0.75)' }]} />
        )}

        <Animated.View
          style={[
            styles.alertContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <GlassCard intensity="strong" padding="lg" style={styles.alertCard}>
            <Text style={styles.title}>{title}</Text>
            {!!message && <Text style={styles.message}>{message}</Text>}
            {renderButtons()}
          </GlassCard>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  alertContainer: {
    width: Math.min(SCREEN_WIDTH * 0.85, 340),
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.h3,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.bodySmall,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  
  // Buttons side-by-side
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  flexButton: {
    flex: 1,
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Buttons stacked
  buttonStack: {
    flexDirection: 'column',
    gap: Spacing.sm,
    width: '100%',
  },
  stackButton: {
    width: '100%',
    height: 48,
    borderRadius: Radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontFamily: Fonts.bodySemiBold,
    fontSize: FontSizes.bodySmall,
  },
  buttonTextBold: {
    fontFamily: Fonts.heading,
  },
});
