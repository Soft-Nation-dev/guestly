"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useLiveCatalogue } from "@/hooks/use-services";
import {
  subscribeLiveRooms, roomCatalogueSnapshot, roomCatalogueServerSnapshot,
  hotelSnapshot, hotelServerSnapshot, refreshHotel, refreshRooms,
  type HotelProfile,
} from "@/services/backend-rooms";
import type { ManagementStore } from "@/types/management";
import type { Room } from "@/types/hotel";

function useRoomData() {
  useEffect(() => { void refreshRooms().catch(() => {}); }, []);
  const snapshot = useSyncExternalStore(subscribeLiveRooms, roomCatalogueSnapshot, roomCatalogueServerSnapshot);
  return JSON.parse(snapshot) as { rooms: Room[]; loading: boolean; loaded: boolean; error: string };
}

export function useRoomCatalogue() {
  return useRoomData();
}

export function useHotelProfile(): { hotel: HotelProfile; error: string } {
  useEffect(() => { void refreshHotel().catch(() => {}); }, []);
  const snapshot = useSyncExternalStore(subscribeLiveRooms, hotelSnapshot, hotelServerSnapshot);
  return JSON.parse(snapshot);
}

export function useManagement(): ManagementStore {
  const rooms = useRoomData();
  const catalogue = useLiveCatalogue();
  return { rooms: rooms.rooms, services: catalogue.services, loyaltyRules: [] };
}
