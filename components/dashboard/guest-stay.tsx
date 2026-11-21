"use client";

import Link from "@/components/navigation/app-link";
import { Icon } from "@/components/ui/icon";
import { Status } from "@/components/experience/shared";
import { useAuth } from "@/hooks/use-auth";
import { useBookingStore } from "@/hooks/use-bookings";
import { useExperience } from "@/hooks/use-experience";
import { hotelDate } from "@/services/experience";
import { guestStay } from "@/lib/guest-stay";
import { formatMoney, stayNights } from "@/lib/format";

const dateLabel = (value: string) => new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

function StayDates({ checkIn, checkOut, nights }: { checkIn: string; checkOut: string; nights: number }) {
  return <dl className="guest-stay-dates"><div><dt>Check-in</dt><dd><Icon name="calendar" />{dateLabel(checkIn)}</dd></div><div><dt>Check-out</dt><dd><Icon name="calendar" />{dateLabel(checkOut)}</dd></div><div><dt>Duration</dt><dd>{nights} {nights === 1 ? "night" : "nights"}</dd></div></dl>;
}

export function GuestStayOverview() {
  const account = useAuth();
  const { bookings } = useBookingStore();
  const { checkIns } = useExperience();
  if (!account || account.role !== "guest") return null;
  const stay = guestStay(bookings, account.id, hotelDate());
  if (stay.kind === "empty") return <section className="panel guest-stay" aria-label="Stay overview"><div className="guest-stay-heading"><span className="feature-icon"><Icon name="bed" /></span><div><span className="eyebrow">Your stay</span><h2>No reservations yet</h2><p className="muted">Find a room for your next visit to Guestly.</p></div></div><Link href="/rooms" className="button button-primary">Book a room <Icon name="arrow" /></Link></section>;
  const item = stay.booking;
  const checkIn = checkIns.find(value => value.bookingId === item.id && value.guestId === account.id);
  const active = stay.kind === "active";
  const action = !active ? { href: "/rooms", label: "Book another stay" } : checkIn?.status === "approved" ? { href: "/guest/access", label: "View room access" } : { href: `/guest/check-in?booking=${encodeURIComponent(item.id)}`, label: checkIn?.status === "pending" ? "View check-in status" : checkIn?.status === "rejected" ? "Resubmit check-in" : "Complete check-in" };
  return <section className="panel guest-stay" aria-label="Stay overview"><div className="guest-stay-heading"><span className="feature-icon"><Icon name="bed" /></span><div><span className="eyebrow">{stay.kind === "active" ? stay.current ? "Your current stay" : "Your upcoming stay" : "Your past reservation"}</span><h2>{item.roomName}</h2><p className="muted">Booking {item.id} · {item.guests} {item.guests === 1 ? "guest" : "guests"}</p></div><span className="role-pill">{active ? "Confirmed" : "Past"}</span></div><StayDates checkIn={item.checkIn} checkOut={item.checkOut} nights={stayNights(item.checkIn, item.checkOut)} /><div className="guest-stay-payment"><span>Payment successful</span><strong>{formatMoney(item.amount)}</strong></div>{active && <div className="guest-stay-checkin"><span>Digital check-in</span>{checkIn ? <Status status={checkIn.status} /> : <span className="upcoming-label">Not submitted</span>}</div>}<div className="guest-stay-actions"><Link href={action.href} className="button button-primary">{action.label} <Icon name="arrow" /></Link><Link href="/guest/bookings" className="button button-soft">All bookings</Link></div>{stay.kind === "active" && stay.count > 1 && <p className="muted">{stay.count - 1} more {stay.count === 2 ? "reservation" : "reservations"} in your bookings.</p>}</section>;
}
