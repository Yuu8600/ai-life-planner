import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
// A duration picker can open above an edit dialog. Only the front layer owns keys.
const layers: symbol[] = [];
let bodyOverflow = '';
/** Stable lifecycle: draft/validation/loading updates must not move keyboard focus. */
export function useModalFocus(ref: RefObject<HTMLElement | null>, onDismiss: () => void) {
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer = Symbol('modal');
    if (layers.length === 0) bodyOverflow = document.body.style.overflow;
    layers.push(layer);
    document.body.style.overflow = 'hidden';
    const frame = requestAnimationFrame(() => {
      if (layers.at(-1) === layer) ref.current?.focus();
    });
    const keydown = (event: KeyboardEvent) => {
      if (layers.at(-1) !== layer) return;
      if (event.key !== 'Tab') return;
      const controls = [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ) ?? []),
      ].filter(
        (node) => node.getClientRects().length && node.getAttribute('aria-disabled') !== 'true',
      );
      const first = controls[0],
        last = controls.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current ||
          !ref.current?.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    // Match React Native Web's keyup phase so a single Escape cannot close the
    // picker on keydown and then its newly exposed parent on keyup.
    const keyup = (event: KeyboardEvent) => {
      if (layers.at(-1) !== layer || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      dismiss.current();
    };
    document.addEventListener('keydown', keydown, true);
    document.addEventListener('keyup', keyup, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keydown, true);
      document.removeEventListener('keyup', keyup, true);
      const wasFront = layers.at(-1) === layer;
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
      if (layers.length === 0) document.body.style.overflow = bodyOverflow;
      if (wasFront && previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [ref]);
}
