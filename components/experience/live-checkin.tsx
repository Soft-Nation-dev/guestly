"use client";

import Link from "@/components/navigation/app-link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useBookingStore } from "@/hooks/use-bookings";
import { useCheckIns } from "@/hooks/use-checkins";
import {
  submitBackendCheckIn, reviewBackendCheckIn, downloadBackendIdentity,
  refreshBackendCheckIns, loadMoreCheckIns,
} from "@/services/backend-checkins";
import { documentKinds } from "@/data/hotel";
import { hotelDate } from "@/services/experience";
import { Icon } from "@/components/ui/icon";
import { BookingPicker, EmptyExperience, ExperienceHeading, Status, formatMoment } from "@/components/experience/shared";
import type { Booking } from "@/types/booking";
import type { CheckIn, DocumentKind } from "@/types/experience";

function History({ item }: { item: CheckIn }) {
  return item.history?.length ? <div className="audit-list">
    {item.history.map((entry, index) => <p className="muted" key={index}>{entry.status[0].toUpperCase() + entry.status.slice(1)} · {formatMoment(entry.at)}</p>)}
  </div> : null;
}

function LiveGuestForm({ booking, current }: { booking: Booking; current?: CheckIn }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await submitBackendCheckIn({
        bookingId: booking.id,
        arrivalTime: String(form.get("arrivalTime")),
        documentKind: form.get("documentKind") as DocumentKind,
        document: file,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit check-in.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="panel experience-form" onSubmit={event => void submit(event)} aria-busy={busy}>
    <h3>Arrival details</h3>
    <div className="stay-facts"><span>{booking.guestName}</span><span>{booking.checkIn} — {booking.checkOut}</span><span>{booking.guests} guest(s)</span></div>
    {current?.reviewNote && <p className="auth-error">Review feedback: {current.reviewNote}</p>}
    <label className="auth-field"><span>Estimated arrival time (WAT)</span><input type="time" name="arrivalTime" defaultValue={current?.arrivalTime ?? "14:00"} required /></label>
    <label className="auth-field"><span>Identification type</span><select name="documentKind" defaultValue={current?.documentKind ?? documentKinds[0]}>{documentKinds.map(kind => <option key={kind}>{kind}</option>)}</select></label>
    <label className="auth-field"><span>Upload ID image (JPEG, PNG or WebP, up to 2 MB)</span>
      <input type="file" name="document" accept="image/jpeg,image/png,image/webp" onChange={event => {
        const selected = event.target.files?.[0] || null;
        setFile(selected);
        setError(selected && (selected.size > 2 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(selected.type)) ? "Choose a JPEG, PNG or WebP ID image under 2 MB." : "");
      }} required />
    </label>
    <div className="sample-document"><Icon name="shield" width={30} height={30} /><div><strong>Private ID verification</strong><p className="muted">Your ID is encrypted before storage and can only be downloaded by authorized front-desk staff. The image is removed 30 days after checkout.</p></div></div>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button type="submit" disabled={!file || busy || Boolean(error)} className="button button-primary">
      {busy ? "Submitting securely…" : current ? "Resubmit for review" : "Submit for review"} <Icon name="arrow" />
    </button>
  </form>;
}

export function LiveGuestCheckIn() {
  const account = useAuth();
  const { bookings, loading: bookingLoading } = useBookingStore();
  const { checkIns, loading, error, total } = useCheckIns();
  const params = useSearchParams();
  const [selected, setSelected] = useState("");
  const own = bookings.filter(item => item.guestId === account?.id && item.status === "confirmed" && item.checkOut > hotelDate());
  const booking = own.find(item => item.id === (selected || params.get("booking"))) ?? own[0];
  const current = checkIns.find(item => item.bookingId === booking?.id);
  const waiting = loading || bookingLoading;
  return <section className="workspace-section">
    <ExperienceHeading role="guest" title="Digital check-in" description="Send your arrival details and identity document for secure front-desk review." />
    {waiting && <p role="status">Loading your check-ins…</p>}
    {error && <p role="alert" className="auth-error">{error}</p>}
    {!booking ? <EmptyExperience title="No upcoming confirmed reservations" description="A verified booking is required before you can check in."><Link href="/rooms" className="button button-primary">Explore rooms</Link></EmptyExperience> : <>
      <BookingPicker bookings={own} value={booking.id} onChange={setSelected} />
      {current && current.status !== "rejected" ? <div className="panel experience-form">
        <Status status={current.status} />
        <h3>{current.status === "approved" ? "Check-in approved" : "Your details are under review"}</h3>
        <p className="muted">Submitted {formatMoment(current.submittedAt)}. {current.status === "pending" ? "Front-desk staff will review your privately stored ID." : "Your simulated room access is available only during the active stay window."}</p>
        <History item={current} />
        {current.status === "approved" && <Link href="/guest/access" className="button button-primary">View simulated room access</Link>}
      </div> : <LiveGuestForm key={booking.id + (current?.status || "")} booking={booking} current={current} />}
    </>}
    {account?.role === "guest" && total > checkIns.length && <button type="button" className="button button-soft" disabled={waiting} onClick={() => void loadMoreCheckIns(account)}>Load earlier check-ins</button>}
  </section>;
}

function StaffCheckInCard({ item }: { item: CheckIn }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function decide(approved: boolean) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await reviewBackendCheckIn(item.bookingId, approved, note);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to review the check-in.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await downloadBackendIdentity(item.bookingId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to retrieve the ID image.");
    } finally {
      setBusy(false);
    }
  }
  return <article className="panel experience-form">
    <div className="booking-card-heading"><div><span className="eyebrow">Booking {item.bookingId}</span><h3>{item.guestName || "Guest"}</h3></div><Status status={item.status} /></div>
    <p className="muted">{item.roomName || "Guestly room"} · Arrival {item.checkIn} at {item.arrivalTime} WAT</p>
    <div className="sample-id"><span>ENCRYPTED ID</span><Icon name="shield" width={34} height={34} /><strong>{item.documentKind}</strong></div>
    <button className="button button-soft" type="button" disabled={busy || item.documentAvailable === false} onClick={() => void download()}>Download ID securely</button>
    <p className="muted">The file is a private attachment for manual identity review. Do not share or retain it outside authorized hotel processes.</p>
    <History item={item} />
    {item.status === "pending" && item.checkOut && item.checkOut <= hotelDate() ? <p className="muted">The stay has ended; review is unavailable.</p> : item.status === "pending" ? <>
      <label className="auth-field"><span>Review note (required for rejection)</span><textarea value={note} maxLength={300} onChange={event => setNote(event.target.value)} /></label>
      {error && <p role="alert" className="auth-error">{error}</p>}
      <div className="experience-actions">
        <button type="button" className="button button-primary" disabled={busy} onClick={() => void decide(true)}>{busy ? "Saving…" : "Approve check-in"}</button>
        <button type="button" className="button button-soft" disabled={busy || !note.trim()} onClick={() => void decide(false)}>Reject</button>
      </div>
    </> : <p className="muted">{item.reviewNote || "Review completed."}</p>}
    {item.status !== "pending" && error && <p role="alert" className="auth-error">{error}</p>}
  </article>;
}

export function LiveStaffCheckIns() {
  const account = useAuth();
  const { checkIns, loading, error, total } = useCheckIns();
  const params = useSearchParams();
  const focus = params.get("booking");
  const filter = params.get("view") || "all";
  const visible = checkIns.filter(item => (!focus || item.bookingId === focus) && (filter === "all" || item.status === filter))
    .sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.submittedAt.localeCompare(a.submittedAt));
  const pendingCount = checkIns.filter(item => item.status === "pending").length;
  return <section className="workspace-section">
    <ExperienceHeading role="staff" title="Check-in queue" description="Review guest ID images and approve or reject confirmed reservation check-ins." />
    <div className="filter-tabs" aria-label="Check-in filters">{["all", "pending", "approved", "rejected"].map(item => <Link key={item} className={!focus && filter === item ? "filter-active" : ""} aria-current={!focus && filter === item ? "true" : undefined} href={item === "all" ? "/staff/check-ins" : "/staff/check-ins?view=" + item}>{item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)}</Link>)}</div>
    {focus && <Link href="/staff/check-ins" className="text-link">Clear selected booking</Link>}
    <p className="muted">{pendingCount} awaiting review in the loaded queue</p>
    {loading && <p role="status">Loading guest check-ins…</p>}
    {error && <p className="auth-error" role="alert">{error}</p>}
    {visible.length ? <div className="workspace-grid">{visible.map(item => <StaffCheckInCard key={item.bookingId} item={item} />)}</div> :
      <EmptyExperience title="No matching submissions" description="Change the filter or await a guest ID submission." />}
    {account?.role === "staff" && <div className="experience-actions">
      <button type="button" className="button button-soft" disabled={loading} onClick={() => void refreshBackendCheckIns(account, true)}>{loading ? "Refreshing…" : "Refresh queue"}</button>
      {checkIns.length < total && <button type="button" className="button button-soft" disabled={loading} onClick={() => void loadMoreCheckIns(account)}>Load more check-ins</button>}
    </div>}
  </section>;
}
