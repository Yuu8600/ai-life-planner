import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { confirmDiscardChanges } from '@/shared/feedback/confirmDiscardChanges';

export function ActionStepsExitGuard({ dirty, pending }: { dirty: boolean; pending: boolean }) {
  const navigation = useNavigation();
  usePreventRemove(dirty || pending, ({ data }) => {
    if (!pending) confirmDiscardChanges(dirty, () => navigation.dispatch(data.action));
  });
  return null;
}
