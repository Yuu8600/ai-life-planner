import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, type ColorValue } from 'react-native';

import { TAB_CONFIG } from '@/shared/navigation/tabs';
import { colors } from '@/shared/theme';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  symbol: string;
};

function TabIcon({ color, focused, symbol }: TabIconProps) {
  return (
    <Text style={[styles.icon, { color }, focused ? styles.focusedIcon : null]}>{symbol}</Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="today"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: styles.label,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          tabBarAccessibilityLabel: TAB_CONFIG.today.accessibilityLabel,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol={TAB_CONFIG.today.symbol} />
          ),
          title: TAB_CONFIG.today.title,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          tabBarAccessibilityLabel: TAB_CONFIG.goals.accessibilityLabel,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol={TAB_CONFIG.goals.symbol} />
          ),
          title: TAB_CONFIG.goals.title,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          tabBarAccessibilityLabel: TAB_CONFIG.tasks.accessibilityLabel,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol={TAB_CONFIG.tasks.symbol} />
          ),
          title: TAB_CONFIG.tasks.title,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          tabBarAccessibilityLabel: TAB_CONFIG.calendar.accessibilityLabel,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol={TAB_CONFIG.calendar.symbol} />
          ),
          title: TAB_CONFIG.calendar.title,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          tabBarAccessibilityLabel: TAB_CONFIG.ai.accessibilityLabel,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} symbol={TAB_CONFIG.ai.symbol} />
          ),
          title: TAB_CONFIG.ai.title,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    ...Platform.select({ web: { height: 76, paddingBottom: 8 } }),
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface,
    elevation: 0,
    paddingTop: 6,
    shadowOpacity: 0,
  },
  label: {
    ...Platform.select({ web: { lineHeight: 17, minHeight: 17, flexShrink: 0 } }),
    fontSize: 11,
    fontWeight: '600',
  },
  icon: {
    fontSize: 18,
    fontWeight: '500',
  },
  focusedIcon: {
    fontWeight: '800',
  },
});
