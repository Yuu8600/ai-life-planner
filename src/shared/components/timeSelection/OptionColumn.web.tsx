import { colors } from '@/shared/theme';
import type { OptionColumnProps } from './OptionColumn';
export function OptionColumn({ label, options, value, onChange }: OptionColumnProps) {
  return (
    <label
      style={{
        flex: 1,
        minWidth: 72,
        color: colors.text,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {label}
      <select
        aria-label={label}
        size={5}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minHeight: 240,
          fontSize: 18,
          color: colors.text,
          background: colors.surface,
          border: `1px solid ${colors.borderControl}`,
          borderRadius: 8,
        }}
      >
        {options.map((option) => (
          <option key={option} value={option} style={{ padding: 10 }}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}
