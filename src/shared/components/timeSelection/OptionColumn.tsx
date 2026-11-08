import { useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors, spacing } from '@/shared/theme';
export type OptionColumnProps = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};
export function OptionColumn({ label, options, value, onChange }: OptionColumnProps) {
  const ref = useRef<ScrollView>(null);
  const selectedLayout = useRef({ y: 0, height: 48 });
  const revealSelection = () =>
    ref.current?.scrollTo({
      y: Math.max(0, selectedLayout.current.y - selectedLayout.current.height * 2),
      animated: false,
    });
  return (
    <View style={{ flex: 1, minWidth: 72 }}>
      <Text>{label}</Text>
      <ScrollView
        ref={ref}
        nestedScrollEnabled
        style={{ maxHeight: 240 }}
        onLayout={revealSelection}
        onContentSizeChange={revealSelection}
      >
        {options.map((option) => (
          <Pressable
            key={option}
            onLayout={(event) => {
              if (option === value) {
                selectedLayout.current = event.nativeEvent.layout;
                revealSelection();
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${option}`}
            accessibilityState={{ selected: option === value }}
            onPress={() => onChange(option)}
            style={{
              minHeight: 48,
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.sm,
              backgroundColor: option === value ? colors.accentSoft : colors.surface,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18 }}>
              {option === value ? '✓ ' : ''}
              {option}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
