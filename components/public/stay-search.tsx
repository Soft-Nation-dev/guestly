"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { localDate, nextDate, stayNights } from "@/lib/format";
import type { StaySearch as Search } from "@/types/hotel";

export function StaySearch({ initial, roomId }: { initial?: Search; roomId?: string }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState(initial?.checkIn ?? "");
  const [checkOut, setCheckOut] = useState(initial?.checkOut ?? "");
  const [guests, setGuests] = useState(initial?.guests ?? 2);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (checkIn < localDate()) return setError("Choose a check-in date today or later.");
    if (!stayNights(checkIn, checkOut)) return setError("Check-out must be after check-in.");
    setError("");
    const query = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
    if (roomId) query.set("room", roomId);
    router.push(`/rooms?${query}`, { scroll: false });
  }

  return <form className="stay-search" onSubmit={submit}>
    <label><span><Icon name="calendar" /> Check-in</span><input type="date" required value={checkIn} onChange={(event) => {
      const value = event.target.value;
      setCheckIn(value);
      if (value && checkOut && checkOut <= value) setCheckOut(nextDate(value));
    }} /></label>
    <label><span><Icon name="calendar" /> Check-out</span><input type="date" required value={checkOut} min={checkIn ? nextDate(checkIn) : undefined} onChange={(event) => setCheckOut(event.target.value)} /></label>
    <label><span><Icon name="people" /> Guests</span><select value={guests} onChange={(event) => setGuests(Number(event.target.value))}>
      {[1, 2, 3].map((count) => <option key={count} value={count}>{count} {count === 1 ? "guest" : "guests"}</option>)}
    </select></label>
    <button className="button button-primary search-submit" type="submit"><Icon name="search" />{roomId ? "Check availability" : "Search rooms"}</button>
    {error && <p className="form-error" role="alert">{error}</p>}
  </form>;
}
