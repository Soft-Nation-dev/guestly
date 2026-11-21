import type { Room } from "@/types/hotel";

export const getFeaturedRooms = (rooms: Room[]) => rooms.filter(room => room.featured && room.inventory > 0);
export const getRoom = (id: string, rooms: Room[]) => rooms.find(room => room.id === id);
