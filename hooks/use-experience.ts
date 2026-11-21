"use client";

import { useCheckIns } from "@/hooks/use-checkins";
import { useAuth } from "@/hooks/use-auth";
import { useLiveRequests } from "@/hooks/use-services";
import { useLiveConcierge } from "@/hooks/use-concierge";
import type { ExperienceStore } from "@/types/experience";

export function useExperience(): ExperienceStore {
  const account = useAuth();
  const live = useCheckIns();
  const requests = useLiveRequests();
  const concierge = useLiveConcierge();
  const messages = account?.role === "staff" ? concierge.conversations.map(item => ({
    id: "latest-" + item.guestId, guestId: item.guestId, guestName: item.guestName,
    sender: item.sender, senderName: item.guestName, text: item.lastText, createdAt: item.updatedAt,
  })) : concierge.messages;
  return { checkIns: live.checkIns, requests: requests.requests, messages };
}
