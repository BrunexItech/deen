import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "@/lib/theme";
import { T } from "./ui";

/** Bottom sheet built on the native Modal: accessible back-button and swipe behaviour for free. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.sheet}>
        <View style={styles.grip} />
        <T v="h2" style={{ paddingHorizontal: 22, marginBottom: 8 }}>{title}</T>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: 12, gap: 14 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
        {footer && <View style={{ paddingHorizontal: 22, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 16) }}>{footer}</View>}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,23,51,0.45)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "88%", backgroundColor: colors.sand100, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10 },
  grip: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.sand300, alignSelf: "center", marginBottom: 14 },
});
