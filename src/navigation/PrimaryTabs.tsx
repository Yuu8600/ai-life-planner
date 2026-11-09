import { useState, useSyncExternalStore } from 'react';
import { Tabs, type BottomTabBarButtonProps } from 'expo-router/tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import {
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getBottomTabLayout,
  SIDEBAR_MIN_WIDTH,
  TAB_CONFIG,
  TAB_LABEL_SIZE,
} from '@/shared/navigation/tabs';
import { colors, controls, radius, spacing, typography } from '@/shared/theme';

const icons = {
  today: require('../../assets/navigation/today.png'),
  goals: require('../../assets/navigation/goals.png'),
  tasks: require('../../assets/navigation/tasks.png'),
  calendar: require('../../assets/navigation/calendar.png'),
  ai: require('../../assets/navigation/ai.png'),
};

const routes = Object.keys(TAB_CONFIG) as (keyof typeof TAB_CONFIG)[];

function subscribeToWidth(notify: () => void) {
  const subscription = Dimensions.addEventListener('change', notify);
  return () => subscription.remove();
}

const usesSidebar = () =>
  Platform.OS === 'web' && Dimensions.get('window').width >= SIDEBAR_MIN_WIDTH;
const usesSidebarOnServer = () => false;

function TabButton({ style, ...props }: BottomTabBarButtonProps) {
  const [focused, setFocused] = useState(false);
  return (
    <PlatformPressable
      {...props}
      accessibilityState={{ selected: props['aria-selected'] === true }}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[style, styles.target, focused && styles.focus]}
    />
  );
}

export default function PrimaryTabs() {
  const { width, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const sidebar = useSyncExternalStore(subscribeToWidth, usesSidebar, usesSidebarOnServer);
  const bottom = getBottomTabLayout(width - 2 * Math.max(insets.left, insets.right), fontScale);

  return (
    <Tabs
      initialRouteName="today"
      backBehavior={web ? 'fullHistory' : 'firstRoute'}
      screenOptions={{
        headerShown: false,
        tabBarPosition: sidebar ? 'left' : 'bottom',
        tabBarLabelPosition: sidebar ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarActiveBackgroundColor: colors.primarySoft,
        tabBarHideOnKeyboard: true,
        tabBarShowLabel: web || bottom.showLabels,
        tabBarStyle: [
          styles.bar,
          sidebar
            ? styles.sidebar
            : web
              ? styles.webBottom
              : { height: bottom.height + insets.bottom },
        ],
        tabBarButton: (props) => <TabButton {...props} />,
      }}
    >
      {routes.map((name) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title: TAB_CONFIG[name].title,
            tabBarAccessibilityLabel: TAB_CONFIG[name].accessibilityLabel,
            tabBarButtonTestID: `primary-tab-${name}`,
            tabBarLabel: ({ color }) => (
              <Text
                key={fontScale}
                style={[styles.label, sidebar ? styles.sideLabel : styles.bottomLabel, { color }]}
              >
                {TAB_CONFIG[name].title}
              </Text>
            ),
            tabBarIcon: ({ color, focused }) => (
              <View style={[styles.iconFrame, focused && styles.selectedIcon]}>
                <Image
                  source={icons[name]}
                  resizeMode="contain"
                  style={[styles.icon, { tintColor: color }]}
                />
              </View>
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSubtle,
    elevation: 0,
    shadowOpacity: 0,
  },
  sidebar: { width: 184, minWidth: 184, paddingHorizontal: spacing.sm },
  webBottom: { height: 'auto', minHeight: 58 },
  target: { minHeight: controls.minimumTarget, minWidth: controls.minimumTarget },
  focus: Platform.select({
    web: {
      outlineStyle: 'solid',
      outlineColor: colors.focusRing,
      outlineWidth: 2,
      outlineOffset: -2,
    },
    default: { borderWidth: 2, borderColor: colors.focusRing },
  })!,
  label: { fontWeight: '600', flexShrink: 1, minWidth: 0 },
  bottomLabel: { fontSize: TAB_LABEL_SIZE, maxWidth: '100%', textAlign: 'center' },
  sideLabel: { ...typography.label, marginStart: spacing.sm },
  iconFrame: {
    width: 32,
    height: 26,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedIcon: { borderBottomColor: colors.primary, borderRadius: radius.sm },
  icon: { width: 22, height: 22 },
});
