import * as Haptics from 'expo-haptics';
/** Optional feedback must never affect a successful persistence operation. */
export function successFeedback(): void {
  try {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    /* Unsupported native environment. */
  }
}
