import { Tabs, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { colors } from '../../theme';
export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.orange, tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.line, paddingTop: 8, minHeight: 68 },
    tabBarLabelStyle: { fontSize: 11, fontWeight: '600', paddingBottom: 6 } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home-outline" color={typeof color === 'string' ? color : colors.muted} size={24} /> }} />
    <Tabs.Screen name="lists" options={{ title: 'Lists', tabBarIcon: ({ color }) => <Ionicons name="list-outline" color={typeof color === 'string' ? color : colors.muted} size={25} /> }} />
    <Tabs.Screen name="voice-launch" options={{ title: 'Speak', tabBarAccessibilityLabel: 'Record groceries', tabBarIcon: () => <View style={{ width: 48, height: 48, borderRadius: 18, backgroundColor: colors.orange, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><Ionicons name="mic" color={colors.white} size={25} /></View> }} listeners={{ tabPress: event => { event.preventDefault(); router.navigate('/voice'); } }} />
    <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Ionicons name="ellipsis-horizontal" color={typeof color === 'string' ? color : colors.muted} size={25} /> }} />
  </Tabs>;
}
