import { Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { DemoBanner } from '@/features/demo/DemoBanner';
import { DemoProvider } from '@/features/demo/DemoProvider';
import { colors } from '@/shared/theme';

export default function WebRootLayout() {
  return (
    <DemoProvider>
      <View style={styles.background}>
        <View style={styles.frame}>
          <DemoBanner />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'none',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="(auth)" />
          </Stack>
        </View>
      </View>
    </DemoProvider>
  );
}
const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  frame: {
    width: '100%',
    maxWidth: 960,
    flex: 1,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
});

export { WebRootLayout as RootNavigator };
