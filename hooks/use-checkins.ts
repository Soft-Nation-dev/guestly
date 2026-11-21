"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  checkInSnapshot, checkInServerSnapshot, refreshBackendCheckIns,
  resetBackendCheckIns, subscribeCheckIns,
} from "@/services/backend-checkins";

export function useCheckIns() {
  const account = useAuth();
  const id = account?.id;
  const role = account?.role;
  const loggedOut = account === null;
  useEffect(() => {
    if (id && (role === "guest" || role === "staff")) {
      void refreshBackendCheckIns({ id, role }).catch(() => {});
    } else if (loggedOut || role === "manager" || role === "admin") {
      resetBackendCheckIns();
    }
  }, [id, role, loggedOut]);
  const snapshot = useSyncExternalStore(subscribeCheckIns, checkInSnapshot, checkInServerSnapshot);
  return JSON.parse(snapshot) as { checkIns: import("@/types/experience").CheckIn[]; total: number; page: number; loading: boolean; error: string };
}
