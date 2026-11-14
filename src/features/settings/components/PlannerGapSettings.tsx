import { useEffect, useState } from 'react';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { FormField, FormInput } from '@/shared/components/FormField';
import { Notice } from '@/shared/components/Notice';
import { spacing } from '@/shared/theme';
import type { DailyPlanningRepository } from '@/features/planner/v2/repository';

export function PlannerGapSettings({ repository }: { repository: DailyPlanningRepository }) {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    void repository.getGap().then(
      (gap) => {
        if (!active) return;
        setValue(String(gap));
        setOriginal(String(gap));
      },
      () => {
        if (active) setMessage('余裕時間の設定を取得できませんでした。');
      },
    );
    return () => {
      active = false;
    };
  }, [repository]);
  const valid = /^\d{1,3}$/.test(value) && Number(value) <= 240;
  async function save() {
    setPending(true);
    setMessage('');
    try {
      await repository.setGap(Number(value));
      setOriginal(String(Number(value)));
      setValue(String(Number(value)));
      setMessage('Task間の余裕を保存しました。');
    } catch {
      setMessage('余裕時間を保存できませんでした。');
    } finally {
      setPending(false);
    }
  }
  return (
    <Card style={{ gap: spacing.sm }}>
      <FormField
        label="異なるTask間の余裕（分）"
        helper="0〜240分。新たに配置する作業枠に適用します。"
      >
        <FormInput
          value={value}
          editable={Boolean(original) && !pending}
          keyboardType="number-pad"
          onChangeText={(text) => {
            setValue(text);
            setMessage('');
          }}
        />
      </FormField>
      <ActionButton
        label="余裕時間を保存"
        variant="secondary"
        disabled={!valid || value === original}
        loading={pending}
        onPress={() => void save()}
      />
      {message ? <Notice tone="info" message={message} /> : null}
    </Card>
  );
}
