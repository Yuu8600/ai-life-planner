import {
  createTaskFormValues,
  validateTaskForm,
  type TaskFormValues,
} from '@/features/tasks/validation';

const ownGoalId = '22222222-2222-4222-8222-222222222222';
const validValues: TaskFormValues = {
  deadline: '2026-10-25',
  estimatedMinutes: '30',
  goalId: ownGoalId,
  priority: 'high',
  status: 'scheduled',
  title: ' TOEIC Listening ',
};

describe('Task validation', () => {
  it('normalizes valid values and permits an owned Goal', () => {
    const result = validateTaskForm(validValues, new Set([ownGoalId]));

    expect(result.errors).toBeNull();
    expect(result.input).toEqual(
      expect.objectContaining({
        estimatedMinutes: 30,
        goalId: ownGoalId,
        priority: 'high',
        status: 'scheduled',
        title: 'TOEIC Listening',
      }),
    );
    expect(result.input?.deadline).toEqual(expect.any(String));
    expect(Number.isNaN(Date.parse(result.input?.deadline ?? ''))).toBe(false);
  });

  it('creates a Goalなし task and converts an empty deadline to null', () => {
    const result = validateTaskForm(
      { ...validValues, deadline: '', goalId: '' },
      new Set([ownGoalId]),
    );

    expect(result.input).toEqual(expect.objectContaining({ deadline: null, goalId: null }));
  });

  it.each(['', '0', '-1', '1.5', '12分', '2147483648'])(
    'rejects invalid estimated_minutes: %s',
    (estimatedMinutes) => {
      const result = validateTaskForm({ ...validValues, estimatedMinutes }, new Set([ownGoalId]));

      expect(result.errors?.estimatedMinutes).toBe('所要時間は1以上の整数で入力してください。');
    },
  );

  it('rejects a blank title, invalid deadline, priority, and status', () => {
    const result = validateTaskForm(
      {
        ...validValues,
        deadline: '2026-02-30',
        priority: 'urgent',
        status: 'paused',
        title: '   ',
      },
      new Set([ownGoalId]),
    );

    expect(result.errors).toEqual(
      expect.objectContaining({
        deadline: '期限はYYYY-MM-DD形式の実在する日付で入力してください。',
        priority: '優先度を選択してください。',
        status: '状態を選択してください。',
        title: 'タイトルを入力してください。',
      }),
    );
  });

  it('rejects a Goal that is not in the signed-in user options', () => {
    const result = validateTaskForm(validValues, new Set());

    expect(result.errors?.goalId).toBe('ログイン中のユーザーが所有するGoalを選択してください。');
  });

  it('maps a Task with goal_id null back to a Goalなし form value', () => {
    expect(
      createTaskFormValues({
        createdAt: '2026-09-13T00:00:00+00:00',
        deadline: null,
        estimatedMinutes: 20,
        goalId: null,
        id: 'task-id',
        priority: 'medium',
        status: 'pending',
        title: '金フレ',
        updatedAt: '2026-09-13T00:00:00+00:00',
        userId: '11111111-1111-4111-8111-111111111111',
      }).goalId,
    ).toBe('');
  });
});
