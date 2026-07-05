import React, { useState } from 'react';
import { Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

interface MusicCoverProps {
  cover: string;
  style: any;
  iconSize?: number;
  borderRadius?: number;
  showIcon?: boolean;
}

const COVER_GRADIENTS: Record<string, [string, string]> = {
  midnight: ['#281E5D', '#0F0B2E'],
  chill: ['#1B3B5F', '#0B1B2E'],
  energy: ['#D33F2E', '#3D0E08'],
  heartbeat: ['#9F1D4F', '#2D0616'],
  ambient: ['#1E5E4E', '#081E18'],
  local: ['#593CFB', '#1B0975'],
  spotify: ['#1DB954', '#121212'],
};

const COVER_ICONS: Record<string, string> = {
  midnight: 'moon',
  chill: 'wind',
  energy: 'zap',
  heartbeat: 'heart',
  ambient: 'droplet',
  local: 'music',
  spotify: 'music',
};

export const MusicCover = React.memo(({
  cover,
  style,
  iconSize = 20,
  borderRadius = 12,
  showIcon = true,
}: MusicCoverProps) => {
  const [imageError, setImageError] = useState(false);
  
  const isWebUrl = cover?.startsWith('http://') || cover?.startsWith('https://');
  const isContentUri = cover?.startsWith('content://') || cover?.startsWith('file://');
  const isImgSource = (isWebUrl || isContentUri) && !imageError;

  if (isImgSource) {
    return (
      <Image
        source={{ uri: cover }}
        style={[style, { borderRadius }]}
        onError={() => setImageError(true)}
      />
    );
  }

  // Fallback to premium category gradient and matching symbol icon
  const slug = COVER_GRADIENTS[cover] ? cover : 'local';
  const colors = COVER_GRADIENTS[slug];
  const iconName = COVER_ICONS[slug] as any;

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[style, { borderRadius, alignItems: 'center', justifyContent: 'center' }]}
    >
      {showIcon && <Feather name={iconName} size={iconSize} color="rgba(255, 255, 255, 0.75)" />}
    </LinearGradient>
  );
});

MusicCover.displayName = 'MusicCover';

