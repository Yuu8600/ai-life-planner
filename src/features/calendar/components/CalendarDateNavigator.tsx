import { StyleSheet, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { spacing } from '@/shared/theme';

type CalendarDateNavigatorProps = {
  onNext: () => void;
  onPrevious: () => void;
  onToday: () => void;
};

export function CalendarDateNavigator({ onNext, onPrevious, onToday }: CalendarDateNavigatorProps) {
  return (
    <View accessibilityRole="toolbar" style={styles.container}>
      <ActionButton
        accessibilityLabel="前の日を表示"
        label="前日"
        onPress={onPrevious}
        style={styles.button}
        variant="secondary"
      />
      <ActionButton label="今日" onPress={onToday} style={styles.button} variant="secondary" />
      <ActionButton
        accessibilityLabel="次の日を表示"
        label="翌日"
        onPress={onNext}
        style={styles.button}
        variant="secondary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  button: {
    flex: 1,
  },
});
