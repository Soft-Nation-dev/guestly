"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAccounts, useAuth } from "@/hooks/use-auth";
import { refreshBackendTeam } from "@/services/backend-auth";
import { provisionTeamAccount, updateTeamAccess } from "@/services/auth";
import { roleLabels, type Account, type TeamRole } from "@/types/auth";
import { PasswordField } from "@/components/auth/password-field";
import { Icon } from "@/components/ui/icon";

function ProvisionForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const role = values.get("role") === "manager" ? "manager" : "staff";
      const account = await provisionTeamAccount({ name: String(values.get("name") ?? ""), email: String(values.get("email") ?? ""), password: String(values.get("password") ?? ""), role });
      form.reset();
      setSuccess(`${roleLabels[account.role]} account created for ${account.name}.`);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to create account.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="panel team-panel">
    <div><span className="eyebrow">Account provisioning</span><h2>Create team account</h2><p className="muted">Create access for a staff member or manager.</p></div>
    <form className="auth-form-stack" onSubmit={submit} aria-busy={busy}>
      <label className="auth-field"><span>Full name</span><input name="name" minLength={2} maxLength={100} required /></label>
      <label className="auth-field"><span>Email address</span><input name="email" type="email" maxLength={254} required /></label>
      <label className="auth-field"><span>Role</span><select name="role"><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
      <PasswordField label="Password" autoComplete="new-password" minLength={8} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      {success && <p className="auth-notice" role="status"><Icon name="check" />{success}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  </section>;
}

function AccessEditor({ account, close, saved }: { account: Account; close: () => void; saved: () => void }) {
  const [role, setRole] = useState<TeamRole>(account.role === "manager" ? "manager" : "staff");
  const [active, setActive] = useState(account.active);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const changed = role !== account.role || active !== account.active;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await updateTeamAccess(account.id, { role, active });
      saved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to update account.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-access-editor" onSubmit={submit}>
    <div className="admin-editor-fields">
      <label className="auth-field"><span>Access role</span><select value={role} onChange={event => setRole(event.target.value as TeamRole)}><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
      <label className="auth-field"><span>Account status</span><select value={active ? "active" : "inactive"} onChange={event => setActive(event.target.value === "active")}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
    </div>
    <p className="muted">Saving a change ends existing sessions for this account. Inactive accounts cannot sign in.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <div className="experience-actions"><button className="button button-primary" type="submit" disabled={!changed || busy}>{busy ? "Saving…" : "Save changes"}</button><button className="button button-soft" type="button" onClick={close}>Cancel</button></div>
  </form>;
}

function TeamDirectory({ accounts }: { accounts: Account[] }) {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const visible = accounts.filter(account => (role === "all" || account.role === role) && (status === "all" || account.active === (status === "active")) && `${account.name} ${account.email}`.toLowerCase().includes(search.trim().toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  const reset = () => { setSearch(""); setRole("all"); setStatus("all"); setEditing(null); };

  return <section className="panel team-panel">
    <div><span className="eyebrow">Access management</span><h2>Staff &amp; managers</h2><p className="muted">Manage who can access hotel operations.</p></div>
    <div className="admin-filters">
      <label className="auth-field"><span>Search accounts</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setEditing(null); }} placeholder="Name or email address" /></label>
      <div className="admin-editor-fields">
        <label className="auth-field"><span>Role</span><select value={role} onChange={event => { setRole(event.target.value); setEditing(null); }}><option value="all">All roles</option><option value="staff">Staff</option><option value="manager">Manager</option></select></label>
        <label className="auth-field"><span>Status</span><select value={status} onChange={event => { setStatus(event.target.value); setEditing(null); }}><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
      </div>
      <div className="staff-section-heading"><span className="muted" role="status">{visible.length} of {accounts.length} accounts</span><button className="text-link" onClick={reset}>Reset filters</button></div>
    </div>
    {notice && <p className="auth-notice" role="status"><Icon name="check" />{notice}</p>}
    <div className="team-list">{visible.map(account => <article className="admin-account" key={account.id}>
      <div className="admin-account-main"><span className="team-avatar"><Icon name="user" /></span><div className="admin-account-details"><strong>{account.name}</strong><p>{account.email}</p><div className="admin-account-tags"><span className="role-pill">{roleLabels[account.role]}</span><span className={`experience-status ${account.active ? "status-approved" : "status-rejected"}`}>{account.active ? "Active" : "Inactive"}</span></div></div><button className="button button-soft" aria-expanded={editing === account.id} onClick={() => { setEditing(editing === account.id ? null : account.id); setNotice(""); }}>Manage</button></div>
      {editing === account.id && <AccessEditor key={account.id} account={account} close={() => setEditing(null)} saved={() => { setEditing(null); setNotice(`Access updated for ${account.name}.`); }} />}
    </article>)}</div>
    {!visible.length && <p className="staff-empty">No matching team accounts.</p>}
  </section>;
}

export function TeamAccounts() {
  const session = useAuth();
  const accounts = useAccounts().filter(account => account.role === "staff" || account.role === "manager");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    if (session?.role !== "admin") return;
    let current = true;
    void refreshBackendTeam().catch(error => {
      if (current) setLoadError(error instanceof Error ? error.message : "Unable to load team accounts.");
    }).finally(() => {
      if (current) setLoading(false);
    });
    return () => { current = false; };
  }, [session?.id, session?.role]);
  const metrics = [{ label: "Team accounts", value: accounts.length, icon: "people" }, { label: "Active staff", value: accounts.filter(item => item.active && item.role === "staff").length, icon: "user" }, { label: "Active managers", value: accounts.filter(item => item.active && item.role === "manager").length, icon: "chart" }, { label: "Inactive accounts", value: accounts.filter(item => !item.active).length, icon: "shield" }] as const;
  return <section className="workspace-section">
    <div><span className="eyebrow">Administration</span><h2>Team access management</h2><p className="muted">Provision staff and managers and control their access to Guestly.</p></div>
    {loading && <p role="status">Loading team accounts…</p>}
    {loadError && <p className="auth-error" role="alert">{loadError}</p>}
    <div className="staff-metrics">{metrics.map(item => <div className="panel staff-metric" key={item.label}><div><span>{item.label}</span><Icon name={item.icon} /></div><strong>{item.value}</strong></div>)}</div>
    <div className="team-grid admin-team-grid"><ProvisionForm /><TeamDirectory accounts={accounts} /></div>
    <p className="auth-disclaimer"><Icon name="info" />Guest registration is independent of team access. The super-admin account is protected from changes in this workspace.</p>
  </section>;
}
