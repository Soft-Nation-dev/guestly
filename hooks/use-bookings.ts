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
  const loggedOut = account === null;
  useEffect(() => {
    if (accountId && accountRole && ["guest", "staff", "manager"].includes(accountRole)) {
      void refreshBackendBookings({ id: accountId, role: accountRole }).catch(() => {});
    } else if (loggedOut) {
      resetBackendBookings();
    }
  }, [accountId, accountRole, loggedOut]);

  const snapshot = useSyncExternalStore(
    subscribeBackendBookings,
    backendBookingSnapshot,
    backendBookingServerSnapshot,
  );
  return JSON.parse(snapshot) as BookingStore;
}
