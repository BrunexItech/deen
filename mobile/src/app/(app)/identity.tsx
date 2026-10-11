import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { usePreventScreenCapture } from "expo-screen-capture";
import { BadgeCheck, Camera, Clock, IdCard, ScanFace, ShieldCheck } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormScroll } from "@/components/Keyboard";
import { InlineLoader } from "@/components/Loader";
import { Button, Card, Chip, Header, Input, T, Tap } from "@/components/ui";
import { get, post, uploadFile } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";

type Status = { status: "none" | "pending" | "verified" | "rejected"; note: string | null };

function Shot({ label, hint, icon: Icon, uri, onPress }: { label: string; hint: string; icon: typeof Camera; uri: string | null; onPress: () => void }) {
  return (
    <Tap onPress={onPress} style={styles.shot}>
      {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
        <>
          <Icon size={30} color={colors.brand700} />
          <T v="bodyStrong" style={{ marginTop: 8 }}>{label}</T>
          <T v="caption" center>{hint}</T>
        </>
      )}
    </Tap>
  );
}

export default function Identity() {
  usePreventScreenCapture(); // ID documents on screen: block screenshots and recordings.
  const qc = useQueryClient();
  const refreshUser = useSession((s) => s.refreshUser);
  const status = useQuery({ queryKey: ["identity"], queryFn: () => get<Status>("/identity") });
  const [idType, setIdType] = useState("national_id");
  const [number, setNumber] = useState("");
  const [front, setFront] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function capture(kind: "front" | "selfie") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return toast("Camera permission is needed", "error");
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"], quality: 0.7, allowsEditing: kind === "front", aspect: kind === "front" ? [16, 10] : undefined,
      cameraType: kind === "selfie" ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    if (!r.canceled) (kind === "front" ? setFront : setSelfie)(r.assets[0].uri);
  }

  async function submit() {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([uploadFile(front!, "identity", "id.jpg"), uploadFile(selfie!, "identity", "selfie.jpg")]);
      await post("/identity", { id_type: idType, id_number: number, id_front_file_id: a.id, selfie_file_id: b.id });
      toast("Submitted. We'll verify within 48 hours.");
      qc.invalidateQueries({ queryKey: ["identity"] });
      refreshUser().catch(() => undefined);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  const s = status.data?.status;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Verify your identity" />
      {status.isLoading ? <InlineLoader /> : s === "verified" || s === "pending" ? (
        <View style={styles.center}>
          {s === "verified" ? <BadgeCheck size={70} color={colors.brand600} /> : <Clock size={64} color={colors.gold500} />}
          <T v="title" center style={{ marginTop: 16 }}>{s === "verified" ? "You're verified" : "Under review"}</T>
          <T v="body" center style={{ color: colors.ink500, marginTop: 6 }}>
            {s === "verified" ? "Your profile carries the verified badge, and you can apply for verified-only support." : "A DEEN verification officer is checking your documents. This usually takes less than 48 hours."}
          </T>
        </View>
      ) : (
        <FormScroll contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
          <Card style={{ gap: 6, backgroundColor: colors.brand50, borderColor: colors.brand100 }}>
            <ShieldCheck size={22} color={colors.brand700} />
            <T v="bodyStrong">Why verify?</T>
            <T v="small">Some zakat, sadaqah and emergency programmes accept verified members only, to make sure help reaches real people. Your documents are encrypted and seen only by DEEN&apos;s verification officers.</T>
          </Card>
          {s === "rejected" && status.data?.note && <Card style={{ backgroundColor: colors.rose50, borderColor: colors.rose50 }}><T v="small" color={colors.rose600}>Last attempt: {status.data.note}</T></Card>}
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[["national_id", "National ID"], ["passport", "Passport"], ["alien_id", "Alien ID"]].map(([k, l]) => <Chip key={k} label={l} active={idType === k} onPress={() => setIdType(k)} />)}
          </View>
          <Input label="Document number" value={number} onChangeText={setNumber} autoCapitalize="characters" />
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Shot label="Photo of ID" hint="Front side, all corners visible" icon={IdCard} uri={front} onPress={() => capture("front")} />
            <Shot label="Selfie" hint="Face the camera in good light" icon={ScanFace} uri={selfie} onPress={() => capture("selfie")} />
          </View>
          <Button title="Submit for verification" loading={busy} disabled={!front || !selfie || number.length < 5} onPress={submit} />
        </FormScroll>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  shot: { flex: 1, height: 170, borderRadius: 18, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand600, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", padding: 12, overflow: "hidden" },
});
