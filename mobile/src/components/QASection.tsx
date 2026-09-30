/** Controlled Q&A on an opportunity (spec section 24). Only answered questions are public;
 * the member also sees their own pending questions. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircleQuestion, Send } from "lucide-react-native";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { get, post } from "@/lib/api";
import { colors } from "@/lib/theme";
import { toast, toastError } from "@/lib/toast";
import type { QA } from "@/lib/types";
import { Badge, Button, Input, T } from "./ui";

export function QASection({ opportunityId }: { opportunityId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const key = ["questions", opportunityId];
  const { data } = useQuery({ queryKey: key, queryFn: () => get<QA[]>(`/opportunities/${opportunityId}/questions`) });
  const ask = useMutation({
    mutationFn: () => post(`/opportunities/${opportunityId}/questions`, { question: text.trim() }),
    onSuccess: () => { toast("Question sent. You'll be notified when it's answered."); setText(""); qc.invalidateQueries({ queryKey: key }); },
    onError: toastError,
  });
  return (
    <View style={{ marginTop: 26, gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MessageCircleQuestion size={18} color={colors.brand700} />
        <T v="h3">Questions & answers</T>
      </View>
      {data?.map((q) => (
        <View key={q.id} style={styles.item}>
          <T v="bodyStrong">{q.question}</T>
          {q.answer ? (
            <View style={styles.answer}>
              <Badge label={q.answered_by === "DEEN" ? "DEEN" : "Organization"} tone={q.answered_by === "DEEN" ? "info" : "good"} />
              <T v="small" style={{ color: colors.ink700, marginTop: 4 }}>{q.answer}</T>
            </View>
          ) : <T v="caption">Waiting for an answer · only you can see this</T>}
        </View>
      ))}
      {!data?.length && <T v="small">No questions yet. Ask anything, like &ldquo;Is this open to diploma students?&rdquo;</T>}
      <Input value={text} onChangeText={setText} placeholder="Ask about eligibility, documents, dates…" multiline maxLength={600} />
      <Button title="Ask a question" icon={Send} size="md" variant="secondary" disabled={text.trim().length < 8} loading={ask.isPending} onPress={() => ask.mutate()} />
    </View>
  );
}

const styles = StyleSheet.create({
  item: { backgroundColor: colors.white, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: colors.sand200 },
  answer: { marginTop: 8, backgroundColor: colors.brand50, borderRadius: 12, padding: 10 },
});
