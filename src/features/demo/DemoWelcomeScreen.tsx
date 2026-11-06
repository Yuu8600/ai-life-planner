import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { ScreenHeader } from '@/shared/components/ScreenHeader';
import { colors, radius, spacing } from '@/shared/theme';

export function DemoWelcomeScreen() {
  const router = useRouter();
  return (
    <AppScreen testID="demo-welcome">
      <ScreenHeader
        eyebrow="ログイン不要のWeb Demo"
        title="目標を、今日の行動に。"
        subtitle="Goals / Tasksとカレンダーの予定から空き時間を計算し、一日の計画を自動で作ります。"
      />
      <View style={styles.card}>
        <Text style={styles.title}>授業の合間に、TOEIC 730点へ</Text>
        <Text style={styles.body}>
          英単語30分、文法30分、リスニング45分、模試復習60分。大学や授業と重ならないよう、ルールベースのPlannerが配置します。
        </Text>
        <Text style={styles.flow}>Tasks → Calendar・空き時間 → Planner → Preview → Today</Text>
        <ActionButton label="サンプルのタスクから試す" onPress={() => router.push('/tasks')} />
        <ActionButton
          label="すぐに計画を作ってみる"
          onPress={() => router.push('/ai')}
          variant="secondary"
        />
      </View>
      <Text style={styles.note}>
        保存先はこのページを開いている間のメモリです。アカウント登録・端末カレンダーの許可・AI
        APIの課金は不要です。
      </Text>
      <Text style={styles.note}>
        時計はサンプル日の08:00から始まります。計画を保存し、完了・スキップした後、上の時計を15:00に進めると残りの時間で再計画できます。
      </Text>
    </AppScreen>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  title: { color: colors.text, fontSize: 21, lineHeight: 30, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 25 },
  flow: { color: colors.accent, fontSize: 14, lineHeight: 24, fontWeight: '600' },
  note: { color: colors.textMuted, fontSize: 13, lineHeight: 22, marginTop: spacing.lg },
});
