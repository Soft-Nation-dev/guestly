import { localDate } from "@/lib/format";
import type { Booking } from "@/types/booking";

export function hotelDate(now = new Date()) {
  return localDate(now);
}

export function activeStay(booking: Booking, today = hotelDate()) {
  return booking.checkIn <= today && today < booking.checkOut;
}
