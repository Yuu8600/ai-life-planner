import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
export const currentInstant = () => new Date();
export function useTimelineClock(now: () => Date, revision: number) {
  const [instant, setInstant] = useState(() => now());
  useEffect(() => {
    const update = () => setInstant(now());
    update();
    const timer = setInterval(update, 30_000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [now, revision]);
  return instant;
}
