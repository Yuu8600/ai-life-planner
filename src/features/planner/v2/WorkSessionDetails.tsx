import { Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { Notice } from '@/shared/components/Notice';
import { colors, spacing, typography } from '@/shared/theme';
import { sessionLabel } from './timelineEntries';
import type { PlanChange, WorkSession } from './types';

export function WorkSessionDetails({
  item,
  now,
  time,
  error,
  edit,
  suggest,
}: {
  item: WorkSession;
  now: number;
  time: (value: string) => string;
  error: string;
  edit: () => void;
  suggest: (change: PlanChange) => void;
}) {
  const scheduled = item.status === 'scheduled';
  const future = scheduled && Date.parse(item.startAt) > now;
  return (
    <>
      <Text style={{ ...typography.bodyStrong, color: colors.textPrimary }}>
        {time(item.startAt)}〜{time(item.endAt)} · {sessionLabel(item, now)}
        {item.locked && sessionLabel(item, now) !== '固定' ? ' ・固定' : ''}
      </Text>
      {error ? <Notice tone="error" message={error} /> : null}
      {scheduled ? (
        <View style={{ gap: spacing.sm }}>
          {future ? (
            <ActionButton label="開始・終了時刻を入力" variant="secondary" onPress={edit} />
          ) : null}
          {future && !item.locked ? (
            <ActionButton
              label="この時刻で固定"
              variant="secondary"
              onPress={() =>
                suggest({
                  kind: 'move',
                  id: item.id,
                  interval: { startAt: item.startAt, endAt: item.endAt },
                })
              }
            />
          ) : null}
          {item.locked ? (
            <ActionButton
              label="固定を解除"
              variant="secondary"
              onPress={() => suggest({ kind: 'unlock', id: item.id })}
            />
          ) : (
            <ActionButton
              label="あとで"
              variant="secondary"
              onPress={() => suggest({ kind: 'later', id: item.id })}
            />
          )}
          <ActionButton
            label="この作業枠を取りやめる"
            variant="ghost"
            onPress={() => suggest({ kind: 'skip', id: item.id })}
          />
        </View>
      ) : null}
    </>
  );
}
