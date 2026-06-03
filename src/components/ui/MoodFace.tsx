/**
 * MoodMap — MoodFace Component
 * SVG-based expressive face
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import Svg, { Circle, Path, Line } from 'react-native-svg';

export type FaceExpression = 'happy' | 'calm' | 'neutral' | 'sad' | 'angry' | 'anxious';

interface MoodFaceProps {
  expression: FaceExpression;
  bgColor: string;
  faceColor: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
}

const SIZES = { xs: 20, sm: 36, md: 64, lg: 120, xl: 180 };

/**
 * Draw face features relative to center. SVG viewBox is 0 0 100 100.
 */
const FaceFeatures: React.FC<{ expression: FaceExpression; strokeColor: string; strokeWidth: number }> = ({
  expression,
  strokeColor,
  strokeWidth,
}) => {
  const sw = strokeWidth;
  const sc = strokeColor;

  switch (expression) {
    case 'happy':
      return (
        <>
          {/* Eyes — dots */}
          <Circle cx={36} cy={40} r={3.5} fill={sc} />
          <Circle cx={64} cy={40} r={3.5} fill={sc} />
          {/* Mouth — upward curve */}
          <Path d="M 32 58 Q 50 74 68 58" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </>
      );
    case 'calm':
      return (
        <>
          {/* Eyes — closed arcs */}
          <Path d="M 30 40 Q 36 34 42 40" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
          <Path d="M 58 40 Q 64 34 70 40" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
          {/* Mouth — gentle smile */}
          <Path d="M 36 58 Q 50 66 64 58" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </>
      );
    case 'neutral':
      return (
        <>
          {/* Eyes — horizontal dashes */}
          <Line x1={31} y1={40} x2={41} y2={40} stroke={sc} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={59} y1={40} x2={69} y2={40} stroke={sc} strokeWidth={sw} strokeLinecap="round" />
          {/* Mouth — straight line */}
          <Line x1={36} y1={60} x2={64} y2={60} stroke={sc} strokeWidth={sw} strokeLinecap="round" />
        </>
      );
    case 'sad':
      return (
        <>
          {/* Eyes — dots */}
          <Circle cx={36} cy={40} r={3.5} fill={sc} />
          <Circle cx={64} cy={40} r={3.5} fill={sc} />
          {/* Mouth — downward curve */}
          <Path d="M 32 64 Q 50 50 68 64" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </>
      );
    case 'angry':
      return (
        <>
          {/* Eyes — dots */}
          <Circle cx={36} cy={42} r={3.5} fill={sc} />
          <Circle cx={64} cy={42} r={3.5} fill={sc} />
          {/* Brows — angled */}
          <Line x1={28} y1={32} x2={42} y2={35} stroke={sc} strokeWidth={sw} strokeLinecap="round" />
          <Line x1={72} y1={32} x2={58} y2={35} stroke={sc} strokeWidth={sw} strokeLinecap="round" />
          {/* Mouth — tight frown */}
          <Path d="M 36 62 Q 50 54 64 62" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </>
      );
    case 'anxious':
      return (
        <>
          {/* Eyes — wide open */}
          <Circle cx={36} cy={40} r={4.5} fill={sc} />
          <Circle cx={64} cy={40} r={4.5} fill={sc} />
          {/* Mouth — wobbly */}
          <Path d="M 32 60 Q 40 56 50 62 Q 60 56 68 60" stroke={sc} strokeWidth={sw} fill="none" strokeLinecap="round" />
        </>
      );
    default:
      return null;
  }
};

export const MoodFace: React.FC<MoodFaceProps> = ({
  expression,
  bgColor,
  faceColor,
  size = 'md',
  style,
}) => {
  const px = SIZES[size];
  const strokeColor = darkenColor(faceColor);
  const strokeWidth = size === 'xs' ? 5 : size === 'sm' ? 4 : size === 'md' ? 3.5 : 3;

  return (
    <View style={[{ width: px, height: px }, style]}>
      <Svg width={px} height={px} viewBox="0 0 100 100">
        {/* Background circle */}
        <Circle cx={50} cy={50} r={48} fill={faceColor} />
        {/* Face features */}
        <FaceFeatures expression={expression} strokeColor={strokeColor} strokeWidth={strokeWidth} />
      </Svg>
    </View>
  );
};

/** Simple color darkener — shift hex towards darker */
function darkenColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const f = 0.45;
  const nr = Math.round(r * f);
  const ng = Math.round(g * f);
  const nb = Math.round(b * f);
  return `#${nr.toString(16).padStart(2, '0')}${ng.toString(16).padStart(2, '0')}${nb.toString(16).padStart(2, '0')}`;
}
