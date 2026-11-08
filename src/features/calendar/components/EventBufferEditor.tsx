import { DurationSelectionRow } from '@/shared/components/timeSelection/DurationSelectionRow';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing, typography } from '@/shared/theme';
import { ModalFrame } from '@/shared/components/ModalFrame';
import { Notice } from '@/shared/components/Notice';
import { Badge } from '@/shared/components/Badge';
import {
  eventBufferKey,
  validateEventBuffer,
  type CalendarEventBufferRepository,
  type CalendarEventBufferOverride,
} from '../eventBuffers';
import type { CalendarEvent } from '../types';

export function EventBufferEditor({
  event,
  timeLabel,
  commonBefore,
  commonAfter,
  individual,
  repository,
  onClose,
  onSaved,
}: {
  event: CalendarEvent;
  timeLabel: string;
  commonBefore: number;
  commonAfter: number;
  individual?: CalendarEventBufferOverride;
  repository: CalendarEventBufferRepository;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [custom, setCustom] = useState(Boolean(individual));
  const [before, setBefore] = useState(String(individual?.bufferBeforeMinutes ?? commonBefore));
  const [after, setAfter] = useState(String(individual?.bufferAfterMinutes ?? commonAfter));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    const value = {
      ...eventBufferKey(event),
      bufferBeforeMinutes: Number(before),
      bufferAfterMinutes: Number(after),
    };
    if (custom) {
      try {
        if (!/^\d+$/.test(before) || !/^\d+$/.test(after)) throw new Error();
        validateEventBuffer(value);
      } catch {
        setError('前後それぞれ0〜240分の整数で入力してください。');
        return;
      }
    }
    lock.current = true;
    setSaving(true);
    setError(null);
    try {
      if (custom) await repository.upsert(value);
      else await repository.remove(eventBufferKey(event));
      onSaved();
      onClose();
    } catch {
      setError('個別余白を保存できませんでした。もう一度お試しください。');
    } finally {
      lock.current = false;
      setSaving(false);
    }
  };
  return (
    <ModalFrame
      testID="event-buffer-editor"
      title="予定の余白"
      onClose={onClose}
      closeLabel="余白設定を閉じる"
      closeDisabled={saving}
      footer={
        <View style={styles.actions}>
          <ActionButton
            label={saving ? '保存中…' : '余白設定を保存'}
            disabled={saving}
            loading={saving}
            onPress={() => void save()}
          />
          <ActionButton label="キャンセル" disabled={saving} onPress={onClose} variant="ghost" />
        </View>
      }
    >
      <Text accessibilityRole="header" style={styles.title}>
        {event.title}
      </Text>
      <Text style={styles.time}>{timeLabel}</Text>
      <Text style={styles.detail}>
        共通設定: 前{commonBefore}分・後{commonAfter}分
      </Text>
      <Badge
        label={individual ? '個別設定を適用中' : '共通設定を適用中'}
        tone={individual ? 'accent' : 'neutral'}
      />
      <Text style={styles.detail}>
        現在の選択: {custom ? 'この予定だけ変更する' : '共通設定を使う'}
      </Text>
      <ActionButton
        label="共通設定を使う"
        disabled={saving}
        onPress={() => setCustom(false)}
        variant={custom ? 'secondary' : 'primary'}
      />
      <ActionButton
        label="この予定だけ変更する"
        disabled={saving}
        onPress={() => setCustom(true)}
        variant={custom ? 'primary' : 'secondary'}
      />
      {custom ? (
        <>
          <DurationSelectionRow
            label="この予定の前の余白"
            value={before}
            buffer
            onChange={setBefore}
            disabled={saving}
          />
          <DurationSelectionRow
            label="この予定の後の余白"
            value={after}
            buffer
            onChange={setAfter}
            disabled={saving}
          />
        </>
      ) : (
        <Text style={styles.detail}>保存すると個別設定を解除し、共通設定へ戻ります。</Text>
      )}
      {error ? <Notice tone="error" message={error} /> : null}
      <Text style={styles.detail}>
        端末の予定は変更しません。保存済みの計画への反映には再計画が必要です。
      </Text>
    </ModalFrame>
  );
}
const styles = StyleSheet.create({
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  time: { ...typography.bodyStrong, color: colors.calendar },
  detail: { ...typography.secondary, color: colors.textSecondary },
  actions: { gap: spacing.sm },
});
