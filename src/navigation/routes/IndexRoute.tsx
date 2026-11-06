import { Redirect } from 'expo-router';

import { AuthLoadingScreen, useAuth } from '@/features/auth';

export default function IndexRoute() {
  const { isRestoring, session } = useAuth();

  if (isRestoring) {
    return <AuthLoadingScreen />;
  }

  return <Redirect href={session ? '/today' : '/login'} />;
}
