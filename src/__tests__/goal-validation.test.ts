import { validateGoalForm, type GoalFormValues } from '@/features/goals/validation';

const validValues: GoalFormValues = {
  deadline: '2026-10-25',
  description: ' 英語力を伸ばす ',
  priority: 'high',
  status: 'active',
  title: ' TOEIC ',
};

describe('Goal validation', () => {
  it('normalizes valid form values into an editable goal payload', () => {
    expect(validateGoalForm(validValues)).toEqual({
      errors: null,
      input: {
        deadline: '2026-10-25',
        description: '英語力を伸ばす',
        priority: 'high',
        status: 'active',
        title: 'TOEIC',
      },
    });
  });

  it('converts optional empty values to null', () => {
    const result = validateGoalForm({
      ...validValues,
      deadline: '',
      description: '   ',
    });

    expect(result.input).toEqual(
      expect.objectContaining({
        deadline: null,
        description: null,
      }),
    );
  });

  it('rejects a blank title and values outside the database enums', () => {
    const result = validateGoalForm({
      ...validValues,
      priority: 'urgent',
      status: 'paused',
      title: '   ',
    });

    expect(result.errors).toEqual(
      expect.objectContaining({
        priority: '優先度を選択してください。',
        status: '状態を選択してください。',
        title: 'タイトルを入力してください。',
      }),
    );
  });

  it('rejects a non-existent deadline date', () => {
    const result = validateGoalForm({ ...validValues, deadline: '2026-02-30' });

    expect(result.errors?.deadline).toBe('期限はYYYY-MM-DD形式の実在する日付で入力してください。');
  });
});
