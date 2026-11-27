import { SuccessFeedbackProvider } from '@/shared/feedback/SuccessFeedback';
import { successFeedback } from '@/services/haptics/successFeedback';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/features/auth';
import { useThemeColors, ThemeProvider, useTheme } from '@/shared/theme';

export function RootNavigator() {
  const colors = useThemeColors();
  const { name } = useTheme();
  const { isRestoring, session } = useAuth();

  return (
    <>
      <StatusBar style={name === 'clear-dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isRestoring && session === null}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={!isRestoring && session !== null}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="goal-library" />
          <Stack.Screen name="action-steps" />
          <Stack.Screen name="advanced-planner" />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider followSystem>
      <SuccessFeedbackProvider onSuccess={successFeedback}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </SuccessFeedbackProvider>
    </ThemeProvider>
  );
}
