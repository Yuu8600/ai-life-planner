import type { AlertButton } from 'react-native';

/** React Native Web's Alert is a no-op. Keep confirmation explicit in the browser. */
export const appAlert = {
  alert(title: string, message?: string, buttons: AlertButton[] = []) {
    if (typeof window === 'undefined') return;
    const accepted = window.confirm([title, message].filter(Boolean).join('\n\n'));
    const button = accepted
      ? buttons.find((candidate) => candidate.style !== 'cancel')
      : buttons.find((candidate) => candidate.style === 'cancel');
    button?.onPress?.();
  },
};
