import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { BellPlus, BellRing, Globe, Mail, MapPin, Phone } from "lucide-react-native";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { OpportunityCard, OrgLogo, Verified } from "@/components/OpportunityCard";
import { Badge, Button, Empty, Header, T, Tap } from "@/components/ui";
import { del, get, post } from "@/lib/api";
import { colors } from "@/lib/theme";
import { toast } from "@/lib/toast";
import type { OppCard, OrgMini } from "@/lib/types";

interface OrgPage extends OrgMini {
  description: string | null; website: string | null; email: string | null; phone: string | null; address: string | null;
  followers_count: number; following: boolean; opportunities_total: number; opportunities: OppCard[];
}

export default function Organization() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { data: o, isLoading } = useQuery({ queryKey: ["org", id], queryFn: () => get<OrgPage>(`/organizations/${id}`) });
  const follow = useMutation({
    mutationFn: () => (o?.following ? del(`/organizations/${id}/follow`) : post(`/organizations/${id}/follow`)),
    onSuccess: () => { if (!o?.following) toast(`You'll be notified when ${o?.name} posts something new`); qc.invalidateQueries({ queryKey: ["org", id] }); },
  });
  if (isLoading || !o) return <LoadingScreen label="Loading organization" />;
  const verif = { trusted: "Trusted partner", verified: "Verified by DEEN", pending: "Pending verification" }[o.verification];

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} style={{ backgroundColor: colors.sand100 }}>
      <LinearGradient colors={[colors.emerald800, colors.emerald950]} style={{ paddingTop: insets.top, paddingBottom: 26 }}>
        <Header dark />
        <View style={styles.hero}>
          <OrgLogo org={o} size={76} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 }}>
            <T v="title" color={colors.white} center>{o.name}</T>
            <Verified org={o} size={20} />
          </View>
          {o.tagline && <T v="small" color={colors.emerald100} center style={{ marginTop: 4 }}>{o.tagline}</T>}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <Badge label={verif} tone={o.verification === "trusted" ? "gold" : "good"} />
            <Badge label={`${o.followers_count} following`} />
          </View>
          <Button title={o.following ? "Following" : "Follow for updates"} icon={o.following ? BellRing : BellPlus} variant={o.following ? "secondary" : "gold"} size="md"
            loading={follow.isPending} onPress={() => follow.mutate()} style={{ marginTop: 18, minWidth: 220 }} />
        </View>
      </LinearGradient>
      <View style={{ padding: 20, gap: 12 }}>
        {o.description && <T v="body">{o.description}</T>}
        <View style={styles.contacts}>
          {o.county && <View style={styles.contact}><MapPin size={16} color={colors.emerald700} /><T v="small">{[o.address, o.county].filter(Boolean).join(", ")}</T></View>}
          {o.website && <Tap onPress={() => WebBrowser.openBrowserAsync(o.website!)} style={styles.contact}><Globe size={16} color={colors.emerald700} /><T v="small" color={colors.emerald700}>{o.website.replace(/^https?:\/\//, "")}</T></Tap>}
          {o.email && <Tap onPress={() => Linking.openURL(`mailto:${o.email}`)} style={styles.contact}><Mail size={16} color={colors.emerald700} /><T v="small">{o.email}</T></Tap>}
          {o.phone && <Tap onPress={() => Linking.openURL(`tel:${o.phone}`)} style={styles.contact}><Phone size={16} color={colors.emerald700} /><T v="small">{o.phone}</T></Tap>}
        </View>
        <T v="h2" style={{ marginTop: 12 }}>Open opportunities ({o.opportunities.length})</T>
        {o.opportunities.length === 0 ? <Empty icon={BellPlus} title="Nothing open right now" body="Follow to be notified the moment they post." /> : o.opportunities.map((x) => <OpportunityCard key={x.id} o={x} />)}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingHorizontal: 24 },
  contacts: { backgroundColor: colors.white, borderRadius: 18, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.sand200 },
  contact: { flexDirection: "row", alignItems: "center", gap: 10 },
});
