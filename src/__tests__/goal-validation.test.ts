import { validateGoalForm, type GoalFormValues } from '@/features/goals/validation';

const validValues: GoalFormValues = {
  currentValue: '530',
  deadline: '2026-10-25',
  description: ' 英語力を伸ばす ',
  priority: 'high',
  status: 'active',
  targetValue: '730.5',
  title: ' TOEIC ',
  unit: ' 点 ',
};

describe('Goal validation', () => {
  it('normalizes valid form values into repository input', () => {
    expect(validateGoalForm(validValues)).toEqual({
      errors: null,
      input: {
        currentValue: 530,
        deadline: '2026-10-25',
        description: '英語力を伸ばす',
        priority: 'high',
        status: 'active',
        targetValue: 730.5,
        title: 'TOEIC',
        unit: '点',
      },
    });
  });

  it('converts optional empty values to null', () => {
    const result = validateGoalForm({
      ...validValues,
      currentValue: '',
      deadline: '',
      description: '   ',
      targetValue: '',
      unit: '',
    });

    expect(result.input).toEqual(
      expect.objectContaining({
        currentValue: null,
        deadline: null,
        description: null,
        targetValue: null,
        unit: null,
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

  it('rejects invalid numeric values', () => {
    const result = validateGoalForm({
      ...validValues,
      currentValue: '12点',
      targetValue: 'Infinity',
    });

    expect(result.errors).toEqual(
      expect.objectContaining({
        currentValue: '整数または小数で入力してください。',
        targetValue: '整数または小数で入力してください。',
      }),
    );
  });

  it('rejects a non-existent deadline date', () => {
    const result = validateGoalForm({ ...validValues, deadline: '2026-02-30' });

    expect(result.errors?.deadline).toBe('期限はYYYY-MM-DD形式の実在する日付で入力してください。');
  });
});
