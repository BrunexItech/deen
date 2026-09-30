"use client";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { ApiError } from "@/lib/api";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20_000,
            refetchOnWindowFocus: true,
            retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
          },
        },
        // Every failed mutation surfaces its server message; pages only handle success.
        mutationCache: new MutationCache({
          onError: (err) => toast.error(err instanceof Error ? err.message : "Something went wrong"),
        }),
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster position="top-center" richColors closeButton toastOptions={{ style: { fontFamily: "var(--font-jakarta)" } }} />
    </QueryClientProvider>
  );
}
