"use client";

import Link from "@/components/navigation/app-link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { safeAuthReturn } from "@/lib/booking-query";
import { Icon } from "@/components/ui/icon";
import { PasswordField } from "@/components/auth/password-field";
import { useAuth } from "@/hooks/use-auth";
import { registerGuest, signIn, signOut } from "@/services/auth";
import { roleLabels, roleRoutes } from "@/types/auth";

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAuthReturn(params.get("next"), true);
  const nextQuery = next ? `?${new URLSearchParams({ next })}` : "";
  const account = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function authenticate(action: () => ReturnType<typeof signIn>) {
    setError("");
    setBusy(true);
    try {
      const user = await action();
      router.replace(user.role === "guest" && next ? next : roleRoutes[user.role], { scroll: false });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    if (register && password !== String(data.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      return;
    }
    void authenticate(() => register ? registerGuest({ name: String(data.get("name") ?? ""), email, password }) : signIn({ email, password }));
  }
  if (account) return <div className="auth-form-stack">
    <div className="auth-notice"><Icon name="check" /><span>You are signed in as {account.name} ({roleLabels[account.role]}).</span></div>
    <Link className="button button-primary" href={account.role === "guest" && next ? next : roleRoutes[account.role]}>{account.role === "guest" && next ? "Continue booking" : "Go to dashboard"} <Icon name="arrow" /></Link>
    <button className="button button-soft" onClick={() => { signOut(); setError(""); }}>Sign out and switch account</button>
  </div>;
  return <div className="auth-form-stack">
    <form className="auth-form-stack" onSubmit={submit} aria-busy={busy}>
      {register && <label className="auth-field"><span>Full name</span><input name="name" autoComplete="name" minLength={2} required /></label>}
      <label className="auth-field"><span>Email address</span><input type="email" name="email" autoComplete="username" placeholder="you@example.com" required /></label>
      <PasswordField autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : undefined} />
      {register && <><p className="field-hint">Enter your first and last name, and use at least eight characters for your password.</p><PasswordField label="Confirm password" name="confirmPassword" autoComplete="new-password" minLength={8} /></>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={busy || account === undefined} className="button button-primary auth-submit" type="submit">{busy ? "Please wait…" : register ? "Create guest account" : "Sign in"}<Icon name="arrow" /></button>
    </form>
    <p className="auth-switch">{register ? "Already have an account?" : "New to Guestly?"} <Link href={`${register ? "/login" : "/register"}${nextQuery}`}>{register ? "Sign in" : "Create guest account"}</Link></p>
  </div>;
}
