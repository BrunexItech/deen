"use client";

import { useQuery } from "@tanstack/react-query";
import { get } from "./api";
import type { Taxonomy } from "./types";

export function useTaxonomy() {
  return useQuery({ queryKey: ["taxonomy"], queryFn: () => get<Taxonomy>("/taxonomy"), staleTime: 10 * 60_000 });
}

export function useCategoryLabel() {
  const { data } = useTaxonomy();
  return (key: string) => data?.categories.find((c) => c.key === key)?.name ?? key;
}

export function useTypeLabel() {
  const { data } = useTaxonomy();
  return (key: string) => {
    for (const c of data?.categories ?? []) {
      const t = c.types.find((x) => x.key === key);
      if (t) return t.name;
    }
    return key;
  };
}
