import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { Card } from '@/shared/components/Card';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { appAlert } from '@/shared/feedback/appAlert';
import { spacing, typography, useThemeColors } from '@/shared/theme';
import type { LoadedDay } from './dayService';
import { timelineWindow } from './timelineEntries';

export function CalendarAgenda({
  day,
  time,
  onAdd,
  onRemove,
  onOpenPlan,
}: {
  day: LoadedDay;
  time: (value: string) => string;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onOpenPlan: () => void;
}) {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const [showBlocked, setShowBlocked] = useState(false);
  const window = timelineWindow(day);
  const events = day.events
    .filter(
      (item) =>
        Date.parse(item.startAt) < Date.parse(window.endAt) &&
        Date.parse(item.endAt) > Date.parse(window.startAt),
    )
    .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  return (
    <>
      <Card>
        <SectionHeader title="アプリ内の予定" />
        {!events.length ? <Text style={styles.muted}>固定予定・生活予定はありません。</Text> : null}
        {events.map((item) => (
          <View style={styles.row} key={item.id}>
            <View style={styles.label}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.muted}>
                {time(item.startAt)}〜{time(item.endAt)} ·{' '}
                {item.kind === 'fixed' ? '固定' : `生活予定 ${item.duration}分`}
              </Text>
              {item.kind === 'fixed' && (item.before > 0 || item.after > 0) ? (
                <Text style={styles.muted}>
                  移動 前{item.before}分／後{item.after}分
                </Text>
              ) : null}
            </View>
            <ActionButton
              label="削除"
              variant="ghost"
              accessibilityLabel={`${item.title}を削除`}
              onPress={() =>
                appAlert.alert('予定を削除しますか？', item.title, [
                  { text: 'キャンセル', style: 'cancel' },
                  { text: '削除', style: 'destructive', onPress: () => onRemove(item.id) },
                ])
              }
            />
          </View>
        ))}
        <ActionButton label="予定を追加" onPress={onAdd} />
      </Card>
      <Card>
        <SectionHeader title="iPhoneカレンダー" detail="読み取り専用" />
        {day.deviceEvents
          .filter((item) => item.status !== 'canceled')
          .map((item) => (
            <View
              key={`${item.calendarId}:${item.instanceId ?? item.id}:${item.startAt}`}
              style={styles.row}
            >
              <Text style={styles.muted}>
                {item.allDay ? '終日' : `${time(item.startAt)}〜${time(item.endAt)}`}
              </Text>
              <Text style={[styles.title, styles.label]}>{item.title || '名称未設定の予定'}</Text>
            </View>
          ))}
        {!day.calendarError && !day.deviceEvents.some((item) => item.status !== 'canceled') ? (
          <Text style={styles.muted}>この日のiPhone予定はありません。</Text>
        ) : null}
      </Card>
      <ActionButton label="この日の作業計画を開く" variant="secondary" onPress={onOpenPlan} />
      {day.input.busy.length ? (
        <ActionButton
          label={showBlocked ? '配置できない時間を隠す' : '配置できない時間を見る'}
          variant="ghost"
          expanded={showBlocked}
          onPress={() => setShowBlocked(!showBlocked)}
        />
      ) : null}
      {showBlocked ? (
        <Card>
          {day.input.busy.map((block, index) => (
            <Text style={styles.muted} key={`${block.startAt}:${index}`}>
              {time(block.startAt)}〜{time(block.endAt)}
            </Text>
          ))}
        </Card>
      ) : null}
    </>
  );
}
const createStyles = (colors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
    label: { flex: 1, minWidth: 120 },
    title: { ...typography.bodyStrong, color: colors.textPrimary },
    muted: { ...typography.secondary, color: colors.textSecondary },
  });
