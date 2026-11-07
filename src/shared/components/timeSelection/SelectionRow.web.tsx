import { colors, spacing } from '@/shared/theme';
import type { PanelAnchor } from './SelectionPanel';
export function SelectionRow({
  label,
  value,
  disabled,
  onOpen,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onOpen: (anchor: PanelAnchor) => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label}、${value}`}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        onOpen({ x: r.left, y: r.top, width: r.width, height: r.height });
      }}
      style={{
        width: '100%',
        minHeight: 56,
        padding: `${spacing.md}px 0`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        border: 0,
        borderBottom: `1px solid ${colors.border}`,
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <span style={{ flex: 1, color: colors.text, fontSize: 15 }}>{label}</span>
      <span style={{ color: colors.accent, fontSize: 16, fontWeight: 600 }}>{value}</span>
      <span aria-hidden style={{ color: colors.textMuted }}>
        ›
      </span>
    </button>
  );
}
