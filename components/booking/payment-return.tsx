"use client";

import Link from "@/components/navigation/app-link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/hooks/use-auth";
import { refreshBackendBookings, verifyBackendPayment, type PaymentVerification } from "@/services/backend-bookings";
import { formatMoney } from "@/lib/format";

export function PaymentReturn() {
  const params = useSearchParams();
  const account = useAuth();
  const [result, setResult] = useState<PaymentVerification | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const reference = params.get("reference") || params.get("trxref") || "";
  const accountId = account?.id;
  const accountRole = account?.role;
  const validReference = /^[a-zA-Z0-9_-]{5,100}$/.test(reference);

  useEffect(() => {
    if (accountRole !== "guest" || !accountId || !validReference) return;
    const controller = new AbortController();
    void verifyBackendPayment(reference).then(value => {
      if (controller.signal.aborted) return;
      setResult(value);
      setError("");
      if (value.status === "success" && value.bookingStatus === "confirmed") {
        void refreshBackendBookings({ id: accountId, role: "guest" }, true).catch(() => {});
      }
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not verify this payment.");
    }).finally(() => {
      if (!controller.signal.aborted) setChecking(false);
    });
    return () => controller.abort();
  }, [accountId, accountRole, reference, validReference, attempt]);

  if (!validReference) return <div className="panel empty-state"><Icon name="shield" /><h1>Payment reference missing</h1><p>No reservation has been confirmed on this page.</p><Link href="/guest/bookings" className="button button-primary">My bookings</Link></div>;
  if (account === undefined) return <div className="panel empty-state"><Icon name="shield" /><p role="status">Loading your account…</p></div>;
  if (!account || account.role !== "guest") {
    const destination = "/payment/return?reference=" + encodeURIComponent(reference);
    return <div className="panel empty-state"><Icon name="shield" /><h1>Sign in to verify payment</h1><p>Use the guest account that started the reservation.</p><Link href={"/login?" + new URLSearchParams({ next: destination })} className="button button-primary">Sign in</Link></div>;
  }
  const confirmed = result?.status === "success" && result.bookingStatus === "confirmed";
  return <div className="panel empty-state">
    <Icon name={confirmed ? "check" : "shield"} width={32} height={32} />
    <h1>{confirmed ? "Booking confirmed" : result?.needsRefund ? "Payment needs attention" : result?.status === "review_required" ? "Payment needs review" : "Checking your payment"}</h1>
    {confirmed ? <p>Your payment of {formatMoney(result.amount / 100)} was verified by Paystack and your reservation is confirmed.</p> :
      result?.needsRefund ? <p>Payment was received, but the reservation could not be confirmed. Our team will review your refund. Please do not pay again for this hold.</p> :
      result?.status === "failed" || result?.status === "abandoned" ? <p>Payment was not successful. The booking is not confirmed.</p> :
      result?.status === "review_required" ? <p>We could not match your payment with the booking total. Contact Guestly support with your reference.</p> :
      <p>Paystack has not verified a successful payment yet. Do not start another payment until this check is complete.</p>}
    <p className="muted">Payment reference: {reference}</p>
    {error && <p role="alert" className="auth-error">{error}</p>}
    {(!confirmed && !result?.needsRefund) && <button type="button" className="button button-soft" disabled={checking} onClick={() => { setChecking(true); setAttempt(value => value + 1); }}>
      {checking ? "Checking…" : "Check payment status again"}
    </button>}
    <Link className="button button-primary" href={confirmed ? "/guest/bookings?confirmed=" + encodeURIComponent(result.booking) : "/guest/bookings"}>
      View my bookings <Icon name="arrow" />
    </Link>
  </div>;
}
