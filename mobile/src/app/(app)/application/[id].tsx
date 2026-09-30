import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { Heart, MessageSquareQuote } from "lucide-react-native";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { OpportunityCard } from "@/components/OpportunityCard";
import { Sheet } from "@/components/Sheet";
import { Arabic, Button, Card, Header, Input, T } from "@/components/ui";
import { get, post } from "@/lib/api";
import { keys } from "@/lib/queries";
import { APP_STATUS } from "@/lib/status";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { Application } from "@/lib/types";

export default function ApplicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: a, isLoading } = useQuery({ queryKey: ["application", id], queryFn: () => get<Application>(`/applications/${id}`) });
  const [story, setStory] = useState("");
  const [open, setOpen] = useState(false);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["application", id] }); qc.invalidateQueries({ queryKey: keys.applications }); };

  const withdraw = useMutation({ mutationFn: () => post(`/applications/${id}/withdraw`), onSuccess: () => { toast("Application withdrawn"); refresh(); }, onError: toastError });
  const outcome = useMutation({
    mutationFn: () => post(`/opportunities/${a!.opportunity.id}/outcome`, { story: story || null, share_publicly: false }),
    onSuccess: () => { toast("JazakAllahu khayran for sharing your story!"); setOpen(false); refresh(); },
    onError: toastError,
  });

  if (isLoading || !a) return <LoadingScreen label="Loading application" />;
  const s = APP_STATUS[a.status] ?? APP_STATUS.submitted;
  const finished = ["accepted", "rejected", "withdrawn"].includes(a.status);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header title="Application" />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>
        <OpportunityCard o={a.opportunity} />
        <Card>
          <T v="overline">Status</T>
          <T v="title" color={s.color} style={{ marginTop: 4 }}>{s.label}</T>
          <View style={{ marginTop: 18 }}>
            {(a.events ?? []).map((e, i, arr) => {
              const st = APP_STATUS[e.status] ?? APP_STATUS.submitted;
              const last = i === arr.length - 1;
              return (
                <View key={i} style={styles.step}>
                  <View style={{ alignItems: "center" }}>
                    <View style={[styles.node, { backgroundColor: last ? st.color : colors.brand500 }]} />
                    {!last && <View style={styles.line} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: last ? 0 : 18 }}>
                    <T v="bodyStrong">{st.label}</T>
                    <T v="caption">{new Date(e.at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</T>
                    {e.message && (
                      <View style={styles.msg}>
                        <MessageSquareQuote size={14} color={colors.brand700} />
                        <T v="small" style={{ flex: 1, color: colors.ink700 }}>{e.message}</T>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {a.status === "accepted" && !a.outcome_shared && (
          <Card style={{ backgroundColor: colors.gold50, borderColor: colors.gold100, gap: 8 }}>
            <Arabic size={22} color={colors.gold700}>الْحَمْدُ لِلَّهِ الَّذِي بِنِعْمَتِهِ تَتِمُّ الصَّالِحَاتُ</Arabic>
            <T v="small" style={{ fontStyle: "italic" }}>&ldquo;Praise be to Allah, by whose grace good deeds are completed.&rdquo; (Sunan Ibn Majah 3803)</T>
            <T v="body">Mabrook! Tell us how this opportunity helped you. Your story measures DEEN&apos;s real impact.</T>
            <Button title="Share my story" variant="gold" icon={Heart} onPress={() => setOpen(true)} size="md" />
          </Card>
        )}
        {a.status === "rejected" && (
          <Card style={{ gap: 6 }}>
            <Arabic size={20}>وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ</Arabic>
            <T v="small" style={{ fontStyle: "italic" }}>&ldquo;Perhaps you dislike something and it is good for you.&rdquo; (Qur&apos;an 2:216)</T>
            <Button title="Find similar opportunities" variant="secondary" size="md" onPress={() => router.push({ pathname: "/explore", params: { category: a.opportunity.category } })} />
          </Card>
        )}
        {!finished && !a.external && (
          <Button title="Withdraw application" variant="ghost" onPress={() => Alert.alert("Withdraw?", "The organization will no longer consider this application.", [
            { text: "Keep it", style: "cancel" }, { text: "Withdraw", style: "destructive", onPress: () => withdraw.mutate() },
          ])} />
        )}
      </ScrollView>
      <Sheet open={open} onClose={() => setOpen(false)} title="Your story" footer={<Button title="Share" loading={outcome.isPending} onPress={() => outcome.mutate()} />}>
        <Input value={story} onChangeText={setStory} multiline placeholder="How did this opportunity change things for you?" style={{ minHeight: 140, textAlignVertical: "top" }} />
        <T v="caption">Only the DEEN team sees this unless you give permission later.</T>
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 14 },
  node: { width: 14, height: 14, borderRadius: 7, marginTop: 4, borderWidth: 3, borderColor: colors.white },
  line: { flex: 1, width: 2, backgroundColor: colors.brand100, marginVertical: 2 },
  msg: { flexDirection: "row", gap: 8, marginTop: 8, backgroundColor: colors.brand50, borderRadius: 12, padding: 10 },
});
