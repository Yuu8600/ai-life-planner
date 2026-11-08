import { useRef } from 'react';
import { Modal, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '@/shared/theme';
import type { ModalFrameProps } from './ModalFrame';
import { ModalHeader } from './ModalHeader';
import { useModalFocus } from './useModalFocus.web';
export type { ModalFrameProps } from './ModalFrame';
export function ModalFrame({
  title,
  description,
  children,
  footer,
  onClose,
  closeLabel,
  closeDisabled = false,
  testID,
}: ModalFrameProps) {
  const { colors, spacing, radius, surfaces, typography } = useTheme();
  const { width } = useWindowDimensions();
  const ref = useRef<HTMLDivElement>(null);
  const close = () => {
    if (!closeDisabled) onClose();
  };
  useModalFocus(ref, close);
  const mobile = width < 768;
  return (
    <Modal visible transparent accessibilityLabel={title} onRequestClose={close}>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: colors.overlay,
          display: 'flex',
          alignItems: mobile ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: mobile ? 0 : surfaces.dialogMargin,
        }}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) close();
        }}
      >
        <div
          ref={ref}
          tabIndex={-1}
          data-testid={testID}
          style={{
            width: '100%',
            maxWidth: surfaces.dialogMaxWidth,
            maxHeight: mobile ? '90dvh' : 'calc(100dvh - 32px)',
            background: colors.surface,
            color: colors.textPrimary,
            borderRadius: radius.dialog,
            display: 'flex',
            flexDirection: 'column',
            outline: 'none',
            boxShadow: `0 12px 36px ${colors.shadow}24`,
            paddingBottom: mobile ? 'env(safe-area-inset-bottom)' : 0,
          }}
        >
          <ModalHeader
            title={title}
            closeLabel={closeLabel}
            disabled={closeDisabled}
            onClose={close}
          />
          <div
            style={{
              minHeight: 0,
              overflowY: 'auto',
              padding: spacing.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: spacing.lg,
            }}
          >
            {description ? (
              <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
                {description}
              </Text>
            ) : null}
            {children}
          </div>
          {footer ? (
            <div
              style={{
                flexShrink: 0,
                padding: spacing.lg,
                borderTop: `1px solid ${colors.borderSubtle}`,
              }}
            >
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
