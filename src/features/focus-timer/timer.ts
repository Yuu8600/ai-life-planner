export type TimerTarget = {
  kind: 'task' | 'step';
  id: string;
  title: string;
  initialMinutes?: number | null;
};
export function defaultTimerMinutes(initialMinutes?: number | null): string {
  return typeof initialMinutes === 'number' &&
    Number.isInteger(initialMinutes) &&
    initialMinutes >= 1 &&
    initialMinutes <= 180
    ? String(initialMinutes)
    : '25';
}
export type FocusTimer = {
  target: TimerTarget;
  phase: 'ready' | 'running' | 'paused';
  remainingMs: number;
  deadlineMs: number | null;
};
export function remainingAt(timer: FocusTimer, now: number): number {
  return timer.phase === 'running' && timer.deadlineMs !== null
    ? Math.min(timer.remainingMs, Math.max(0, timer.deadlineMs - now))
    : timer.remainingMs;
}
export function startTimer(target: TimerTarget, value: string, now: number): FocusTimer {
  if (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 180)
    throw new Error('1〜180分の整数で入力してください。');
  const remainingMs = Number(value) * 60_000;
  return { target, phase: 'running', remainingMs, deadlineMs: now + remainingMs };
}
export function pauseTimer(timer: FocusTimer, now: number): FocusTimer {
  return { ...timer, phase: 'paused', remainingMs: remainingAt(timer, now), deadlineMs: null };
}
export function resumeTimer(timer: FocusTimer, now: number): FocusTimer {
  return { ...timer, phase: 'running', deadlineMs: now + timer.remainingMs };
}
export function formatRemaining(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
