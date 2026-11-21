"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  backendAccountsSnapshot, backendSessionSnapshot, initializeBackendAuth, subscribeBackendAuth,
} from "@/services/backend-auth";
import type { Account } from "@/types/auth";

const serverSnapshot = () => "";

export function useAuth(): Account | null | undefined {
  useEffect(() => { void initializeBackendAuth(); }, []);
  const snapshot = useSyncExternalStore(subscribeBackendAuth, backendSessionSnapshot, serverSnapshot);
  return snapshot ? JSON.parse(snapshot) : undefined;
}

export function useAccounts(): Account[] {
  const snapshot = useSyncExternalStore(subscribeBackendAuth, backendAccountsSnapshot, serverSnapshot);
  return snapshot ? JSON.parse(snapshot) : [];
}
