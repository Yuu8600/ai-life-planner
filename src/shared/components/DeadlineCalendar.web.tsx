import { FIRST_DATE_INPUT, LAST_DATE_INPUT } from '@/shared/dateInput';
import { useTheme } from '@/shared/theme';
import type { DeadlineCalendarProps } from './DeadlineCalendar';

export function DeadlineCalendar({ label, value, onChange }: DeadlineCalendarProps) {
  const { colors, controls, radius, spacing, typography } = useTheme();
  return (
    <input
      aria-label={label}
      lang="ja"
      type="date"
      min={FIRST_DATE_INPUT}
      max={LAST_DATE_INPUT}
      value={value}
      onChange={(event) => {
        const input = event.currentTarget;
        if (input.validity.valid) onChange(input.value);
      }}
      style={{
        width: '100%',
        minWidth: 0,
        minHeight: controls.inputHeight,
        boxSizing: 'border-box',
        padding: spacing.md,
        border: `${controls.borderWidth}px solid ${colors.borderControl}`,
        borderRadius: radius.control,
        background: colors.surface,
        color: colors.textPrimary,
        fontFamily: 'inherit',
        fontSize: typography.body.fontSize,
        outlineColor: colors.focusRing,
        outlineOffset: controls.focusOffset,
      }}
    />
  );
}
