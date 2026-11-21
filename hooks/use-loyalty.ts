"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  liveLoyaltySnapshot, liveLoyaltyServerSnapshot, subscribeLiveLoyalty,
  refreshLiveLoyalty, resetLiveLoyalty, type LoyaltySummary,
} from "@/services/backend-loyalty";
import type { LoyaltyRule } from "@/types/management";

export function useLiveLoyalty() {
  const account = useAuth();
  const id = account?.id;
  const role = account?.role;
  const loggedOut = account === null;
  useEffect(() => {
    if (id && (role === "guest" || role === "manager")) {
      void refreshLiveLoyalty({ id, role }).catch(() => {});
    } else if (loggedOut || role !== undefined && role !== "guest" && role !== "manager") {
      resetLiveLoyalty();
    }
  }, [id, role, loggedOut]);
  const snapshot = useSyncExternalStore(subscribeLiveLoyalty, liveLoyaltySnapshot, liveLoyaltyServerSnapshot);
  return JSON.parse(snapshot) as {
    summary: LoyaltySummary | null; rules: LoyaltyRule[]; loaded: boolean; loading: boolean; error: string;
  };
}
