import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  AlertTriangle, BadgeCheck, Bookmark, BookmarkCheck, CalendarDays, Check, ChevronRight, Crown, ExternalLink, FileText,
  Flag, MapPin, Share2, ShieldCheck, Sparkles, Users, XCircle,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, FlatList, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { CATEGORY_ICON, MatchRing, OpportunityCard, OrgLogo, Verified } from "@/components/OpportunityCard";
import { Sheet } from "@/components/Sheet";
import { Arabic, Badge, Button, Chip, ErrorState, Header, IconButton, Input, T, Tap } from "@/components/ui";
import { get, post } from "@/lib/api";
import { keys, useTaxonomy, useToggleSave } from "@/lib/queries";
import { APP_STATUS } from "@/lib/status";
import { CATEGORY_META, colors, fonts } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { OppCard, OppDetail } from "@/lib/types";

function Block({ title, text }: { title: string; text?: string | null }) {
  if (!text?.trim()) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <T v="overline" color={colors.ink400}>{title}</T>
      <T v="body" style={{ marginTop: 6 }}>{text}</T>
    </View>
  );
}

function ReportSheet({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const reasons = useQuery({ queryKey: ["report-reasons"], queryFn: () => get<{ key: string; label: string }[]>("/reports/reasons"), enabled: open });
  const send = useMutation({
    mutationFn: () => post<{ message: string }>("/reports", { target_type: "opportunity", target_id: id, reason, details: details || null }),
    onSuccess: (r) => { toast(r.message); onClose(); },
    onError: toastError,
  });
  return (
    <Sheet open={open} onClose={onClose} title="Report this opportunity" footer={<Button title="Send report" variant="danger" disabled={!reason} loading={send.isPending} onPress={() => send.mutate()} />}>
      <T v="small">Our trust & safety team reviews every report. If several members report possible fraud, the listing is pulled automatically.</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {reasons.data?.map((r) => <Chip key={r.key} label={r.label} active={reason === r.key} onPress={() => setReason(r.key)} />)}
      </View>
      <Input label="Details (optional)" value={details} onChangeText={setDetails} multiline style={{ minHeight: 80, textAlignVertical: "top" }} />
    </Sheet>
  );
}

export default function OpportunityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: tax } = useTaxonomy();
  const q = useQuery({ queryKey: ["opportunity", id], queryFn: () => get<OppDetail>(`/opportunities/${id}`) });
  const similar = useQuery({ queryKey: ["similar", id], queryFn: () => get<OppCard[]>(`/opportunities/${id}/similar`), enabled: q.isSuccess });
  const save = useToggleSave();
  const [report, setReport] = useState(false);
  const [asked, setAsked] = useState(false);

  const markApplied = useMutation({
    mutationFn: () => post(`/opportunities/${id}/applied-externally`),
    onSuccess: () => { toast("Added to your tracker. May Allah make it easy for you."); qc.invalidateQueries({ queryKey: ["opportunity", id] }); qc.invalidateQueries({ queryKey: keys.applications }); },
    onError: toastError,
  });

  if (q.isLoading) return <LoadingScreen label="Opening opportunity" />;
  if (q.isError || !q.data) return <SafeAreaView style={{ flex: 1 }}><Header /><ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} /></SafeAreaView>;
  const o = q.data;
  const meta = CATEGORY_META[o.category] ?? CATEGORY_META.community;
  const Icon = CATEGORY_ICON[o.category] ?? Sparkles;
  const edu = (k: string) => tax?.education_levels.find((e) => e.key === k)?.name ?? k;
  const closed = o.days_left !== null && o.deadline !== null && new Date(o.deadline) < new Date();

  async function openExternal() {
    try {
      const r = await post<{ external_url: string | null }>(`/opportunities/${id}/events`, { kind: "click" });
      if (r.external_url) {
        await WebBrowser.openBrowserAsync(r.external_url, { toolbarColor: colors.brand900, controlsColor: colors.gold400 });
        if (!asked && !o.application) {
          setAsked(true);
          Alert.alert("Did you apply?", "Add it to your tracker so you can follow up and get reminders.", [
            { text: "Not yet", style: "cancel" }, { text: "Yes, track it", onPress: () => markApplied.mutate() },
          ]);
        }
      }
    } catch (e) {
      toastError(e);
    }
  }

  function share() {
    post(`/opportunities/${id}/events`, { kind: "share" }).catch(() => undefined);
    Share.share({ message: `${o.title}\n${o.organization.name}${o.amount_label ? ` · ${o.amount_label}` : ""}\n\n${o.summary}\n\nView on DEEN: ${o.share_url}\n\n"Whoever guides someone to goodness has a reward like the one who does it." (Sahih Muslim)` });
  }

  const status = o.application ? APP_STATUS[o.application.status] : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.sand100 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.brand800, colors.brand950]} style={{ paddingTop: insets.top }}>
          <View style={styles.glow} />
          <Header dark right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              <IconButton icon={Share2} label="Share" onPress={share} bg="rgba(255,255,255,0.12)" color={colors.white} />
              <IconButton icon={Flag} label="Report" onPress={() => setReport(true)} bg="rgba(255,255,255,0.12)" color={colors.white} />
            </View>
          } />
          <View style={styles.hero}>
            <View style={[styles.cat, { backgroundColor: "rgba(255,255,255,0.1)" }]}>
              <Icon size={13} color={colors.gold400} />
              <Text style={[styles.catText, { color: colors.gold400 }]}>{meta.label}</Text>
            </View>
            <T v="title" color={colors.white} style={{ marginTop: 12 }}>{o.title}</T>
            {!!o.amount_label && <Text style={styles.amount}>{o.amount_label}</Text>}
            <Tap onPress={() => router.push(`/organization/${o.organization.id}`)} style={styles.org}>
              <OrgLogo org={o.organization} size={38} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <T v="bodyStrong" color={colors.white} numberOfLines={1} style={{ flexShrink: 1 }}>{o.organization.name}</T>
                  <Verified org={o.organization} size={15} />
                </View>
                <T v="caption" color={colors.brand100}>{o.organization.verification === "trusted" ? "Trusted partner" : o.organization.verification === "verified" ? "Verified by DEEN" : "Organization"}</T>
              </View>
              <ChevronRight size={18} color={colors.brand100} />
            </Tap>
          </View>
        </LinearGradient>

        <View style={{ padding: 20 }}>
          {o.match && (
            <View style={[styles.matchCard, !o.match.eligible && { borderColor: colors.sand300 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                {o.match.eligible ? <MatchRing score={o.match.score} size={58} /> : <View style={styles.noMatch}><XCircle size={26} color={colors.ink400} /></View>}
                <View style={{ flex: 1 }}>
                  <T v="h3">{o.match.eligible ? (o.match.score >= 70 ? "Strong match for you" : o.match.score >= 45 ? "Good match" : "Worth a look") : "You may not be eligible"}</T>
                  <T v="caption">{o.match.eligible ? "Based on your DEEN profile" : "Check the requirements below"}</T>
                </View>
              </View>
              {(o.match.eligible ? o.match.reasons : o.match.blockers).map((r) => (
                <View key={r} style={styles.reason}>
                  {o.match!.eligible ? <Check size={15} color={colors.brand600} strokeWidth={3} /> : <AlertTriangle size={15} color={colors.amber800} />}
                  <T v="small" style={{ flex: 1, color: colors.ink700 }}>{r}</T>
                </View>
              ))}
            </View>
          )}

          <View style={styles.facts}>
            <View style={styles.fact}><MapPin size={16} color={colors.brand700} /><T v="caption">Where</T><T v="label" numberOfLines={2}>{o.location}</T></View>
            <View style={styles.fact}>
              <CalendarDays size={16} color={o.closing_soon ? colors.rose600 : colors.brand700} />
              <T v="caption">{o.is_event ? "When" : "Deadline"}</T>
              <T v="label" color={o.closing_soon ? colors.rose600 : undefined}>
                {o.is_event && o.starts_at ? new Date(o.starts_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : o.deadline ? new Date(o.deadline).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "Open"}
              </T>
            </View>
            <View style={styles.fact}><Users size={16} color={colors.brand700} /><T v="caption">Open to</T><T v="label">{o.gender === "female" ? "Sisters" : o.gender === "male" ? "Brothers" : "Everyone"}</T></View>
          </View>

          {o.closing_soon && <View style={styles.closing}><AlertTriangle size={16} color={colors.rose600} /><T v="label" color={colors.rose600}>Closes {o.days_left === 0 ? "today" : `in ${o.days_left} day${o.days_left === 1 ? "" : "s"}`}. Don&apos;t miss it!</T></View>}

          <Block title="About" text={o.description} />
          <Block title="Eligibility" text={o.eligibility} />
          {(o.education_levels.length > 0 || o.min_age || o.max_age || o.counties.length > 0) && (
            <View style={styles.tags}>
              {o.education_levels.map((e) => <Badge key={e} label={edu(e)} tone="good" />)}
              {(o.min_age || o.max_age) && <Badge label={`Age ${o.min_age ?? "any"}–${o.max_age ?? "any"}`} />}
              {o.counties.slice(0, 5).map((c) => <Badge key={c} label={c} tone="info" />)}
              {o.requires_verified_identity && <Badge label="Verified ID required" tone="gold" icon={BadgeCheck} />}
            </View>
          )}
          <Block title="What you get" text={o.benefits} />
          <Block title="Requirements" text={o.requirements} />
          {!o.locked && <Block title="How to apply" text={o.application_process} />}
          {o.required_documents.length > 0 && (
            <View style={{ marginTop: 22 }}>
              <T v="overline" color={colors.ink400}>Documents to prepare</T>
              <View style={[styles.tags, { marginTop: 8 }]}>{o.required_documents.map((d) => <Badge key={d} label={d} icon={FileText} />)}</View>
            </View>
          )}
          {o.venue && <Block title="Venue" text={o.venue} />}

          <View style={styles.safety}>
            <ShieldCheck size={18} color={colors.brand700} />
            <T v="small" style={{ flex: 1 }}>DEEN reviewed this listing. Genuine opportunities never ask you to pay. If anyone does, report it.</T>
          </View>

          {o.application?.status === "accepted" && (
            <View style={[styles.safety, { backgroundColor: colors.gold50, borderColor: colors.gold100 }]}>
              <Arabic size={18} color={colors.gold700}>الْحَمْدُ لِلَّهِ</Arabic>
              <T v="small" style={{ flex: 1 }}>Congratulations! Share your story to inspire others.</T>
            </View>
          )}
        </View>

        {similar.data && similar.data.length > 0 && (
          <View>
            <T v="h2" style={{ paddingHorizontal: 20, marginBottom: 12 }}>Similar opportunities</T>
            <FlatList horizontal data={similar.data} keyExtractor={(s) => s.id} renderItem={({ item }) => <OpportunityCard o={item} compact />}
              contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }} showsHorizontalScrollIndicator={false} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 14) }]}>
        <IconButton icon={o.saved ? BookmarkCheck : Bookmark} label="Save" onPress={() => save.mutate(o)} color={o.saved ? colors.brand700 : colors.ink700} size={54} />
        <View style={{ flex: 1 }}>
          {o.application && status ? (
            <Button title={`${status.label} · View application`} variant="secondary" onPress={() => router.push(`/application/${o.application!.id}`)} />
          ) : closed ? (
            <Button title="Applications closed" variant="secondary" disabled />
          ) : o.locked ? (
            <Button title={`Unlock with ${o.access_tier === "premium" ? "Premium" : "Membership"}`} variant="gold" icon={Crown} onPress={() => router.push("/membership")} />
          ) : o.apply_mode === "internal" ? (
            <Button title={o.is_event ? "Register" : "Apply now"} onPress={() => router.push(`/apply/${o.id}`)} />
          ) : (
            <Button title="Apply on their website" icon={ExternalLink} onPress={openExternal} />
          )}
        </View>
      </View>
      <ReportSheet id={o.id} open={report} onClose={() => setReport(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: "absolute", width: 300, height: 300, borderRadius: 150, backgroundColor: "rgba(227,157,41,0.14)", top: -120, right: -100 },
  hero: { paddingHorizontal: 20, paddingBottom: 22, paddingTop: 6 },
  cat: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9, alignSelf: "flex-start" },
  catText: { fontFamily: fonts.bold, fontSize: 12 },
  amount: { fontFamily: fonts.bold, fontSize: 17, color: colors.gold400, marginTop: 8 },
  org: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 16, padding: 12 },
  matchCard: { backgroundColor: colors.white, borderRadius: 20, padding: 16, borderWidth: 1.5, borderColor: colors.brand100, gap: 8 },
  noMatch: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.sand100, alignItems: "center", justifyContent: "center" },
  reason: { flexDirection: "row", gap: 8, alignItems: "center", paddingTop: 2 },
  facts: { flexDirection: "row", gap: 10, marginTop: 14 },
  fact: { flex: 1, backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 3, borderWidth: 1, borderColor: colors.sand200 },
  closing: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.rose50, borderRadius: 14, padding: 12, marginTop: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  safety: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 24, backgroundColor: colors.brand50, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.brand100 },
  bar: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, alignItems: "center", paddingHorizontal: 16, paddingTop: 12, backgroundColor: "rgba(246,244,238,0.97)", borderTopWidth: 1, borderTopColor: colors.sand200 },
});
