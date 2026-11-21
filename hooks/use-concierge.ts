"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  conciergeServerSnapshot, conciergeSnapshot, refreshLiveConcierge,
  resetLiveConcierge, subscribeLiveConcierge,
  type ConversationSummary,
} from "@/services/backend-concierge";
import type { ConciergeMessage } from "@/types/experience";

export function useLiveConcierge(selectedGuest = "") {
  const account = useAuth();
  const id = account?.id;
  const role = account?.role;
  const loggedOut = account === null;
  useEffect(() => {
    if (id && (role === "guest" || role === "staff")) {
      void refreshLiveConcierge({ id, role }, selectedGuest).catch(() => {});
    } else if (loggedOut || role === "manager" || role === "admin") {
      resetLiveConcierge();
    }
  }, [id, role, loggedOut, selectedGuest]);
  const snapshot = useSyncExternalStore(subscribeLiveConcierge, conciergeSnapshot, conciergeServerSnapshot);
  return JSON.parse(snapshot) as {
    messages: ConciergeMessage[];
    conversations: ConversationSummary[];
    selectedGuestId: string;
    messageTotal: number;
    messagePage: number;
    conversationTotal: number;
    conversationPage: number;
    loading: boolean;
    error: string;
  };
}
