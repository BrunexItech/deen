import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { BadgeCheck, Globe, Mail, MapPin, MessageCircle, Phone, Store } from "lucide-react-native";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LoadingScreen } from "@/components/Loader";
import { Badge, Button, Card, Header, T } from "@/components/ui";
import { get } from "@/lib/api";
import { colors } from "@/lib/theme";
import type { Listing } from "@/lib/types";

export default function ListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, isLoading } = useQuery({ queryKey: ["listing", id], queryFn: () => get<Listing>(`/directory/${id}`) });
  if (isLoading || !d) return <LoadingScreen />;
  const wa = d.whatsapp ?? d.phone;
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Header />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={styles.icon}><Store size={34} color={colors.brand700} /></View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <T v="title" center>{d.name}</T>
            {d.verified && <BadgeCheck size={20} color={colors.brand600} />}
          </View>
          <T v="body" center style={{ color: colors.ink500 }}>{d.headline}</T>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <Badge label={d.category_label} />
            {d.halal_certified && <Badge label="Halal certified" tone="good" />}
            <Badge label={d.kind === "business" ? "Business" : "Professional"} tone="info" />
          </View>
        </View>
        {d.description && <Card><T v="body">{d.description}</T></Card>}
        {d.services.length > 0 && (
          <Card>
            <T v="overline" color={colors.ink400}>Services</T>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>{d.services.map((s) => <Badge key={s} label={s} tone="good" />)}</View>
          </Card>
        )}
        <Card style={{ gap: 12 }}>
          {d.county && <View style={styles.line}><MapPin size={16} color={colors.brand700} /><T v="small">{[d.town, d.county].filter(Boolean).join(", ")}</T></View>}
          {d.email && <View style={styles.line}><Mail size={16} color={colors.brand700} /><T v="small">{d.email}</T></View>}
          {d.website && <View style={styles.line}><Globe size={16} color={colors.brand700} /><T v="small">{d.website}</T></View>}
        </Card>
        <View style={{ gap: 10 }}>
          {wa && <Button title="WhatsApp" icon={MessageCircle} onPress={() => Linking.openURL(`https://wa.me/${wa.replace(/\D/g, "")}?text=${encodeURIComponent("Assalamu alaikum, I found you on DEEN.")}`)} />}
          {d.phone && <Button title="Call" icon={Phone} variant="secondary" onPress={() => Linking.openURL(`tel:${d.phone}`)} />}
          {d.website && <Button title="Visit website" icon={Globe} variant="secondary" onPress={() => WebBrowser.openBrowserAsync(d.website!)} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  icon: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.brand50, alignItems: "center", justifyContent: "center" },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
});
