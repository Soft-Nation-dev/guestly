import { apiRequest } from '@/services/api-client';
import { authorizedRequest } from '@/services/backend-auth';
import { hotel as hotelDefaults } from '@/data/hotel';
import type { Room, StaySearch } from '@/types/hotel';

export type LiveRoom = Room & { availableInventory: number };
export type HotelProfile = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  location: string;
  currency: 'NGN';
  heroImage: string;
};

const defaultHotel: HotelProfile = { ...hotelDefaults, id: 'primary', currency: 'NGN' };
const event = 'guestly:room-catalogue';
const initialCatalogue = { rooms: [] as Room[], loading: false, loaded: false, error: '' };
let catalogue = initialCatalogue;
let hotel = defaultHotel;
let roomPromise: Promise<void> | null = null;
let hotelPromise: Promise<void> | null = null;
let hotelError = '';

function announce() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(event));
}

export function subscribeLiveRooms(listener: () => void) {
  window.addEventListener(event, listener);
  return () => window.removeEventListener(event, listener);
}

export function roomCatalogueSnapshot() {
  return JSON.stringify(catalogue);
}

export function roomCatalogueServerSnapshot() {
  return JSON.stringify(initialCatalogue);
}

export function hotelSnapshot() {
  return JSON.stringify({ hotel, error: hotelError });
}

export function hotelServerSnapshot() {
  return JSON.stringify({ hotel: defaultHotel, error: '' });
}

export async function refreshRooms(force = false) {
  if (roomPromise) return roomPromise;
  if (catalogue.loaded && !force) return;
  catalogue = { ...catalogue, loading: true, error: '' };
  announce();
  roomPromise = apiRequest<Room[]>('/api/v1/rooms')
    .then(rooms => {
      catalogue = { rooms, loaded: true, loading: false, error: '' };
      announce();
    })
    .catch(error => {
      catalogue = { ...catalogue, loading: false, error: error instanceof Error ? error.message : 'Could not load rooms.' };
      announce();
      throw error;
    })
    .finally(() => { roomPromise = null; });
  return roomPromise;
}

export async function refreshHotel(force = false) {
  if (hotelPromise) return hotelPromise;
  if (!force && hotel !== defaultHotel) return;
  hotelPromise = apiRequest<HotelProfile>('/api/v1/hotels/current')
    .then(value => { hotel = value; hotelError = ''; announce(); })
    .catch(error => {
      hotelError = error instanceof Error ? error.message : 'Could not load hotel information.';
      announce();
      throw error;
    })
    .finally(() => { hotelPromise = null; });
  return hotelPromise;
}

export function fetchRoomAvailability(stay: StaySearch, signal?: AbortSignal) {
  const query = new URLSearchParams({
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: String(stay.guests),
  });
  return apiRequest<LiveRoom[]>('/api/v1/rooms/availability?' + query, { signal });
}

export async function saveBackendRoom(input: Omit<Room, 'id'>, id?: string) {
  const updated = await authorizedRequest<Room>(id ? '/api/v1/rooms/' + encodeURIComponent(id) : '/api/v1/rooms', {
    method: id ? 'PATCH' : 'POST',
    body: input,
  });
  catalogue = {
    rooms: id ? catalogue.rooms.map(room => room.id === id ? updated : room) : [...catalogue.rooms, updated],
    loaded: true,
    loading: false,
    error: '',
  };
  announce();
  return updated;
}

export async function uploadRoomPhoto(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG or WebP image under 2 MB.');
  }
  const body = new FormData();
  body.set('image', file);
  return authorizedRequest<{ url: string }>('/api/v1/rooms/photos', { method: 'POST', body });
}

export async function saveBackendHotel(fields: Pick<HotelProfile, 'name' | 'tagline' | 'description' | 'location' | 'heroImage'>) {
  const updated = await authorizedRequest<HotelProfile>('/api/v1/hotels/current', { method: 'PATCH', body: fields });
  hotel = updated;
  hotelError = '';
  announce();
  return updated;
}
