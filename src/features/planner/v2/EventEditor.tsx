import { useRef, useState } from 'react';
import { Text } from 'react-native';
import { formatCalendarDateJa } from '@/shared/dateInput';
import { ActionButton } from '@/shared/components/ActionButton';
import { FormField, FormInput } from '@/shared/components/FormField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { TimeSelectionRow } from '@/shared/components/timeSelection/TimeSelectionRow';
import { addLocalDays, getPlanningInstant } from '@/features/today';
import { useTheme } from '@/shared/theme';
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
  fixedOnly = false,
}: {
  date: string;
  timezone: string;
  close: () => void;
  save: (event: LocalEvent) => Promise<void>;
  fixedOnly?: boolean;
}) {
  const [kind, setKind] = useState<'fixed' | 'flexible'>('fixed');
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState(fixedOnly ? '09:00' : '');
  const [to, setTo] = useState(fixedOnly ? '10:00' : '');
  const [offset, setOffset] = useState('0');
  const { colors, typography } = useTheme();
  const [length, setLength] = useState('30');
  const [before, setBefore] = useState('0');
  const [after, setAfter] = useState('0');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const [initialSnapshot] = useState(() =>
    JSON.stringify({ kind, title, from, to, offset, length, before, after }),
  );
  const dirty =
    JSON.stringify({ kind, title, from, to, offset, length, before, after }) !== initialSnapshot;
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError('');
    try {
      const startAt = readPlanTime(from, date, timezone);
      const endAt = readPlanTime(fixedOnly && offset === '1' ? `翌日 ${to}` : to, date, timezone);
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
      lock.current = false;
      setPending(false);
    }
  }
  return (
    <ModalFrame
      title="アプリ内予定を追加"
      onClose={close}
      closeDisabled={pending}
      dirty={dirty}
      footer={<ActionButton label="予定を保存" loading={pending} onPress={() => void submit()} />}
    >
      {!fixedOnly ? (
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
      ) : null}
      <FormField label="予定名">
        <FormInput
          accessibilityLabel="予定名"
          placeholder="例：打ち合わせ"
          editable={!pending}
          maxLength={200}
          value={title}
          onChangeText={setTitle}
        />
      </FormField>
      {fixedOnly ? (
        <>
          <TimeSelectionRow label="開始" value={from} disabled={pending} onChange={setFrom} />
          <TimeSelectionRow
            label="終了"
            value={to}
            dayOffset={offset}
            disabled={pending}
            onChange={(time, dayOffset) => {
              setTo(time);
              setOffset(dayOffset ?? '0');
            }}
          />
          <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
            {formatCalendarDateJa(date)} の予定として登録し、おすすめの時間判定に使います。
          </Text>
        </>
      ) : (
        <>
          <FormField label="開始（HH:MM）">
            <FormInput
              editable={!pending}
              placeholder="12:00"
              value={from}
              onChangeText={setFrom}
            />
          </FormField>
          <FormField label="終了（HH:MM）">
            <FormInput editable={!pending} placeholder="13:00" value={to} onChangeText={setTo} />
          </FormField>
        </>
      )}
      {fixedOnly ? null : kind === 'fixed' ? (
        <>
          <FormField label="前の移動時間（分）">
            <FormInput
              editable={!pending}
              keyboardType="number-pad"
              value={before}
              onChangeText={setBefore}
            />
          </FormField>
          <FormField label="後の移動時間（分）">
            <FormInput
              editable={!pending}
              keyboardType="number-pad"
              value={after}
              onChangeText={setAfter}
            />
          </FormField>
        </>
      ) : (
        <FormField label="所要時間（分）">
          <FormInput
            editable={!pending}
            keyboardType="number-pad"
            value={length}
            onChangeText={setLength}
          />
        </FormField>
      )}
      {error ? <Notice tone="error" message={error} /> : null}
    </ModalFrame>
  );
}
