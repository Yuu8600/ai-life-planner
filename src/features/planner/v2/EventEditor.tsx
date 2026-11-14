import { useState } from 'react';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { addLocalDays, getPlanningInstant } from '@/features/today';
import type { LocalEvent } from './repository';

export function readPlanTime(value: string, date: string, timezone: string) {
  const match = /^(?:(翌日)\s+)?((?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value.trim());
  if (!match) throw new Error('時刻をHH:MMまたは翌日 HH:MMで入力してください。');
  return getPlanningInstant(match[1] ? addLocalDays(date, 1) : date, match[2], timezone);
}

export function EventEditor({
  date,
  timezone,
  close,
  save,
}: {
  date: string;
  timezone: string;
  close: () => void;
  save: (event: LocalEvent) => Promise<void>;
}) {
  const [kind, setKind] = useState<'fixed' | 'flexible'>('fixed');
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [length, setLength] = useState('30');
  const [before, setBefore] = useState('0');
  const [after, setAfter] = useState('0');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  async function submit() {
    setPending(true);
    setError('');
    try {
      const startAt = readPlanTime(from, date, timezone);
      const endAt = readPlanTime(to, date, timezone);
      const minutes = (Date.parse(endAt) - Date.parse(startAt)) / 60_000;
      if (!title.trim() || minutes <= 0 || minutes > 1500)
        throw new Error('予定名と開始・終了時刻を確認してください。');
      const base = { id: '', title: title.trim(), startAt, endAt };
      if (kind === 'flexible') {
        const duration = Number(length);
        if (!Number.isInteger(duration) || duration < 1 || duration > minutes)
          throw new Error('作業時間は指定時間帯に収まる分数にしてください。');
        await save({ ...base, kind, duration });
      } else {
        const travel = [Number(before), Number(after)];
        if (travel.some((value) => !Number.isInteger(value) || value < 0 || value > 240))
          throw new Error('移動時間は0〜240分で入力してください。');
        await save({ ...base, kind, before: travel[0], after: travel[1] });
      }
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : '予定を保存できませんでした。');
    } finally {
      setPending(false);
    }
  }
  return (
    <ModalFrame
      title="アプリ内予定を追加"
      onClose={close}
      closeDisabled={pending}
      footer={<ActionButton label="予定を保存" loading={pending} onPress={() => void submit()} />}
    >
      <OptionGroup
        label="予定の種類"
        options={[
          { label: '固定予定', value: 'fixed' },
          { label: '柔軟な生活予定', value: 'flexible' },
        ]}
        selectedValue={kind}
        disabled={pending}
        onChange={(value) => setKind(value === 'fixed' ? 'fixed' : 'flexible')}
      />
      <FormField label="予定名">
        <FormInput maxLength={200} value={title} onChangeText={setTitle} />
      </FormField>
      <FormField label="開始（HH:MM）">
        <FormInput placeholder="12:00" value={from} onChangeText={setFrom} />
      </FormField>
      <FormField label="終了（HH:MM）">
        <FormInput placeholder="13:00" value={to} onChangeText={setTo} />
      </FormField>
      {kind === 'fixed' ? (
        <>
          <FormField label="前の移動時間（分）">
            <FormInput keyboardType="number-pad" value={before} onChangeText={setBefore} />
          </FormField>
          <FormField label="後の移動時間（分）">
            <FormInput keyboardType="number-pad" value={after} onChangeText={setAfter} />
          </FormField>
        </>
      ) : (
        <FormField label="所要時間（分）">
          <FormInput keyboardType="number-pad" value={length} onChangeText={setLength} />
        </FormField>
      )}
      {error ? <Notice tone="error" message={error} /> : null}
    </ModalFrame>
  );
}
