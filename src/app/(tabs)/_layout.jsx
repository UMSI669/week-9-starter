/**
 * The three main destinations: Gallery / Home, Capture Dream, and
 * Symbols / Interpretations.
 *
 * Recording is a labelled tab AND a labelled button on Home. It is never
 * hidden behind the moon.
 */

import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors, fontSizes } from '../../theme';

function TabIcon({ emoji, color }) {
  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ fontSize: 18, color }}
    >
      {emoji}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.gradientTertiary,
          borderTopColor: colors.border,
          height: 68,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: fontSizes.caption, fontWeight: '700', paddingBottom: 4 },
        tabBarItemStyle: { minHeight: 52 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dream sky',
          tabBarLabel: 'Dream sky',
          tabBarIcon: ({ color }) => <TabIcon emoji="✨" color={color} />,
          tabBarAccessibilityLabel: 'Dream sky. Your gallery and category map.',
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Record',
          tabBarLabel: 'Record',
          tabBarIcon: ({ color }) => <TabIcon emoji="🎙️" color={color} />,
          tabBarAccessibilityLabel: 'Record a dream.',
        }}
      />
      <Tabs.Screen
        name="symbols"
        options={{
          title: 'Symbols',
          tabBarLabel: 'Symbols',
          tabBarIcon: ({ color }) => <TabIcon emoji="🌙" color={color} />,
          tabBarAccessibilityLabel: 'Dream symbols and interpretations.',
        }}
      />
    </Tabs>
  );
}
