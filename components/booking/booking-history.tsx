"use client";

import Link from "@/components/navigation/app-link";
import { RecordedBookings } from "@/components/dataset/recorded-bookings";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cancelBackendHold, loadMoreBackendBookings, refreshBackendBookings, requestBackendRefund } from "@/services/backend-bookings";
import { useExperience } from "@/hooks/use-experience";
import { hotelDate } from "@/services/experience";
import { stayPhase } from "@/lib/staff-operations";
import { Status } from "@/components/experience/shared";
import { useAuth } from "@/hooks/use-auth";
import { useBookingStore } from "@/hooks/use-bookings";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/format";
import type { Booking, PaymentRecord } from "@/types/booking";

function BookingCard({ booking, showGuest, staff = false }: { booking: Booking; showGuest: boolean; staff?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { checkIns } = useExperience();
  async function cancel() {
    setBusy(true);
    setError("");
    try { await cancelBackendHold(booking.id); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to cancel this hold."); }
    finally { setBusy(false); }
  }
  const checkIn = checkIns.find(item => item.bookingId === booking.id);
  return <article className="panel booking-card">
    <div className="booking-card-heading"><div><span className="eyebrow">{booking.id}</span><h3>{booking.roomName}</h3></div><span className="role-pill">{booking.status[0].toUpperCase() + booking.status.slice(1)}</span></div>
    {showGuest && <p className="muted">Guest: {booking.guestName}</p>}
    <div className="booking-dates"><span><Icon name="calendar" />{booking.checkIn} — {booking.checkOut}</span><span><Icon name="people" />{booking.guests} {booking.guests === 1 ? "guest" : "guests"}</span></div>
    <div className="booking-total"><span>{booking.status === "confirmed" ? "Verified payment" : "Reservation total (not paid)"}</span><strong>{formatMoney(booking.amount)}</strong></div>
    {booking.paymentReference && <p className="muted booking-reference">Payment reference: {booking.paymentReference}</p>}
    {booking.status === "pending" && !showGuest && <div className="experience-actions"><Link className="button button-primary" href={"/checkout?bookingId=" + encodeURIComponent(booking.id)}>Complete payment <Icon name="arrow" /></Link><button type="button" className="button button-soft" disabled={busy} onClick={() => void cancel()}>{busy ? "Cancelling…" : "Cancel hold"}</button></div>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {staff && booking.status === "confirmed" && <div className="staff-booking-status"><span>Digital check-in</span>{checkIn ? <Status status={checkIn.status} /> : <span className="upcoming-label">Not submitted</span>}</div>}
    {staff && booking.status === "confirmed" && checkIn && <Link className="button button-soft" href={`/staff/check-ins?booking=${encodeURIComponent(booking.id)}`}>Review check-in <Icon name="arrow" /></Link>}
    {!showGuest && booking.status === "confirmed" && <Link className="button button-soft" href={`/guest/check-in?booking=${encodeURIComponent(booking.id)}`}>View digital check-in <Icon name="arrow" /></Link>}
  </article>;
}

function LivePaymentActivity({ payments, refresh }: { payments: PaymentRecord[]; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function refund(reference: string) {
    setBusy(reference);
    setError("");
    setNotice("");
    try {
      await requestBackendRefund(reference);
      await refresh();
      setNotice("Refund requested. Check Paystack for its final status.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Refund could not be requested.");
    } finally {
      setBusy("");
    }
  }
  return <section className="panel team-panel">
    <div className="staff-section-heading"><div><h2>Paystack reconciliation</h2><p className="muted">Verified payment results and refunds from the backend.</p></div></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    <div className="audit-list">
      {payments.length ? payments.map(item => <div key={item.id}>
        <strong>{item.status.replaceAll("_", " ")} · {formatMoney(item.amount / 100)}</strong>
        <span>{item.reference}</span>
        <small>Refund: {item.refundStatus || "none"}</small>
        {item.status === "refund_required" && ["none", "failed"].includes(item.refundStatus) &&
          <button type="button" className="button button-soft" disabled={Boolean(busy)} onClick={() => void refund(item.reference)}>
            {busy === item.reference ? "Requesting refund…" : "Request full refund"}
          </button>}
      </div>) : <p className="muted">No live payments have been recorded.</p>}
    </div>
  </section>;
}

export function BookingHistory() {
  const { bookings, audit, payments, loading, error, total } = useBookingStore();
  const account = useAuth();
  const params = useSearchParams();
  const [search, setSearch] = useState("");
  if (!account) return null;
  const isGuest = account.role === "guest";
  const isManager = account.role === "manager";
  const staff = account.role === "staff";
  const today = hotelDate();
  const requested = params.get("view");
  const view = ["today", "upcoming", "current", "past"].includes(requested ?? "") ? requested : "all";
  const focus = params.get("booking");
  const filtered = (booking: Booking) => (!focus || booking.id === focus) && (view === "all" || (view === "today" ? booking.checkIn === today : view === "upcoming" ? booking.checkIn >= today : stayPhase(booking, today) === view)) && `${booking.guestName} ${booking.roomName} ${booking.id}`.toLowerCase().includes(search.trim().toLowerCase());
  const visible = bookings.filter(booking => !isGuest || booking.guestId === account.id).filter(booking => !staff || filtered(booking)).sort((a, b) => staff ? a.checkIn.localeCompare(b.checkIn) || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt));
  const confirmed = isGuest && visible.find(booking => booking.status === "confirmed" && booking.id === params.get("confirmed"));
  const refresh = () => refreshBackendBookings(account, true).then(() => {});
  return <section className="workspace-section">
    <Link className="text-link" href={`/${account.role}`}><Icon name="back" /> Back to dashboard</Link>
    {confirmed && <div className="confirmation-panel" role="status"><span className="confirmation-icon"><Icon name="check" width={36} height={36} /></span><h2>Booking confirmed!</h2><p>Your Paystack payment was verified. Your reservation for {confirmed.roomName} is confirmed.</p><strong>{confirmed.id}</strong></div>}
    <div><span className="eyebrow">Reservations</span><h2>{isGuest ? "My bookings" : "Hotel bookings"}</h2><p className="muted">{total ?? bookings.length} reservations</p></div>
    {loading && <p role="status">Loading live reservations…</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {<button type="button" className="button button-soft" disabled={Boolean(loading)} onClick={() => void refresh()}>{loading ? "Refreshing…" : "Refresh records"}</button>}
    {staff && <div className="panel staff-filter-panel"><div className="filter-tabs" aria-label="Reservation filters">{["all", "today", "upcoming", "current", "past"].map(item => <Link className={!focus && view === item ? "filter-active" : ""} aria-current={!focus && view === item ? "true" : undefined} href={item === "all" ? "/staff/bookings" : `/staff/bookings?view=${item}`} key={item}>{item === "all" ? "All" : item === "today" ? "Today" : item === "upcoming" ? "Upcoming" : item === "current" ? "Current stays" : "Past"}</Link>)}</div><label className="auth-field"><span>Search reservations</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Guest, room or booking reference" /></label>{focus && <Link className="text-link" href="/staff/bookings">Clear selected reservation</Link>}</div>}
    {isManager && <div className="panel booking-total"><span>Verified booking revenue</span><strong>{formatMoney(visible.filter(item => item.status === "confirmed").reduce((sum, booking) => sum + booking.amount, 0))}</strong></div>}
    {visible.length ? <div className="workspace-grid">{visible.map(booking => <BookingCard key={booking.id} booking={booking} showGuest={!isGuest} staff={staff} />)}</div> : <div className="panel empty-state"><Icon name="calendar" width={32} height={32} /><h3>{staff ? "No matching reservations" : "No confirmed bookings yet"}</h3><p>{staff ? "Change the filter or search to see other reservations." : "Bookings will appear here after a successful payment."}</p>{isGuest && <Link href="/rooms" className="button button-primary">Find a room</Link>}</div>}
    {!focus && bookings.length < (total || 0) && <button type="button" className="button button-soft" disabled={Boolean(loading)} onClick={() => void loadMoreBackendBookings(account)}>{loading ? "Loading…" : "Load more bookings"}</button>}
    {isManager && !focus && <RecordedBookings manager />}
    {isManager && <LivePaymentActivity payments={payments || []} refresh={refresh} />}
    {isManager && <section className="panel team-panel"><h2>Booking &amp; payment activity</h2><div className="audit-list">{audit.length ? [...audit].reverse().map(item => <div key={item.id}><strong>{item.event.replaceAll("_", " ")}</strong><span>{new Date(item.createdAt).toISOString().replace("T", " ").slice(0, 19)} UTC</span><small>{item.reference}</small></div>) : <p className="muted">No payment activity yet.</p>}</div></section>}
  </section>;
}
