import { Tabs } from "expo-router";
import { Compass, FileStack, Home, Moon, UserRound } from "lucide-react-native";
import type { ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Tap } from "@/components/ui";
import { colors, fonts, shadow } from "@/lib/theme";

const ICONS = { index: Home, explore: Compass, deen: Moon, applications: FileStack, profile: UserRound } as const;
// Expo Router vendors react-navigation; take the tab bar props straight from <Tabs>.
type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

const LABELS = { index: "For You", explore: "Explore", deen: "Deen", applications: "Tracker", profile: "Me" } as const;

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const name = route.name as keyof typeof ICONS;
          const Icon = ICONS[name];
          const center = name === "deen";
          return (
            <Tap
              key={route.key}
              style={styles.item}
              onPress={() => {
                const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={LABELS[name]}
            >
              {center ? (
                <View style={[styles.center, focused && styles.centerOn]}>
                  <Icon size={22} color={focused ? colors.emerald950 : colors.gold400} fill={focused ? colors.emerald950 : "transparent"} />
                </View>
              ) : (
                <>
                  <View style={[styles.pill, focused && styles.pillOn]}>
                    <Icon size={21} color={focused ? colors.emerald700 : colors.ink400} strokeWidth={focused ? 2.4 : 2} />
                  </View>
                  <Text style={[styles.label, focused && { color: colors.emerald800, fontFamily: fonts.bold }]}>{LABELS[name]}</Text>
                </>
              )}
            </Tap>
          );
        })}
      </View>
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
  wrap: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: { flexDirection: "row", backgroundColor: colors.white, borderRadius: 26, paddingVertical: 8, paddingHorizontal: 6, borderWidth: 1, borderColor: colors.sand200, ...shadow.float },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  pill: { width: 48, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  pillOn: { backgroundColor: colors.emerald50 },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.ink400 },
  center: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.emerald800, alignItems: "center", justifyContent: "center", marginTop: -22, borderWidth: 3, borderColor: colors.sand100, ...shadow.float },
  centerOn: { backgroundColor: colors.gold400 },
});
