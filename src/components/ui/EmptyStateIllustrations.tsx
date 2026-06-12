/**
 * MoodMap — Empty State Illustrations
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { Colors } from '@/constants/colors';

const ACCENT = Colors.accent.primary;
const LAVENDER = Colors.accent.lavender;
const CORAL = Colors.accent.coral;
const AMBER = Colors.accent.amber;

interface IllustrationProps {
  size?: number;
}


/**
 * Journal / Writing Illustration
 */
export const JournalIllustration: React.FC<IllustrationProps> = ({ size = 160 }) => (
  <View style={[styles.container, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="notebookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.85" />
          <Stop offset="100%" stopColor="#9EDD4C" stopOpacity="0.65" />
        </LinearGradient>
        <LinearGradient id="pageGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <Stop offset="100%" stopColor="#F0F0F0" stopOpacity="0.85" />
        </LinearGradient>
        <LinearGradient id="penGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={LAVENDER} />
          <Stop offset="100%" stopColor="#9B89E6" />
        </LinearGradient>
        <RadialGradient id="journalGlow" cx="50%" cy="85%" rx="35%" ry="12%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.15" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Ground shadow */}
      <Ellipse cx={100} cy={170} rx={55} ry={10} fill="url(#journalGlow)" />

      {/* Notebook back cover */}
      <Rect x={50} y={50} width={100} height={120} rx={6} fill="url(#notebookGrad)" />

      {/* Notebook binding */}
      <Rect x={60} y={48} width={4} height={124} rx={2} fill="#0A0A0C" opacity={0.3} />

      {/* Pages */}
      <Rect x={66} y={54} width={80} height={112} rx={3} fill="url(#pageGrad)" />

      {/* Lines on page */}
      <Path d="M74,72 L138,72" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,84 L130,84" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,96 L135,96" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,108 L125,108" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,120 L132,120" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,132 L120,132" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />
      <Path d="M74,144 L128,144" stroke="#0A0A0C" strokeWidth={0.6} opacity={0.12} />

      {/* Written text (scribble lines) */}
      <Path d="M74,72 L120,72" stroke={ACCENT} strokeWidth={1.2} opacity={0.5} strokeLinecap="round" />
      <Path d="M74,84 L110,84" stroke={ACCENT} strokeWidth={1.2} opacity={0.4} strokeLinecap="round" />
      <Path d="M74,96 L115,96" stroke={ACCENT} strokeWidth={1.2} opacity={0.35} strokeLinecap="round" />

      {/* Pen */}
      <G transform="translate(135, 80) rotate(35)">
        <Rect x={-3} y={-40} width={6} height={55} rx={2} fill="url(#penGrad)" />
        <Path d="M-3,15 L0,22 L3,15" fill="#F0F0F0" />
        <Rect x={-3} y={-40} width={6} height={8} rx={2} fill="#0A0A0C" opacity={0.3} />
      </G>

      {/* Floating thought/idea bubbles */}
      <Circle cx={45} cy={45} r={8} fill={LAVENDER} opacity={0.2} />
      <Circle cx={38} cy={55} r={4} fill={LAVENDER} opacity={0.15} />
      <Circle cx={155} cy={40} r={6} fill={AMBER} opacity={0.2} />
      <Circle cx={165} cy={50} r={3} fill={AMBER} opacity={0.15} />

      {/* Small heart on page corner */}
      <Path
        d="M132,60 C132,57 136,55 138,58 C140,55 144,57 144,60 C144,64 138,68 138,68 C138,68 132,64 132,60"
        fill={CORAL}
        opacity={0.35}
      />
    </Svg>
  </View>
);

/**
 * Insights / Analytics Illustration
 */
export const InsightsIllustration: React.FC<IllustrationProps> = ({ size = 160 }) => (
  <View style={[styles.container, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="bar1" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0.5" />
        </LinearGradient>
        <LinearGradient id="bar2" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={LAVENDER} stopOpacity="0.85" />
          <Stop offset="100%" stopColor={LAVENDER} stopOpacity="0.45" />
        </LinearGradient>
        <LinearGradient id="bar3" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={AMBER} stopOpacity="0.85" />
          <Stop offset="100%" stopColor={AMBER} stopOpacity="0.45" />
        </LinearGradient>
        <RadialGradient id="chartGlow" cx="50%" cy="90%" rx="40%" ry="10%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.18" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Background glow */}
      <Ellipse cx={100} cy={170} rx={65} ry={12} fill="url(#chartGlow)" />

      {/* Chart frame */}
      <Rect x={35} y={45} width={130} height={110} rx={8} fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />

      {/* Grid lines */}
      <Path d="M45,75 L155,75" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="3,5" />
      <Path d="M45,100 L155,100" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="3,5" />
      <Path d="M45,125 L155,125" stroke="rgba(255,255,255,0.06)" strokeWidth={0.5} strokeDasharray="3,5" />

      {/* Bars */}
      <Rect x={52} y={110} width={16} height={35} rx={4} fill="url(#bar1)" />
      <Rect x={76} y={90} width={16} height={55} rx={4} fill="url(#bar2)" />
      <Rect x={100} y={100} width={16} height={45} rx={4} fill="url(#bar3)" />
      <Rect x={124} y={75} width={16} height={70} rx={4} fill="url(#bar1)" />
      <Rect x={148} y={65} width={16} height={80} rx={4} fill="url(#bar2)" />

      {/* Trend line */}
      <Path
        d="M60,108 Q85,86 108,96 T156,62"
        fill="none"
        stroke={ACCENT}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.7}
      />
      {/* Trend line dot */}
      <Circle cx={156} cy={62} r={4} fill={ACCENT} opacity={0.9} />

      {/* Sparkle stars */}
      <G transform="translate(155,42)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={ACCENT} opacity={0.7} />
      </G>
      <G transform="translate(42,38) scale(0.6)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={LAVENDER} opacity={0.5} />
      </G>
      <G transform="translate(170,75) scale(0.5)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={AMBER} opacity={0.4} />
      </G>

      {/* Magnifying glass */}
      <G transform="translate(38, 35)">
        <Circle cx={0} cy={0} r={10} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.5} />
        <Path d="M7,7 L14,14" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" opacity={0.5} />
      </G>
    </Svg>
  </View>
);

/**
 * Email Sent / Mailbox Illustration
 */
export const EmailSentIllustration: React.FC<IllustrationProps> = ({ size = 160 }) => (
  <View style={[styles.container, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="envGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.9" />
          <Stop offset="100%" stopColor="#9EDD4C" stopOpacity="0.7" />
        </LinearGradient>
        <LinearGradient id="envFlap" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.7" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0.5" />
        </LinearGradient>
        <RadialGradient id="envGlow" cx="50%" cy="50%" rx="45%" ry="45%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.1" />
          <Stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {/* Background glow */}
      <Circle cx={100} cy={100} r={75} fill="url(#envGlow)" />

      {/* Envelope body */}
      <Rect x={45} y={75} width={110} height={70} rx={6} fill="url(#envGrad)" />

      {/* Envelope flap (open) */}
      <Path
        d="M45,81 L100,50 L155,81"
        fill="url(#envFlap)"
        stroke={ACCENT}
        strokeWidth={1}
        opacity={0.8}
      />

      {/* Envelope inner fold lines */}
      <Path d="M45,145 L100,110 L155,145" fill="none" stroke="#0A0A0C" strokeWidth={1} opacity={0.15} />

      {/* Letter peeking out */}
      <Rect x={60} y={60} width={80} height={50} rx={3} fill="#FFFFFF" opacity={0.9} />
      <Path d="M70,75 L130,75" stroke="#0A0A0C" strokeWidth={0.8} opacity={0.1} />
      <Path d="M70,83 L120,83" stroke="#0A0A0C" strokeWidth={0.8} opacity={0.1} />
      <Path d="M70,91 L125,91" stroke="#0A0A0C" strokeWidth={0.8} opacity={0.1} />

      {/* Success checkmark circle */}
      <Circle cx={138} cy={68} r={18} fill="#1A1A1F" />
      <Circle cx={138} cy={68} r={16} fill={ACCENT} opacity={0.9} />
      <Path
        d="M130,68 L136,74 L148,62"
        stroke="#0A0A0C"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Floating sparkles */}
      <G transform="translate(55,45) scale(0.7)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={LAVENDER} opacity={0.6} />
      </G>
      <G transform="translate(160,55) scale(0.5)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={AMBER} opacity={0.5} />
      </G>
      <G transform="translate(40,95) scale(0.4)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={ACCENT} opacity={0.4} />
      </G>

      {/* Motion lines */}
      <Path d="M75,48 L70,38" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" opacity={0.3} />
      <Path d="M85,42 L82,32" stroke={LAVENDER} strokeWidth={1.5} strokeLinecap="round" opacity={0.25} />
      <Path d="M115,42 L118,32" stroke={ACCENT} strokeWidth={1.5} strokeLinecap="round" opacity={0.3} />
    </Svg>
  </View>
);

/**
 * Mood History / Chart Empty Illustration
 */
export const MoodHistoryIllustration: React.FC<IllustrationProps> = ({ size = 120 }) => (
  <View style={[styles.container, { width: size, height: size }]}>
    <Svg width={size} height={size} viewBox="0 0 160 120">
      <Defs>
        <LinearGradient id="histLine" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={ACCENT} stopOpacity="0.5" />
          <Stop offset="100%" stopColor={LAVENDER} stopOpacity="0.3" />
        </LinearGradient>
      </Defs>

      {/* Wavy timeline */}
      <Path
        d="M15,60 Q40,35 55,60 T95,60 T135,60"
        fill="none"
        stroke="url(#histLine)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="6,4"
      />

      {/* Empty nodes */}
      <Circle cx={15} cy={60} r={10} fill="rgba(255,255,255,0.06)" stroke={ACCENT} strokeWidth={1.5} opacity={0.5} />
      <Circle cx={55} cy={60} r={10} fill="rgba(255,255,255,0.06)" stroke={LAVENDER} strokeWidth={1.5} opacity={0.4} />
      <Circle cx={95} cy={60} r={10} fill="rgba(255,255,255,0.06)" stroke={AMBER} strokeWidth={1.5} opacity={0.35} />
      <Circle cx={135} cy={60} r={10} fill="rgba(255,255,255,0.06)" stroke={CORAL} strokeWidth={1.5} opacity={0.3} />

      {/* Question marks in nodes */}
      <Path d="M12,57 Q12,53 15,53 Q18,53 18,56 Q18,58 15,58" stroke={ACCENT} strokeWidth={1.2} fill="none" strokeLinecap="round" opacity={0.4} />
      <Circle cx={15} cy={62} r={0.8} fill={ACCENT} opacity={0.4} />

      {/* Plus hint */}
      <Path d="M53,60 L57,60 M55,58 L55,62" stroke={LAVENDER} strokeWidth={1.5} strokeLinecap="round" opacity={0.35} />
      <Path d="M93,60 L97,60 M95,58 L95,62" stroke={AMBER} strokeWidth={1.5} strokeLinecap="round" opacity={0.3} />
      <Path d="M133,60 L137,60 M135,58 L135,62" stroke={CORAL} strokeWidth={1.5} strokeLinecap="round" opacity={0.25} />

      {/* Sparkle hint */}
      <G transform="translate(145,40) scale(0.4)">
        <Path d="M0,-8 L1.5,-2 L8,0 L1.5,2 L0,8 L-1.5,2 L-8,0 L-1.5,-2 Z" fill={ACCENT} opacity={0.5} />
      </G>
    </Svg>
  </View>
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
