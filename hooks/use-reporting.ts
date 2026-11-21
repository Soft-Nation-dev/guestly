"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  subscribeManagerReport, managerReportSnapshot, managerReportServerSnapshot,
  refreshManagerReport, resetManagerReport, type ManagementReport,
} from "@/services/backend-reporting";

export function useManagerReport() {
  const account = useAuth();
  const id = account?.id;
  const role = account?.role;
  const loggedOut = account === null;
  useEffect(() => {
    if (id && role === "manager") {
      void refreshManagerReport(id).catch(() => {});
    } else if (loggedOut || role !== undefined && role !== "manager") {
      resetManagerReport();
    }
  }, [id, role, loggedOut]);
  const snapshot = useSyncExternalStore(subscribeManagerReport, managerReportSnapshot, managerReportServerSnapshot);
  return JSON.parse(snapshot) as { report: ManagementReport | null; loaded: boolean; loading: boolean; error: string };
}
