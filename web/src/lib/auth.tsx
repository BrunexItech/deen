"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { FullScreenLoader } from "@/components/Loader";
import { ApiError, get, post } from "./api";
import type { Me, Portal } from "./types";

export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await get<Me>("/me");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) return null;
        throw e;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useCan() {
  const { data } = useMe();
  return (perm: string) => !!data?.permissions.includes(perm);
}

export function useSignOut() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    await post("/auth/logout").catch(() => undefined);
    qc.clear();
    router.replace("/login");
  };
}

/** Renders children only for a signed-in user of the given portal. */
export function RequirePortal({ portal, children }: { portal: Portal; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  useEffect(() => {
    if (isLoading) return;
    if (!me) router.replace("/login");
    else if (me.portal !== portal) router.replace(me.portal === "admin" ? "/admin" : "/org");
  }, [me, isLoading, portal, router]);
  if (isLoading || !me || me.portal !== portal) return <FullScreenLoader />;
  return <>{children}</>;
}
