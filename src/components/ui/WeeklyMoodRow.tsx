/**
 * MoodMap — WeeklyMoodRow Component
 * 7-day mood face row with day labels (Mon-Sun)
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MoodFace, type FaceExpression } from './MoodFace';
import { Colors } from '@/constants/colors';
import { Fonts, FontSizes } from '@/constants/typography';
import { Spacing } from '@/constants/layout';

interface DayMood {
  day: string;
  expression: FaceExpression;
  faceColor: string;
  moodScore?: number; // 0 = no entry for that day
}

interface WeeklyMoodRowProps {
  days: DayMood[];
}

const DEFAULT_DAYS: DayMood[] = [
  { day: 'Mon', expression: 'happy', faceColor: '#EDD9A8', moodScore: 5 },
  { day: 'Tue', expression: 'calm', faceColor: '#C5D4A0', moodScore: 5 },
  { day: 'Wed', expression: 'anxious', faceColor: '#C4A8D4', moodScore: 5 },
  { day: 'Thu', expression: 'happy', faceColor: '#EDD9A8', moodScore: 5 },
  { day: 'Fri', expression: 'angry', faceColor: '#E0A090', moodScore: 5 },
  { day: 'Sat', expression: 'neutral', faceColor: '#A89880', moodScore: 5 },
  { day: 'Sun', expression: 'happy', faceColor: '#EDD9A8', moodScore: 5 },
];

export const WeeklyMoodRow: React.FC<WeeklyMoodRowProps> = ({
  days = DEFAULT_DAYS,
}) => {
  return (
    <View style={styles.row}>
      {days.map((d, i) => {
        const hasEntry = d.moodScore != null && d.moodScore > 0;
        return (
          <View key={i} style={styles.dayItem}>
            {hasEntry ? (
              <MoodFace
                expression={d.expression}
                bgColor="transparent"
                faceColor={d.faceColor}
                size="sm"
              />
            ) : (
              <View style={styles.emptyCircle}>
                <Text style={styles.emptyDash}>–</Text>
              </View>
            )}
            <Text style={[styles.dayLabel, !hasEntry && styles.dayLabelMuted]}>{d.day}</Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayItem: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dayLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.tiny,
    color: Colors.text.secondary,
  },
  dayLabelMuted: {
    color: Colors.text.tertiary,
    opacity: 0.5,
  },
  emptyCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDash: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.2)',
    marginTop: -1,
  },
});
