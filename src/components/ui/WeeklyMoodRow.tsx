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
}

interface WeeklyMoodRowProps {
  days: DayMood[];
}

const DEFAULT_DAYS: DayMood[] = [
  { day: 'Mon', expression: 'happy', faceColor: '#EDD9A8' },
  { day: 'Tue', expression: 'calm', faceColor: '#C5D4A0' },
  { day: 'Wed', expression: 'anxious', faceColor: '#C4A8D4' },
  { day: 'Thu', expression: 'happy', faceColor: '#EDD9A8' },
  { day: 'Fri', expression: 'angry', faceColor: '#E0A090' },
  { day: 'Sat', expression: 'neutral', faceColor: '#A89880' },
  { day: 'Sun', expression: 'happy', faceColor: '#EDD9A8' },
];

export const WeeklyMoodRow: React.FC<WeeklyMoodRowProps> = ({
  days = DEFAULT_DAYS,
}) => {
  return (
    <View style={styles.row}>
      {days.map((d, i) => (
        <View key={i} style={styles.dayItem}>
          <MoodFace
            expression={d.expression}
            bgColor="transparent"
            faceColor={d.faceColor}
            size="sm"
          />
          <Text style={styles.dayLabel}>{d.day}</Text>
        </View>
      ))}
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
});
