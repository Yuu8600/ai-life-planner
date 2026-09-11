import { useRouter } from 'expo-router';

import { TodayScreen } from '@/features/today/TodayScreen';

export default function TodayRoute() {
  const router = useRouter();

  return (
    <TodayScreen
      onPressAi={() => router.push('/ai')}
      onPressSettings={() => router.push('/settings')}
    />
  );
}
