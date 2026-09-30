import * as LocalAuthentication from "expo-local-authentication";

export type LockCapability = { hardware: boolean; enrolled: boolean; label: string; strong: boolean };

/** What this phone can do: fingerprint / face, or at least a device PIN/pattern. */
export async function lockCapability(): Promise<LockCapability> {
  const [hardware, enrolled, types, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const finger = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const label = face && finger ? "Fingerprint or Face" : face ? "Face unlock" : finger ? "Fingerprint" : "Screen lock";
  return { hardware, enrolled, label, strong: level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG };
}

export async function authenticate(reason = "Unlock DEEN"): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    promptSubtitle: "Your account is protected",
    cancelLabel: "Cancel",
    // Falls back to the phone's PIN/pattern if biometrics fail or aren't enrolled.
    disableDeviceFallback: false,
    requireConfirmation: false,
  });
  return result.success;
}
