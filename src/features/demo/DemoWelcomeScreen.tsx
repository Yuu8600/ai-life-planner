import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/shared/components/ActionButton';
import { AppScreen } from '@/shared/components/AppScreen';
import { Card } from '@/shared/components/Card';
import { colors, spacing, typography } from '@/shared/theme';

const steps = [
  { title: '計画を作る', detail: '予定の合間に、サンプルのタスクが自動で入ります。' },
  { title: '内容を見て保存する', detail: '何をいつやるか確認してから保存します。' },
  { title: '「今日」で試す', detail: '時間軸で予定を開き、完了やスキップを試せます。' },
];

export function DemoWelcomeScreen() {
  const router = useRouter();
  return (
    <AppScreen testID="demo-welcome" contentContainerStyle={styles.content}>
      <Card style={styles.hero}>
        <Text style={styles.eyebrow}>AI Life Planner · Webデモ</Text>
        <Text accessibilityRole="header" style={styles.heading}>
          空き時間を、目標のための時間に。
        </Text>
        <Text style={styles.body}>
          カレンダーの予定を避けて、やるべきタスクを1日の中に自動配置します。
        </Text>
        <Text style={styles.ready}>ログイン不要。サンプルですぐに試せます。</Text>
        <View style={styles.actions}>
          <ActionButton
            label="サンプルで計画を作ってみる"
            onPress={() => router.push('/ai')}
            style={styles.action}
          />
          <ActionButton
            label="タスクを見てから始める"
            onPress={() => router.push('/tasks')}
            style={styles.action}
            variant="secondary"
          />
        </View>
      </Card>

      <Text accessibilityRole="header" style={styles.sectionTitle}>
        3ステップで試す
      </Text>
      <View style={styles.steps}>
        {steps.map(({ title, detail }, index) => (
          <Card key={title} style={styles.step}>
            <Text style={styles.stepTitle}>
              {index + 1}. {title}
            </Text>
            <Text style={styles.body}>{detail}</Text>
          </Card>
        ))}
      </View>
      <Text style={styles.note}>
        デモの変更はこのタブを開いている間だけ保存されます。再読み込みやリセットで初期状態に戻ります。
      </Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { maxWidth: 880, gap: spacing.lg },
  hero: { padding: spacing.lg, gap: spacing.md, backgroundColor: colors.primarySoft },
  eyebrow: { ...typography.label, color: colors.primary },
  heading: { ...typography.screenTitle, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary },
  ready: { ...typography.bodyStrong, color: colors.textPrimary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, maxWidth: 560 },
  action: { flexBasis: 245, flexGrow: 1 },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  step: { flexBasis: 210, flexGrow: 1, gap: spacing.xs },
  stepTitle: { ...typography.bodyStrong, color: colors.textPrimary },
  note: { ...typography.secondary, color: colors.textSecondary },
});
