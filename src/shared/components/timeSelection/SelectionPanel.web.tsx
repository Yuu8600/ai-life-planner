import { useRef } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import { useTheme } from '@/shared/theme';
import { ModalHeader } from '../ModalHeader';
import { useModalFocus } from '../useModalFocus.web';
import type { SelectionPanelProps } from './SelectionPanel';
export type { PanelAnchor, SelectionPanelProps } from './SelectionPanel';
export function SelectionPanel({ title, anchor, onCancel, children }: SelectionPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { colors, radius, spacing, surfaces } = useTheme();
  const { width, height } = useWindowDimensions();
  useModalFocus(ref, onCancel);
  const desktop = width >= 768,
    panelWidth = Math.min(surfaces.popoverMaxWidth, width - 32),
    panelHeight = Math.min(640, height - 32);
  const top = Math.max(16, Math.min(anchor.y + anchor.height + 8, height - panelHeight - 16));
  return (
    <Modal transparent visible accessibilityLabel={title} onRequestClose={onCancel}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: desktop ? colors.overlaySubtle : colors.overlay,
        }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onCancel();
        }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          data-testid="selection-panel"
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
            background: colors.surface,
            color: colors.textPrimary,
            borderRadius: radius.dialog,
            paddingBottom: 'max(0px, env(safe-area-inset-bottom))',
            boxShadow: `0 12px 36px ${colors.shadow}24`,
            outline: 'none',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ModalHeader title={title} onClose={onCancel} closeLabel={`${title}のパネルを閉じる`} />
          <div
            style={{
              minHeight: 0,
              overflowY: 'auto',
              padding: spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.md,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </Modal>
  );
}
