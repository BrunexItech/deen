import { Tabs } from "expo-router";
import { Compass, FileStack, Home, Moon, UserRound } from "lucide-react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "@/components/ui";
import { colors, fonts } from "@/lib/theme";

const ICONS = { index: Home, explore: Compass, deen: Moon, applications: FileStack, profile: UserRound } as const;
// Expo Router vendors react-navigation; take the tab bar props straight from <Tabs>.
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const LABELS = { index: "Home", explore: "Explore", deen: "Deen", applications: "Tracker", profile: "Me" } as const;

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {state.routes.map((route, i) => {
        const focused = state.index === i;
        const name = route.name as keyof typeof ICONS;
        const Icon = ICONS[name];
        return (
          <Tap
            key={route.key}
            style={styles.item}
            scale={0.92}
            onPress={() => {
              const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABELS[name]}
          >
            <View style={[styles.pill, focused && styles.pillOn]}>
              <Icon size={21} color={focused ? colors.brand700 : colors.ink400} strokeWidth={focused ? 2.4 : 2} />
            </View>
            <Text style={[styles.label, focused && styles.labelOn]}>{LABELS[name]}</Text>
          </Tap>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.sand100 } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="explore" />
      <Tabs.Screen name="deen" />
      <Tabs.Screen name="applications" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", backgroundColor: colors.white, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.sand200 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3 },
  pill: { width: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.brand50 },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.ink400 },
  labelOn: { color: colors.brand800, fontFamily: fonts.bold },
});
