import { useEffect, useRef } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import { colors, radius, spacing } from '@/shared/theme';
import type { SelectionPanelProps } from './SelectionPanel';
export type { PanelAnchor, SelectionPanelProps } from './SelectionPanel';
export function SelectionPanel({ title, anchor, onCancel, children }: SelectionPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useWindowDimensions();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
      if (e.key === 'Tab') {
        const controls = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
          ) ?? []),
        ].filter((node) => node.getClientRects().length);
        const first = controls[0],
          last = controls.at(-1);
        if (!first) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !ref.current?.contains(document.activeElement) ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.body.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [onCancel]);
  if (typeof document === 'undefined') return null;
  const desktop = width >= 768,
    panelWidth = Math.min(400, width - 32),
    panelHeight = Math.min(640, height - 32);
  const top = Math.max(16, Math.min(anchor.y + anchor.height + 8, height - panelHeight - 16));
  return (
    <Modal transparent visible accessibilityLabel={title} onRequestClose={onCancel}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          background: desktop ? 'rgba(0,0,0,.12)' : 'rgba(0,0,0,.32)',
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onCancel();
        }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          style={{
            position: 'absolute',
            ...(desktop
              ? {
                  left: Math.max(16, Math.min(anchor.x, width - panelWidth - 16)),
                  top,
                  width: panelWidth,
                  maxHeight: panelHeight,
                }
              : { bottom: 0, left: 0, right: 0, maxHeight: '85dvh' }),
            overflowY: 'auto',
            background: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.lg,
            paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
            boxShadow: '0 8px 32px #0003',
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: spacing.md,
          }}
        >
          {children}
        </div>
      </div>
    </Modal>
  );
}
