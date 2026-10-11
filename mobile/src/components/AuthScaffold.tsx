import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { FormScroll, StickyFooter } from "./Keyboard";
import { Header, T } from "./ui";

/** "Already have an account? Log in" style link, clearly visible under a form. */
export function SwitchLink({ question, action, onPress }: { question: string; action: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.switch} accessibilityRole="link">
      <T v="body" color={colors.ink500}>{question} </T>
      <T v="bodyStrong" color={colors.brand700}>{action}</T>
    </Pressable>
  );
}

/** Frame for sign-in / sign-up / verification screens. */
export function AuthScaffold({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
      <Header />
      <FormScroll contentContainerStyle={styles.body} footerSpace={footer ? 96 : 0}>
        <T v="title">{title}</T>
        {subtitle ? (typeof subtitle === "string" ? <T v="body" style={{ marginTop: 6, color: colors.ink500 }}>{subtitle}</T> : subtitle) : null}
        <View style={{ marginTop: 28, gap: 18 }}>{children}</View>
      </FormScroll>
      {footer && <StickyFooter style={styles.footer}>{footer}</StickyFooter>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32 },
  switch: { flexDirection: "row", justifyContent: "center", alignItems: "center", paddingVertical: 14, marginTop: 4, borderRadius: 14, backgroundColor: colors.sand100 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.sand200 },
});
