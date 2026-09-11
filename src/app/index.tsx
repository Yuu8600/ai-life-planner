import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Life Planner</Text>
      <Text style={styles.subtitle}>Milestone 0 のセットアップが完了しました。</Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    backgroundColor: '#f7f8f5',
  },
  title: {
    color: '#18201b',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#526057',
    fontSize: 16,
    textAlign: 'center',
  },
});
