/** Shared server-state hooks (TanStack Query). Screens read from here; nothing else
 * talks to the network directly, which keeps caching and invalidation in one place. */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { del, get, post } from "./api";
import { toast } from "./toast";
import type { Feed, Membership, OppCard, Profile, Reminder, Taxonomy, Zakat } from "./types";

export const keys = {
  feed: ["feed"] as const,
  taxonomy: ["taxonomy"] as const,
  profile: ["profile"] as const,
  membership: ["membership"] as const,
  today: ["today"] as const,
  saved: ["saved"] as const,
  applications: ["applications"] as const,
  unread: ["unread"] as const,
};

export const useTaxonomy = () => useQuery({ queryKey: keys.taxonomy, queryFn: () => get<Taxonomy>("/taxonomy"), staleTime: 30 * 60_000 });
export const useFeed = () => useQuery({ queryKey: keys.feed, queryFn: () => get<Feed>("/opportunities/feed") });
export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: () => get<Profile>("/me/profile") });
export const useMembership = () => useQuery({ queryKey: keys.membership, queryFn: () => get<Membership>("/membership") });
export const useToday = () => useQuery({ queryKey: keys.today, queryFn: () => get<{ reminder: Reminder | null; zakat: Zakat }>("/content/today"), staleTime: 60 * 60_000 });
export const useUnread = () => useQuery({ queryKey: keys.unread, queryFn: () => get<{ count: number }>("/notifications/unread-count"), refetchInterval: 60_000 });

/** Save/unsave with an optimistic flip across every cached list the card appears in. */
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (o: OppCard) => (o.saved ? del(`/opportunities/${o.id}/save`) : post(`/opportunities/${o.id}/save`)),
    onMutate: (o) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
      const flip = (c: OppCard) => (c.id === o.id ? { ...c, saved: !o.saved } : c);
      qc.setQueryData<Feed>(keys.feed, (f) => f && {
        ...f, featured: f.featured.map(flip), closing_soon: f.closing_soon.map(flip), for_you: f.for_you.map(flip), events: f.events.map(flip),
      });
      qc.setQueriesData<{ items: OppCard[] }>({ queryKey: ["explore"] }, (d) => d && { ...d, items: d.items.map(flip) });
      qc.setQueryData(["opportunity", o.id], (d: OppCard | undefined) => d && { ...d, saved: !o.saved });
      if (!o.saved) toast("Saved. We'll remind you before it closes.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.saved }),
  });
}
