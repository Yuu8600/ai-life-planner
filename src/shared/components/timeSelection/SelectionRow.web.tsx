import { useState } from 'react';
import { useTheme } from '@/shared/theme';
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
  const { colors: c, spacing, controls, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <button
      type="button"
      aria-label={`${label}、${value}`}
      aria-haspopup="dialog"
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={(event) => {
        const r = event.currentTarget.getBoundingClientRect();
        onOpen({ x: r.left, y: r.top, width: r.width, height: r.height });
      }}
      style={{
        width: '100%',
        minHeight: 56,
        padding: `${spacing.md}px 0`,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) 16px',
        alignItems: 'center',
        gap: spacing.md,
        border: 0,
        borderBottom: `1px solid ${c.borderSubtle}`,
        background: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit',
        textAlign: 'left',
        ...(focused
          ? {
              outline: `${controls.focusWidth}px solid ${c.focusRing}`,
              outlineOffset: controls.focusOffset,
            }
          : {}),
      }}
    >
      <span
        style={{
          color: disabled ? c.disabledText : c.textPrimary,
          fontSize: typography.body.fontSize,
          lineHeight: 1.5,
          overflowWrap: 'anywhere',
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: disabled ? c.disabledText : c.primary,
          fontSize: typography.bodyStrong.fontSize,
          lineHeight: 1.5,
          fontWeight: 600,
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </span>
      <span aria-hidden style={{ color: c.textSecondary }}>
        ›
      </span>
    </button>
  );
}
