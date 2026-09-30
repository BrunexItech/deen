import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { Header, T } from "./ui";

/** Frame for sign-in / sign-up / verification screens. */
export function AuthScaffold({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.sand100 }}>
      <LinearGradient colors={["#E4F1EB", colors.sand100]} style={StyleSheet.absoluteFill} end={{ x: 0.5, y: 0.45 }} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Header />
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <T v="title">{title}</T>
            {subtitle ? (typeof subtitle === "string" ? <T v="body" style={{ marginTop: 6, color: colors.ink500 }}>{subtitle}</T> : subtitle) : null}
            <View style={{ marginTop: 28, gap: 16 }}>{children}</View>
          </ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  footer: { paddingHorizontal: 24, paddingBottom: 16 },
});
