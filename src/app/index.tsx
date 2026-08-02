import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useRouter } from 'expo-router';

export default function Index() {
  const session = useAppStore((s) => s.session);
  const isAuthLoading = useAppStore((s) => s.isAuthLoading);
  const isAppReady = useAppStore((s) => s.isAppReady);
  const hasCompletedOnboarding = useAppStore((s) => s.hasCompletedOnboarding);
  const router = useRouter();

  useEffect(() => {
    if (isAuthLoading || !isAppReady) return;

    if (!session) {
      router.replace('/(auth)/login');
    } else if (!hasCompletedOnboarding) {
      router.replace('/(onboarding)');
    } else {
      router.replace('/(tabs)');
    }
  }, [session, isAuthLoading, isAppReady, hasCompletedOnboarding]);

  return null;
}
