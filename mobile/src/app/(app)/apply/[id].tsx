import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Check, FileText, Paperclip, ShieldCheck, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import Animated, { ZoomIn } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { DeenLoader, LoadingScreen } from "@/components/Loader";
import { OrgLogo } from "@/components/OpportunityCard";
import { Arabic, Button, Card, Chip, Header, Input, T, Tap } from "@/components/ui";
import { ApiError, get, post, uploadFile } from "@/lib/api";
import { keys, useProfile } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toastError } from "@/lib/toast";
import type { OppDetail, Question } from "@/lib/types";

type Answer = string | string[];

function QuestionField({ q, value, onChange }: { q: Question; value: Answer | undefined; onChange: (v: Answer) => void }) {
  const label = q.label + (q.required ? " *" : "");
  switch (q.kind) {
    case "long_text":
      return <Input label={label} value={(value as string) ?? ""} onChangeText={onChange} multiline style={{ minHeight: 110, textAlignVertical: "top" }} />;
    case "number":
      return <Input label={label} value={(value as string) ?? ""} onChangeText={onChange} keyboardType="numeric" />;
    case "date":
      return <Input label={label} value={(value as string) ?? ""} onChangeText={onChange} placeholder="DD/MM/YYYY" />;
    case "yes_no":
    case "single_choice": {
      const options = q.kind === "yes_no" ? ["Yes", "No"] : q.options;
      return (
        <View style={{ gap: 8 }}>
          <T v="label">{label}</T>
          <View style={styles.wrap}>{options.map((o) => <Chip key={o} label={o} active={value === o} onPress={() => onChange(o)} />)}</View>
        </View>
      );
    }
    case "multi_choice": {
      const arr = (value as string[]) ?? [];
      return (
        <View style={{ gap: 8 }}>
          <T v="label">{label}</T>
          <View style={styles.wrap}>{q.options.map((o) => <Chip key={o} label={o} active={arr.includes(o)} onPress={() => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} />)}</View>
        </View>
      );
    }
    default:
      return <Input label={label} value={(value as string) ?? ""} onChangeText={onChange} />;
  }
}

export default function Apply() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const profile = useProfile();
  const q = useQuery({ queryKey: ["opportunity", id], queryFn: () => get<OppDetail>(`/opportunities/${id}`) });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [note, setNote] = useState("");
  const [docs, setDocs] = useState<{ file_id: string; label: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () => post<{ id: string }>(`/opportunities/${id}/apply`, { cover_note: note || null, answers, documents: docs }),
    onSuccess: (r) => {
      setDone(r.id);
      qc.invalidateQueries({ queryKey: keys.applications });
      qc.invalidateQueries({ queryKey: ["opportunity", id] });
      qc.invalidateQueries({ queryKey: keys.membership });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) router.push("/membership");
      toastError(e);
    },
  });

  async function attach() {
    const r = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true });
    if (r.canceled) return;
    const f = r.assets[0];
    setUploading(true);
    try {
      const up = await uploadFile(f.uri, "application", f.name, f.mimeType ?? "application/pdf");
      setDocs((d) => [...d, { file_id: up.id, label: f.name.replace(/\.[^.]+$/, "") }]);
    } catch (e) {
      toastError(e);
    } finally {
      setUploading(false);
    }
  }

  if (q.isLoading || !q.data) return <LoadingScreen label="Preparing application" />;
  const o = q.data;
  const missing = o.form_questions.filter((x) => x.required && !(Array.isArray(answers[x.id]) ? (answers[x.id] as string[]).length : answers[x.id]));

  if (done) {
    return (
      <SafeAreaView style={[styles.flex, styles.done]}>
        <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.tick}><Check size={44} color={colors.white} strokeWidth={3} /></Animated.View>
        <T v="title" center style={{ marginTop: 24 }}>Application sent</T>
        <T v="body" center style={{ marginTop: 8, color: colors.ink500 }}>{o.organization.name} has received your application. We&apos;ll notify you the moment it moves.</T>
        <Card style={{ marginTop: 28, width: "100%", backgroundColor: colors.gold50, borderColor: colors.gold100 }}>
          <Arabic size={22} color={colors.gold700}>رَبِّ اشْرَحْ لِي صَدْرِي ۝ وَيَسِّرْ لِي أَمْرِي</Arabic>
          <T v="small" style={{ fontStyle: "italic" }}>&ldquo;My Lord, expand my chest for me and make my task easy for me.&rdquo; (Qur&apos;an 20:25–26)</T>
        </Card>
        <View style={{ width: "100%", gap: 10, marginTop: 28 }}>
          <Button title="Track my application" onPress={() => router.replace(`/application/${done}`)} />
          <Button title="Back to opportunities" variant="ghost" onPress={() => router.dismissTo("/")} />
        </View>
      </SafeAreaView>
    );
  }

  const p = profile.data;
  const shared = [user?.full_name, user?.phone, p?.county, p?.education_level?.replaceAll("_", " "), p?.field_of_study].filter(Boolean).join(" · ");

  return (
    <SafeAreaView style={styles.flex}>
      <Header title="Apply" subtitle={o.organization.name} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Card style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <OrgLogo org={o.organization} size={44} />
            <View style={styles.flex}>
              <T v="h3" numberOfLines={2}>{o.title}</T>
              {!!o.deadline && <T v="caption">Deadline {new Date(o.deadline).toLocaleDateString("en-KE", { day: "numeric", month: "long" })}</T>}
            </View>
          </Card>

          {o.form_questions.map((x) => <QuestionField key={x.id} q={x} value={answers[x.id]} onChange={(v) => setAnswers({ ...answers, [x.id]: v })} />)}

          <Input label="Cover note (optional)" value={note} onChangeText={setNote} multiline placeholder="Introduce yourself and why this opportunity matters to you." style={{ minHeight: 110, textAlignVertical: "top" }} />

          <View style={{ gap: 10 }}>
            <T v="label">Documents{o.required_documents.length ? `: ${o.required_documents.join(", ")}` : ""}</T>
            {docs.map((d) => (
              <View key={d.file_id} style={styles.doc}>
                <FileText size={18} color={colors.brand700} />
                <T v="bodyStrong" numberOfLines={1} style={styles.flex}>{d.label}</T>
                <Tap onPress={() => setDocs(docs.filter((x) => x.file_id !== d.file_id))} hitSlop={10}><X size={18} color={colors.ink400} /></Tap>
              </View>
            ))}
            <Tap onPress={attach} disabled={uploading} style={styles.attach}>
              {uploading ? <DeenLoader size={26} /> : <Paperclip size={18} color={colors.brand700} />}
              <T v="label" color={colors.brand700}>{uploading ? "Uploading securely…" : "Attach PDF or photo"}</T>
            </Tap>
          </View>

          <View style={styles.privacy}>
            <ShieldCheck size={18} color={colors.brand700} />
            <View style={styles.flex}>
              <T v="label">Shared with {o.organization.name}</T>
              <T v="caption">{shared || "Your name and contact details"}. Only this organization can see your application and documents.</T>
            </View>
          </View>

          <Button title="Submit application" loading={submit.isPending} disabled={missing.length > 0 || uploading} onPress={() => submit.mutate()} />
          {missing.length > 0 && <T v="caption" center>Answer the required questions ({missing.length} left)</T>}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  doc: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.white, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: colors.sand200 },
  attach: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: colors.brand600 },
  privacy: { flexDirection: "row", gap: 12, backgroundColor: colors.brand50, borderRadius: 16, padding: 14 },
  done: { alignItems: "center", justifyContent: "center", padding: 28 },
  tick: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brand600, alignItems: "center", justifyContent: "center" },
});
