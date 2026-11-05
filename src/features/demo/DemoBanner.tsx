import { StyleSheet, Text, View } from 'react-native';

import { formatLocalTimeJa } from '@/features/today';
import { ActionButton } from '@/shared/components/ActionButton';
import { appAlert } from '@/shared/feedback/appAlert';
import { colors, spacing } from '@/shared/theme';
import { DEMO_AFTERNOON, DEMO_TIMEZONE } from '@/services/demo/sampleData';

import { useDemo } from './DemoProvider';

export function DemoBanner() {
  const { repositories, reset, advance } = useDemo();
  const afternoon = repositories.now().toISOString() === DEMO_AFTERNOON;
  return (
    <View style={styles.banner}>
      <View style={styles.copy}>
        <Text style={styles.title}>AI Life Planner · Demo Mode</Text>
        <Text style={styles.detail}>サンプル予定・API不要・再読み込みでリセット</Text>
        <Text style={styles.detail}>
          サンプル時計: 2026/11/06 {formatLocalTimeJa(repositories.now(), DEMO_TIMEZONE)}（東京）
        </Text>
      </View>
      <View style={styles.actions}>
        <ActionButton
          label={afternoon ? '15:00に進めました' : '時計を15:00に進める'}
          disabled={afternoon}
          onPress={advance}
          variant="ghost"
        />
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
  );
}
const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.accentSoft,
    padding: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  copy: { flexShrink: 1, gap: 2 },
  title: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  detail: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
