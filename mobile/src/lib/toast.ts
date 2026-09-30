import { create } from "zustand";

type Kind = "info" | "success" | "error";

interface ToastState {
  message: string | null;
  kind: Kind;
  id: number;
  show: (message: string, kind?: Kind) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  kind: "info",
  id: 0,
  show: (message, kind = "info") => set((s) => ({ message, kind, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));

export const toast = (message: string, kind: Kind = "success") => useToast.getState().show(message, kind);
export const toastError = (e: unknown) => useToast.getState().show(e instanceof Error ? e.message : "Something went wrong", "error");
