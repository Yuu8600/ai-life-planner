import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatLocalTimeJa, getLocalDate } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { appAlert } from '@/shared/feedback/appAlert';
import { colors, spacing, typography } from '@/shared/theme';
import { DEMO_AFTERNOON, DEMO_TIMEZONE } from '@/services/demo/sampleData';

import { useDemo } from './DemoProvider';

export function DemoBanner() {
  const [expanded, setExpanded] = useState(false);
  const { repositories, reset, advance, overnight } = useDemo();
  const now = repositories.now();
  const afternoon = now.toISOString() === DEMO_AFTERNOON;
  return (
    <View style={styles.banner}>
      <View style={styles.row}>
        <View style={styles.copy}>
          <Text style={styles.title}>デモ時計（実際の時刻と別）</Text>
          <Text accessibilityLiveRegion="polite" style={styles.detail}>
            {getLocalDate(now, DEMO_TIMEZONE)} {formatLocalTimeJa(now, DEMO_TIMEZONE)}（東京）
          </Text>
        </View>
        <ActionButton
          label={expanded ? '時計・リセットを閉じる' : '時計・リセット'}
          expanded={expanded}
          onPress={() => setExpanded((value) => !value)}
          style={styles.toggle}
          variant="ghost"
        />
      </View>
      {expanded ? (
        <View style={styles.panel}>
          <Text style={styles.detail}>
            時計はそのままで試せます。デモの変更はこのタブのメモリに保存され、再読み込みやリセットで消えます。
          </Text>
          <View style={styles.actions}>
            <ActionButton
              label={afternoon ? '15:00に進めました' : '時計を15:00に進める'}
              disabled={afternoon}
              onPress={advance}
              variant="ghost"
            />
            <ActionButton label="時計を翌日01:00に進める" onPress={overnight} variant="ghost" />
            <ActionButton
              label="デモをリセット"
              variant="secondary"
              onPress={() =>
                appAlert.alert(
                  'デモを初期状態に戻しますか？',
                  '追加したデータ・計画・履歴を消して、08:00のサンプルからやり直します。',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    { text: 'リセット', onPress: reset },
                  ],
                )
              }
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderColor: colors.borderSubtle,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.sm,
  },
  copy: { flexBasis: 175, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  title: { ...typography.caption, color: colors.primary },
  detail: { ...typography.caption, color: colors.textSecondary },
  toggle: { paddingHorizontal: spacing.sm },
  panel: { gap: spacing.sm, paddingVertical: spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
