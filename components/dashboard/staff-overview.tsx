"use client";

import Link from "@/components/navigation/app-link";
import Image from "@/components/ui/hotel-image";
import type { ReactNode } from "react";
import { hotel } from "@/data/hotel";
import { useAccounts } from "@/hooks/use-auth";
import { useBookingStore } from "@/hooks/use-bookings";
import { useExperience } from "@/hooks/use-experience";
import { hotelDate } from "@/services/experience";
import { staffSnapshot } from "@/lib/staff-operations";
import { Icon, type IconName } from "@/components/ui/icon";
import { Status, formatMoment } from "@/components/experience/shared";

function Section({ title, icon, href, action, children }: { title: string; icon: IconName; href: string; action: string; children: ReactNode }) {
  return <section className="panel staff-section"><div className="staff-section-heading"><h2><Icon name={icon} />{title}</h2><Link href={href} className="text-link">{action}<Icon name="arrow" /></Link></div>{children}</section>;
}

function Initials({ name }: { name: string }) {
  return <span className="staff-initials" aria-hidden="true">{name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join("").toUpperCase()}</span>;
}

export function StaffOverview() {
  const { bookings } = useBookingStore();
  const { checkIns, requests, messages } = useExperience();
  const accounts = useAccounts();
  const today = hotelDate();
  const snapshot = staffSnapshot(bookings, checkIns, requests, messages, today);
  const nameFor = (id: string) => accounts.find(item => item.id === id)?.name ?? bookings.find(item => item.guestId === id)?.guestName ?? requests.find(item => item.guestId === id)?.guestName ?? messages.find(item => item.guestId === id)?.guestName ?? "Guest";
  const metrics: { label: string; count: number; icon: IconName; href: string; hint: string }[] = [
    { label: "Arrivals today", count: snapshot.arrivalsToday, icon: "calendar", href: "/staff/bookings?view=today", hint: "Confirmed reservations" },
    { label: "Pending check-in", count: snapshot.pending.length, icon: "key", href: "/staff/check-ins?view=pending", hint: "Awaiting review" },
    { label: "Open service requests", count: snapshot.openRequests.length, icon: "list", href: "/staff/services?view=open", hint: "Received or in progress" },
    { label: "Concierge replies", count: snapshot.repliesNeeded, icon: "chat", href: "/staff/concierge?view=waiting", hint: "Awaiting staff response" },
  ];

  return <div className="staff-overview">
    <div className="staff-snapshot-heading"><div><span className="eyebrow">Front desk operations</span><h2>Operational snapshot</h2></div><span className="staff-date"><Icon name="calendar" />{today} · WAT</span></div>
    <div className="staff-metrics">{metrics.map(item => <Link href={item.href} className="panel staff-metric" key={item.label}><div><span>{item.label}</span><Icon name={item.icon} /></div><strong>{item.count}</strong><small>{item.hint}</small></Link>)}</div>
    <div className="staff-operations-grid">
      <Section title="Pre-arrival approvals" icon="key" href="/staff/check-ins?view=pending" action="Review queue">
        {snapshot.pending.length ? snapshot.pending.slice(0, 4).map(item => { const booking = bookings.find(value => value.id === item.bookingId); const name = booking?.guestName ?? nameFor(item.guestId); return <article className="staff-approval" key={item.bookingId}><div className="staff-person"><Initials name={name} /><div><strong>{name}</strong><small>{booking?.roomName} · {booking?.checkIn} · {item.arrivalTime} WAT</small></div><Status status={item.status} /></div><p className="staff-review-info"><Icon name="shield" />{item.documentKind} · Document submitted</p><Link className="button button-primary" href={`/staff/check-ins?booking=${encodeURIComponent(item.bookingId)}`}>Review submission <Icon name="arrow" /></Link></article>; }) : <p className="staff-empty">No check-ins awaiting approval.</p>}
      </Section>
      <Section title="Service dispatch" icon="list" href="/staff/services?view=open" action="View requests">
        {snapshot.openRequests.length ? snapshot.openRequests.slice(0, 5).map(item => <Link className="staff-list-row" key={item.id} href={`/staff/services?request=${encodeURIComponent(item.id)}`}><span className="feature-icon"><Icon name="list" /></span><div><strong>{item.category}</strong><small>{nameFor(item.guestId)} · {bookings.find(booking => booking.id === item.bookingId)?.roomName ?? item.bookingId}</small></div><Status status={item.status} /></Link>) : <p className="staff-empty">No open service requests.</p>}
      </Section>
      <Section title="Upcoming arrivals" icon="calendar" href="/staff/bookings?view=upcoming" action="Reservations">
        {snapshot.arrivals.length ? snapshot.arrivals.slice(0, 5).map(booking => { const checkIn = checkIns.find(item => item.bookingId === booking.id); return <Link className="staff-list-row" key={booking.id} href={`/staff/bookings?booking=${encodeURIComponent(booking.id)}`}><Initials name={booking.guestName} /><div><strong>{booking.guestName}</strong><small>{booking.roomName} · {booking.checkIn}</small></div>{checkIn ? <Status status={checkIn.status} /> : <span className="upcoming-label">Not submitted</span>}</Link>; }) : <p className="staff-empty">No arrivals scheduled.</p>}
      </Section>
      <Section title="Concierge inbox" icon="chat" href="/staff/concierge" action="Open inbox">
        {snapshot.conversations.length ? snapshot.conversations.slice(0, 5).map(message => <Link className="staff-list-row" key={message.guestId} href={`/staff/concierge?guest=${encodeURIComponent(message.guestId)}`}><Initials name={nameFor(message.guestId)} /><div><strong>{nameFor(message.guestId)}</strong><small className="staff-message-preview">{message.text}</small><small>{formatMoment(message.createdAt)}</small></div>{message.sender === "guest" && <span className="experience-status status-pending">Reply</span>}</Link>) : <p className="staff-empty">No guest conversations yet.</p>}
      </Section>
    </div>
    <section className="staff-facilities"><h2>Hotel facilities</h2><div className="facility-grid">{hotel.facilities.map(item => <article className="facility-card" key={item.title}><div className="facility-image"><Image src={item.image} alt={item.title} fill sizes="(max-width: 760px) 100vw, 33vw" /></div><div><h3>{item.title}</h3><p>{item.description}</p></div></article>)}</div></section>
  </div>;
}
