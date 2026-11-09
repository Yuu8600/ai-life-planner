import { useEffect } from 'react';

import {
  discardMessage,
  discardTitle,
  SettingsCloseControl,
  type SettingsCloseControlProps,
} from '@/features/settings/components/SettingsCloseControl';

export function SettingsExitControl(props: SettingsCloseControlProps) {
  const { dirty, isSaving } = props;

  useEffect(() => {
    if (!dirty && !isSaving) return;

    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const navigate = (event: NavigateEvent) => {
      // Expo Router handles app-initiated history changes. The close control
      // confirms before it asks Expo Router to go back or replace the route.
      if (
        event.navigationType !== 'traverse' ||
        !event.userInitiated ||
        !event.destination.sameDocument ||
        !event.cancelable
      )
        return;

      if (isSaving || !window.confirm(discardTitle + '\n\n' + discardMessage)) {
        event.preventDefault();
      }
    };

    window.addEventListener('beforeunload', beforeUnload);
    window.navigation?.addEventListener('navigate', navigate);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.navigation?.removeEventListener('navigate', navigate);
    };
  }, [dirty, isSaving]);

  return <SettingsCloseControl {...props} />;
}
