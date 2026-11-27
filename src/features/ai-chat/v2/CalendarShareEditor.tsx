import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import type { CalendarEvent } from '@/features/calendar';
import { ActionButton } from '@/shared/components/ActionButton';
import { DeadlineField } from '@/shared/components/DeadlineField';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { OptionGroup } from '@/shared/components/OptionGroup';
import { formatCalendarDateJa, formatDateInput } from '@/shared/dateInput';
import { useTheme } from '@/shared/theme';

import type { CalendarShare } from './repository';

export type ReadShareableCalendar = (
  date: string,
) => Promise<{ events: CalendarEvent[]; timezone: string; warning?: string }>;

export function CalendarShareEditor({
  initialDate,
  readEvents,
  close,
  apply,
  autoPrepare = false,
}: {
  initialDate: string;
  autoPrepare?: boolean;
  readEvents?: ReadShareableCalendar;
  close: () => void;
  apply: (date: string, share?: CalendarShare) => void;
}) {
  const [date, setDate] = useState(() => initialDate || formatDateInput(new Date()));
  const [mode, setMode] = useState(autoPrepare ? 'selected_event_details' : 'none');
  const request = useRef({ version: 0 });
  const [loaded, setLoaded] = useState<Awaited<ReturnType<ReadShareableCalendar>>>();
  const events = loaded?.events;
  const dateTime =
    loaded &&
    new Intl.DateTimeFormat('ja-JP', {
      timeZone: loaded.timezone,
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    });
  const [selected, setSelected] = useState<number[]>([]);
  const [location, setLocation] = useState(false);
  const [busy, setBusy] = useState(autoPrepare);
  const [error, setError] = useState('');
  const { colors, spacing, typography } = useTheme();
  const day = date.trim();
  const valid =
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day;
  const chosen = selected.map((index) => events?.[index]).filter((event) => event !== undefined);
  const load = useCallback(async () => {
    if (!valid || !readEvents) return;
    const version = ++request.current.version;
    setBusy(true);
    setError('');
    try {
      const result = await readEvents(day);
      if (request.current.version !== version) return;
      setLoaded({
        ...result,
        events: result.events.filter((event) => event.status !== 'canceled'),
      });
      setSelected([]);
    } catch {
      if (request.current.version === version)
        setError('予定を取得できません。予定タブで権限を確認するか、共有なしで続けてください。');
    } finally {
      if (request.current.version === version) setBusy(false);
    }
  }, [day, readEvents, valid]);
  useEffect(() => {
    let active = true;
    const state = request.current;
    const version = ++state.version;
    if (autoPrepare && readEvents && valid) {
      void readEvents(day).then(
        (result) => {
          if (!active || request.current.version !== version) return;
          setLoaded({
            ...result,
            events: result.events.filter((event) => event.status !== 'canceled'),
          });
          setSelected([]);
          setBusy(false);
        },
        () => {
          if (!active || request.current.version !== version) return;
          setError('予定を取得できません。予定タブで権限を確認するか、共有なしで続けてください。');
          setBusy(false);
        },
      );
    }
    return () => {
      active = false;
      state.version++;
    };
  }, [autoPrepare, readEvents, valid, day]);
  function confirm() {
    if (mode === 'availability_summary' && events && !loaded?.warning) {
      apply(day, { mode, date: day, hasEvents: events.length > 0 });
    } else if (mode === 'selected_event_details' && chosen.length) {
      apply(day, {
        mode,
        date: day,
        includeLocation: location,
        events: chosen.map((event) => ({
          title: event.title.slice(0, 160),
          startAt: event.startAt,
          endAt: event.endAt,
          ...(location && event.location ? { location: event.location.slice(0, 120) } : {}),
        })),
      });
    } else if (mode === 'none') {
      apply(initialDate);
    }
  }
  return (
    <ModalFrame
      title={autoPrepare ? '予定の共有確認' : '参照情報'}
      onClose={close}
      footer={
        <ActionButton
          label={mode === 'none' ? '共有しない' : '次の送信に使う'}
          variant={mode === 'none' ? 'secondary' : 'primary'}
          onPress={confirm}
          disabled={
            busy ||
            (mode === 'availability_summary' && !!loaded?.warning) ||
            (mode !== 'none' &&
              (!valid || !events || (mode === 'selected_event_details' && !chosen.length))) ||
            (!!day && !valid)
          }
        />
      }
    >
      {readEvents ? (
        <OptionGroup
          label="カレンダー共有"
          disabled={busy}
          selectedValue={mode}
          onChange={setMode}
          options={[
            { value: 'none', label: 'なし' },
            { value: 'availability_summary', label: '予定の有無' },
            { value: 'selected_event_details', label: '選んだ予定の詳細' },
          ]}
        />
      ) : null}
      {mode !== 'none' ? (
        <DeadlineField
          allowClear={false}
          emptyLabel="日付を選ぶ"
          accessibilityLabel="対象日"
          label="対象日"
          disabled={busy}
          error={day && !valid ? '実在する日付を入力してください。' : undefined}
          value={date}
          onChange={(value) => {
            setDate(value);
            setBusy(autoPrepare);
            setLoaded(undefined);
            setSelected([]);
            setError('');
          }}
        />
      ) : (
        <Notice message="予定は共有しません。共有する場合は上の方法を選んでください。" />
      )}
      {mode !== 'none' ? (
        <>
          <Notice message="選んだ予定と相談文を次の送信でOpenAI APIへ送ります。相談文と回答はアプリの履歴に残りません。推薦方針を承認すると種類・対象・期間が保存されます。" />
          {loaded?.warning ? <Notice tone="warning" message={loaded.warning} /> : null}
          {!events ? (
            <ActionButton
              label={autoPrepare ? '予定を再読み込み' : '端末の予定を確認'}
              loading={busy}
              variant="secondary"
              disabled={!valid || !readEvents}
              onPress={() => void load()}
            />
          ) : null}
          {error ? <Notice tone="warning" message={error} /> : null}
          {events && mode === 'availability_summary' ? (
            <Text style={{ color: colors.textPrimary }}>
              {formatCalendarDateJa(day)} ・ {events.length ? '予定あり' : '予定なし'}
            </Text>
          ) : null}
          {events && mode === 'selected_event_details' ? (
            <>
              <OptionGroup
                label="場所"
                selectedValue={location ? 'yes' : 'no'}
                disabled={busy}
                options={[
                  { value: 'no', label: '共有しない' },
                  { value: 'yes', label: '共有する' },
                ]}
                onChange={(value) => setLocation(value === 'yes')}
              />
              <Text style={{ color: colors.textSecondary }}>
                最大12件。日時はアプリで設定した時間帯で表示します。
              </Text>
              {events.length === 0 ? (
                <Text style={{ color: colors.textSecondary }}>対象日の予定はありません。</Text>
              ) : null}
              {events.map((event, index) => {
                const checked = selected.includes(index);
                return (
                  <View
                    key={JSON.stringify([event.calendarId, event.id, event.startAt])}
                    style={{ gap: spacing.xs }}
                  >
                    <ActionButton
                      label={`${checked ? '✓ ' : ''}${event.title.slice(0, 160)}${event.allDay ? '（終日）' : ''}`}
                      variant={checked ? 'secondary' : 'ghost'}
                      disabled={!checked && selected.length >= 12}
                      onPress={() =>
                        setSelected((old) =>
                          checked ? old.filter((value) => value !== index) : [...old, index],
                        )
                      }
                    />
                    {checked ? (
                      <Text style={{ ...typography.secondary, color: colors.textSecondary }}>
                        {dateTime?.format(new Date(event.startAt))} ～{' '}
                        {dateTime?.format(new Date(event.endAt))}
                        {location && event.location ? `\n場所 ${event.location.slice(0, 120)}` : ''}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </>
          ) : null}
        </>
      ) : null}
    </ModalFrame>
  );
}
