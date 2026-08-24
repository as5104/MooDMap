/**
 * MoodMap — Letter Notification Service
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'time-capsules';

/**
 * Ensures notification channels and permissions are ready
 */
export async function ensureLetterNotificationChannel(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Time Capsule Letters',
        description: 'Notifications when your future-self letters are ready to open',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#7C3AED',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error) {
    console.warn('[LetterNotifications] Failed to setup channel:', error);
    return false;
  }
}

/**
 * Schedule a reveal notification for a future-self letter
 */
export async function scheduleLetterRevealNotification(
  entryId: string,
  title: string | null | undefined,
  revealAtIso: string
): Promise<string | null> {
  try {
    const triggerDate = new Date(revealAtIso);
    const now = new Date();

    // Only schedule if the date is in the future
    if (triggerDate.getTime() <= now.getTime()) {
      return null;
    }

    const hasPermission = await ensureLetterNotificationChannel();
    if (!hasPermission) {
      console.warn('[LetterNotifications] Notification permission not granted');
      return null;
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'A Letter From Your Past Self Has Arrived',
        body: title
          ? `"${title}" is now unlocked and ready to read.`
          : 'Your sealed time-capsule letter has arrived. Tap to read.',
        data: {
          entryId,
          type: 'letter_reveal',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: CHANNEL_ID,
      },
    });

    console.log(`[LetterNotifications] Scheduled notification for ${triggerDate.toISOString()} (ID: ${notificationId})`);
    return notificationId;
  } catch (error) {
    console.warn('[LetterNotifications] Failed to schedule reveal notification:', error);
    return null;
  }
}
