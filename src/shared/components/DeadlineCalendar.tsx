import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform } from 'react-native';

import {
  dateInputToLocalDate,
  FIRST_DATE_INPUT,
  formatDateInput,
  LAST_DATE_INPUT,
} from '@/shared/dateInput';
import { useTheme } from '@/shared/theme';

export type DeadlineCalendarProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  clearLabel?: string;
  onDismiss?: () => void;
};

export function DeadlineCalendar({
  label,
  value,
  onChange,
  onClear,
  clearLabel = '期限なし',
  onDismiss,
}: DeadlineCalendarProps) {
  const { colors, name } = useTheme();
  return (
    <DateTimePicker
      accessibilityLabel={label}
      mode="date"
      value={dateInputToLocalDate(value)}
      minimumDate={dateInputToLocalDate(FIRST_DATE_INPUT)}
      maximumDate={dateInputToLocalDate(LAST_DATE_INPUT)}
      onValueChange={(_, date) => onChange(formatDateInput(date))}
      onDismiss={onDismiss}
      {...(Platform.OS === 'android'
        ? {
            ...(onClear
              ? { neutralButton: { label: clearLabel }, onNeutralButtonPress: onClear }
              : {}),
          }
        : {
            display: 'inline' as const,
            themeVariant: name === 'clear-dark' ? ('dark' as const) : ('light' as const),
            accentColor: colors.primary,
            locale: 'ja-JP',
          })}
    />
  );
}
