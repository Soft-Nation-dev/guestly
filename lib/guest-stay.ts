import type { Booking } from "@/types/booking";

export function guestStay(bookings: Booking[], guestId: string, today: string) {
  const own = bookings.filter(item => item.guestId === guestId && item.status === "confirmed");
  const active = own.filter(item => item.checkOut > today).sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.createdAt.localeCompare(b.createdAt));
  const current = active.find(item => item.checkIn <= today) ?? active[0];
  if (current) return { kind: "active", booking: current, current: current.checkIn <= today, count: active.length } as const;
  const past = own.filter(item => item.checkOut <= today).sort((a, b) => b.checkOut.localeCompare(a.checkOut))[0];
  return past ? { kind: "past", booking: past } as const : { kind: "empty" } as const;
}
