"use client";

import { useManagement, useRoomCatalogue } from "@/hooks/use-management";
import { refreshRooms } from "@/services/backend-rooms";
import { getFeaturedRooms } from "@/services/rooms";
import { RoomCard } from "@/components/public/room-card";

export function FeaturedRooms() {
  const { rooms } = useManagement();
  const catalogue = useRoomCatalogue();
  const featured = getFeaturedRooms(rooms);
  if (!catalogue.loaded && !catalogue.error) return <p className="muted" role="status">Loading featured rooms…</p>;
  if (catalogue.error) return <p className="form-error" role="alert">Unable to load featured rooms. <button type="button" className="text-link" onClick={() => void refreshRooms(true).catch(() => {})}>Try again</button></p>;
  return featured.length ? <div className="room-grid">{featured.map(room => <RoomCard key={room.id} room={room} />)}</div> : <p className="muted">Explore the room catalogue for current availability.</p>;
}
