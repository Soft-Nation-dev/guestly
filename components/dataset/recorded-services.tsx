"use client";

import { LiveHistoricalRecords } from "@/components/dataset/live-historical";

export function RecordedServices() {
  return <LiveHistoricalRecords source="service-requests" />;
}
