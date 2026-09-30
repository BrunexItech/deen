/** DEEN Experience Builder (spec section 27): record experience, then turn it into a CV.
 * Pathway: Education → Experience → Skills → Employment / Entrepreneurship. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { BadgeCheck, FileDown, Plus, Sparkles, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { InlineLoader } from "@/components/Loader";
import { Sheet } from "@/components/Sheet";
import { Badge, Button, Card, Chip, Empty, Header, IconButton, Input, T, Tap } from "@/components/ui";
import { api, get, post } from "@/lib/api";
import { useProfile, useTaxonomy } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { Experience, Profile, Taxonomy } from "@/lib/types";

const KINDS: [string, string][] = [
  ["volunteer", "Volunteer"], ["attachment", "Attachment"], ["internship", "Internship"], ["job", "Job"],
  ["training", "Training"], ["workshop", "Workshop"], ["fellowship", "Fellowship"], ["competition", "Competition"],
  ["mentorship", "Mentorship"], ["education", "Education"], ["other", "Other"],
];
const KIND_LABEL = Object.fromEntries(KINDS);

const esc = (s: string | null | undefined) => (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const year = (iso: string | null) => (iso ? new Date(iso).getFullYear().toString() : "");

function cvHtml(name: string, phone: string | null, email: string | null, p: Profile | undefined, items: Experience[], tax?: Taxonomy) {
  const edu = tax?.education_levels.find((e) => e.key === p?.education_level)?.name;
  const groups = KINDS.map(([k, label]) => [label, items.filter((i) => i.kind === k)] as const).filter(([, xs]) => xs.length);
  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  body{font-family:-apple-system,Roboto,Helvetica,Arial,sans-serif;color:#0f1a17;margin:40px;font-size:12.5px;line-height:1.5}
  h1{font-size:26px;margin:0;color:#00255f;letter-spacing:.5px} .contact{color:#5e6b66;margin-top:4px}
  h2{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#c98516;border-bottom:2px solid #e39d29;padding-bottom:4px;margin-top:26px}
  .item{margin:10px 0} .title{font-weight:700} .org{color:#004485} .when{color:#7f8a86;float:right} .v{color:#237a24;font-size:10.5px;font-weight:700}
  .skills span{display:inline-block;background:#eef4fc;color:#00316f;border-radius:10px;padding:2px 9px;margin:2px}
  footer{margin-top:36px;color:#a7b0ac;font-size:10px;text-align:center}</style></head><body>
  <h1>${esc(name)}</h1>
  <div class="contact">${[phone, email, p?.county ? `${p.county}, ${p.country ?? "Kenya"}` : null].filter(Boolean).map(esc).join(" · ")}</div>
  ${p?.bio ? `<h2>Profile</h2><p>${esc(p.bio)}</p>` : ""}
  ${edu || p?.field_of_study ? `<h2>Education</h2><div class="item"><span class="title">${esc(edu)}${p?.field_of_study ? ` · ${esc(p.field_of_study)}` : ""}</span>${p?.institution ? `<div class="org">${esc(p.institution)}</div>` : ""}</div>` : ""}
  ${groups.map(([label, xs]) => `<h2>${esc(label)}</h2>${xs.map((x) => `<div class="item"><span class="when">${[year(x.start_date), year(x.end_date)].filter(Boolean).join(" – ")}</span>
    <div class="title">${esc(x.title)} ${x.verified ? '<span class="v">✓ VERIFIED THROUGH DEEN</span>' : ""}</div><div class="org">${esc(x.organization)}${x.location ? ` · ${esc(x.location)}` : ""}</div>
    ${x.description ? `<div>${esc(x.description)}</div>` : ""}</div>`).join("")}`).join("")}
  ${p?.skills?.length ? `<h2>Skills</h2><div class="skills">${p.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div>` : ""}
  ${p?.languages?.length ? `<h2>Languages</h2><p>${p.languages.map(esc).join(", ")}</p>` : ""}
  <footer>Generated with DEEN · Discover. Verify. Apply. Grow.</footer></body></html>`;
}

export default function ExperienceScreen() {
  const qc = useQueryClient();
  const user = useSession((s) => s.user);
  const profile = useProfile();
  const { data: tax } = useTaxonomy();
  const q = useQuery({ queryKey: ["experience"], queryFn: () => get<{ items: Experience[]; suggestions: { opportunity_id: string; title: string; organization: string; type: string }[] }>("/me/experience") });
  const blank = { kind: "volunteer", title: "", organization: "", location: "", start: "", end: "", description: "", opportunity_id: "" };
  const [f, setF] = useState<typeof blank | null>(null);
  const [busy, setBusy] = useState(false);

  const save = useMutation({
    mutationFn: () => {
      const toIso = (y: string) => (/^\d{4}$/.test(y) ? new Date(`${y}-01-01T00:00:00Z`).toISOString() : null);
      return post("/me/experience", {
        kind: f!.kind, title: f!.title, organization: f!.organization, location: f!.location || null,
        start_date: toIso(f!.start), end_date: toIso(f!.end), description: f!.description || null,
        opportunity_id: f!.opportunity_id || null,
      });
    },
    onSuccess: () => { toast("Added to your experience"); setF(null); qc.invalidateQueries({ queryKey: ["experience"] }); },
    onError: toastError,
  });
  const remove = useMutation({ mutationFn: (id: string) => api(`/me/experience/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["experience"] }) });

  async function makeCv() {
    if (!user) return;
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: cvHtml(user.full_name, user.phone, user.email, profile.data, q.data?.items ?? [], tax) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Your DEEN CV", UTI: "com.adobe.pdf" });
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  const items = q.data?.items ?? [];
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="My DEEN Experience" right={<IconButton icon={Plus} label="Add experience" onPress={() => setF(blank)} />} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <Card style={{ backgroundColor: colors.brand50, borderColor: colors.brand100, gap: 6 }}>
          <T v="bodyStrong">Education → Experience → Skills → Opportunity</T>
          <T v="small">Record your volunteering, attachments, internships, trainings and more. Experience gained through DEEN is marked as verified. Turn it all into a clean CV in one tap.</T>
          <Button title="Generate my CV (PDF)" icon={FileDown} size="md" loading={busy} disabled={!items.length} onPress={makeCv} style={{ marginTop: 6 }} />
        </Card>

        {q.data?.suggestions.map((s) => (
          <Tap key={s.opportunity_id} onPress={() => setF({ ...blank, kind: KIND_LABEL[s.type] ? s.type : "other", title: s.title, organization: s.organization, opportunity_id: s.opportunity_id })} style={styles.suggest}>
            <Sparkles size={18} color={colors.gold600} />
            <View style={{ flex: 1 }}><T v="bodyStrong">Add &ldquo;{s.title}&rdquo;</T><T v="caption">You were accepted through DEEN. It will show as verified.</T></View>
          </Tap>
        ))}

        {q.isLoading ? <InlineLoader /> : !items.length ? (
          <Empty icon={Sparkles} title="Start your experience profile" body="Add anything you've done, even volunteering at your masjid counts." action="Add experience" onAction={() => setF(blank)} />
        ) : items.map((x) => (
          <Card key={x.id} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Badge label={KIND_LABEL[x.kind] ?? x.kind} tone="info" />
              <Tap onPress={() => Alert.alert("Remove?", x.title, [{ text: "Cancel", style: "cancel" }, { text: "Remove", style: "destructive", onPress: () => remove.mutate(x.id) }])} hitSlop={10}>
                <Trash2 size={17} color={colors.ink300} />
              </Tap>
            </View>
            <T v="h3">{x.title}</T>
            <T v="small">{x.organization}{x.start_date ? ` · ${year(x.start_date)}${x.end_date ? `–${year(x.end_date)}` : ""}` : ""}</T>
            {x.verified && <Badge label="Verified through DEEN" tone="good" icon={BadgeCheck} />}
            {x.description && <T v="small" style={{ color: colors.ink700 }}>{x.description}</T>}
          </Card>
        ))}
      </ScrollView>

      <Sheet open={!!f} onClose={() => setF(null)} title="Add experience"
        footer={<Button title="Save" loading={save.isPending} disabled={!f || f.title.length < 2 || f.organization.length < 2} onPress={() => save.mutate()} />}>
        {f && (
          <>
            <View style={styles.wrap}>{KINDS.map(([k, l]) => <Chip key={k} label={l} active={f.kind === k} onPress={() => setF({ ...f, kind: k })} />)}</View>
            <Input label="Role / title" value={f.title} onChangeText={(v) => setF({ ...f, title: v })} />
            <Input label="Organization" value={f.organization} onChangeText={(v) => setF({ ...f, organization: v })} />
            <Input label="Location" value={f.location} onChangeText={(v) => setF({ ...f, location: v })} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}><Input label="From (year)" keyboardType="number-pad" maxLength={4} value={f.start} onChangeText={(v) => setF({ ...f, start: v })} /></View>
              <View style={{ flex: 1 }}><Input label="To (year)" keyboardType="number-pad" maxLength={4} value={f.end} onChangeText={(v) => setF({ ...f, end: v })} placeholder="Ongoing" /></View>
            </View>
            <Input label="What you did" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline style={{ minHeight: 90, textAlignVertical: "top" }} />
          </>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggest: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.gold50, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.gold100 },
});
