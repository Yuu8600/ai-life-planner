import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { colors, radius, spacing } from '@/shared/theme';

import { SettingRow } from './components/SettingRow';
import { SETTING_SECTIONS } from './data';

type SettingsScreenProps = {
  onPressBack: () => void;
};

export function SettingsScreen({ onPressBack }: SettingsScreenProps) {
  return (
    <AppScreen testID="settings-screen">
      <ScreenHeader
        action={
          <Pressable
            accessibilityLabel="設定を閉じる"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onPressBack}
            style={({ pressed }) => [styles.closeButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.closeIcon}>×</Text>
          </Pressable>
        }
        subtitle="暮らしに合わせて、計画の前提を整えます。"
        title="設定"
      />

      {SETTING_SECTIONS.map((section) => (
        <View key={section.id} style={styles.section}>
          <SectionHeader title={section.title} />
          <View style={styles.list}>
            {section.items.map((item, index) => (
              <SettingRow isLast={index === section.items.length - 1} item={item} key={item.id} />
            ))}
          </View>
        </View>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  closeIcon: {
    color: colors.text,
    fontSize: 25,
    lineHeight: 27,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    marginTop: spacing.xl,
  },
  list: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
});
