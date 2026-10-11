/** Keyboard-safe forms. Android draws edge-to-edge, so the system no longer resizes the
 * screen for the keyboard: these keep the focused field, and the action button, visible. */
import type { ReactNode } from "react";
import type { ScrollViewProps, StyleProp, ViewStyle } from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Scroll view that scrolls the focused input above the keyboard. Use `footerSpace` when a
 * sticky footer sits on top of the keyboard, so the field clears the footer too. */
export function FormScroll({ footerSpace = 0, children, ...rest }: ScrollViewProps & { footerSpace?: number; children: ReactNode }) {
  return (
    <KeyboardAwareScrollView bottomOffset={24 + footerSpace} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} {...rest}>
      {children}
    </KeyboardAwareScrollView>
  );
}

/** Bottom action bar that rides on top of the keyboard. */
export function StickyFooter({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom }} style={style}>
      {children}
    </KeyboardStickyView>
  );
}
