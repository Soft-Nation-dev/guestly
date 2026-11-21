"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  backendBookingSnapshot, backendBookingServerSnapshot, subscribeBackendBookings,
  refreshBackendBookings, resetBackendBookings,
} from "@/services/backend-bookings";
import type { BookingStore } from "@/types/booking";

export function useBookingStore(): BookingStore {
  const account = useAuth();
  const accountId = account?.id;
  const accountRole = account?.role;
  useEffect(() => {
    if (accountId && accountRole && ["guest", "staff", "manager"].includes(accountRole)) {
      void refreshBackendBookings({ id: accountId, role: accountRole }).catch(() => {});
    } else if (account === null) {
      resetBackendBookings();
    }
  }, [accountId, accountRole, account === null]);

  const snapshot = useSyncExternalStore(
    subscribeBackendBookings,
    backendBookingSnapshot,
    backendBookingServerSnapshot,
  );
  return JSON.parse(snapshot) as BookingStore;
}
