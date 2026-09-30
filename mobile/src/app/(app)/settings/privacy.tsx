import { Download, ShieldCheck, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sheet } from "@/components/Sheet";
import { Button, Card, Header, Input, T } from "@/components/ui";
import { get, post } from "@/lib/api";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toastError } from "@/lib/toast";

export default function Privacy() {
  const signOut = useSession((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const data = await get("/me/privacy/export");
      await Share.share({ title: "My DEEN data", message: JSON.stringify(data, null, 2) });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await post("/me/privacy/delete", { password });
      setOpen(false);
      await signOut(false);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Privacy & data" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <Card style={{ gap: 8, backgroundColor: colors.emerald50, borderColor: colors.emerald100 }}>
          <ShieldCheck size={22} color={colors.emerald700} />
          <T v="h3">Your data, your rights</T>
          <T v="small">DEEN collects only what it needs to match you with opportunities. Sensitive data (identity documents, application files) is encrypted. Organizations only see what you send them when you apply. Under Kenya&apos;s Data Protection Act 2019 you can access or erase your data at any time.</T>
        </Card>
        <Card style={{ gap: 10 }}>
          <T v="h3">Download my data</T>
          <T v="small">Your account, profile, applications and payments as a file you can save or send.</T>
          <Button title="Export my data" icon={Download} variant="secondary" size="md" loading={busy && !open} onPress={exportData} />
        </Card>
        <Card style={{ gap: 10 }}>
          <T v="h3" color={colors.rose600}>Delete my account</T>
          <T v="small">Your profile, saved items, notifications and identity documents are erased. This cannot be undone.</T>
          <Button title="Delete account" icon={Trash2} variant="danger" size="md" onPress={() => setOpen(true)} />
        </Card>
      </ScrollView>
      <Sheet open={open} onClose={() => setOpen(false)} title="Delete your account?" footer={<Button title="Delete permanently" variant="danger" loading={busy} disabled={!password} onPress={remove} />}>
        <T v="small">Enter your password to confirm. We&apos;re sad to see you go. May Allah make it easy for you.</T>
        <View><Input label="Password" secureTextEntry value={password} onChangeText={setPassword} /></View>
      </Sheet>
    </SafeAreaView>
  );
}
