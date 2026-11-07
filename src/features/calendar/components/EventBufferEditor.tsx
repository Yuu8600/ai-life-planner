import { useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { ActionButton } from '@/shared/components/ActionButton';
import { colors, spacing, radius } from '@/shared/theme';
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
    <View style={styles.card} testID="event-buffer-editor">
      <Text accessibilityRole="header">余白設定: {event.title}</Text>
      <Text>{timeLabel}</Text>
      <Text>
        共通設定: 前{commonBefore}分・後{commonAfter}分
      </Text>
      <Text>現在の選択: {custom ? 'この予定だけ変更する' : '共通設定を使う'}</Text>
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
          <Text>予定前の余白（分）</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="この予定の前の余白（分）"
            value={before}
            onChangeText={setBefore}
            keyboardType="number-pad"
            editable={!saving}
          />
          <Text>予定後の余白（分）</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="この予定の後の余白（分）"
            value={after}
            onChangeText={setAfter}
            keyboardType="number-pad"
            editable={!saving}
          />
        </>
      ) : (
        <Text>保存すると個別設定を解除し、共通設定へ戻ります。</Text>
      )}
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      <ActionButton
        label={saving ? '保存中…' : '余白設定を保存'}
        disabled={saving}
        onPress={() => void save()}
      />
      <ActionButton label="キャンセル" disabled={saving} onPress={onClose} variant="ghost" />
      <Text>端末の予定は変更しません。保存済みの計画への反映には再計画が必要です。</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.sm,
    marginVertical: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  input: {
    minHeight: 48,
    padding: spacing.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    color: colors.text,
  },
});
