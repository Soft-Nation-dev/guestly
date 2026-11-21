"use client";

import { LiveHistoricalRecords } from "@/components/dataset/live-historical";

export function RecordedBookings({ manager = false }: { guestId?: string; manager?: boolean }) {
  return manager ? <LiveHistoricalRecords source="bookings" /> : null;
}
