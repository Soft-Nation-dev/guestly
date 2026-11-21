"use client";

import { useState, type FormEvent } from "react";
import { DatasetServiceStats } from "@/components/dataset/overview";
import { RecordedServices } from "@/components/dataset/recorded-services";
import { useManagement } from "@/hooks/use-management";
import { useExperience } from "@/hooks/use-experience";
import { saveService } from "@/services/management";
import { useLiveCatalogue } from "@/hooks/use-services";
import { serviceMetrics } from "@/lib/management";
import { Icon } from "@/components/ui/icon";
import type { ServiceCategory } from "@/types/management";

function ServiceEditor({ service, close }: { service?: ServiceCategory; close: () => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await saveService({ name: String(values.get("name")), description: String(values.get("description")), active: values.has("active") }, service?.id);
      close();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save service."); }
    finally { setBusy(false); }
  }
  return <form className="panel experience-form" onSubmit={event => void submit(event)} aria-busy={busy}><div className="staff-section-heading"><h2>{service ? "Edit service" : "Add service"}</h2><button type="button" className="text-link" onClick={close}>Cancel</button></div><label className="auth-field"><span>Service name</span><input name="name" required maxLength={60} defaultValue={service?.name} /></label><label className="auth-field"><span>Description</span><textarea name="description" required maxLength={300} defaultValue={service?.description} /></label><label className="management-check"><input name="active" type="checkbox" defaultChecked={service?.active ?? true} /> Available for guest requests</label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button button-primary" type="submit" disabled={busy}>{busy ? "Saving service…" : "Save service"}</button></form>;
}

export function ServiceManagement() {
  const { services } = useManagement();
  const catalogue = useLiveCatalogue();
  const { requests } = useExperience();
  const metrics = serviceMetrics(requests);
  const [editing, setEditing] = useState<string | null>(null);
  const categories = [...new Set([...services.map(item => item.name), ...requests.map(item => item.category)])];
  return <section className="workspace-section">
    <div><span className="eyebrow">Hotel performance</span><h2>Services &amp; performance</h2><p className="muted">Monitor service delivery and manage the request catalogue.</p></div>
    <DatasetServiceStats />
    {catalogue.loading && <p role="status">Loading service catalogue…</p>}
    {catalogue.error && <p role="alert" className="auth-error">{catalogue.error}</p>}
    <div className="staff-metrics">{[{ title: "Total requests", value: metrics.total }, { title: "Completed", value: metrics.done }, { title: "Completion rate", value: metrics.completion === null ? "—" : `${metrics.completion}%` }, { title: "Avg. completion time", value: metrics.averageMinutes === null ? "—" : `${metrics.averageMinutes}m` }].map(item => <div className="panel staff-metric" key={item.title}><div>{item.title}</div><strong>{item.value}</strong></div>)}</div>
    <section className="panel management-panel"><h3>Performance by service</h3>{categories.map(name => { const stats = serviceMetrics(requests.filter(item => item.category === name)); return <div className="management-stat" key={name}><div><strong>{name}</strong><p className="muted">{stats.received} received · {stats.inProgress} in progress</p></div><span>{stats.done}/{stats.total} done</span></div>; })}</section>
    <div className="staff-snapshot-heading"><h2>Service catalogue</h2><button className="button button-primary" onClick={() => setEditing("new")}>Add service <Icon name="arrow" /></button></div>
    {editing === "new" && <ServiceEditor key="new" close={() => setEditing(null)} />}
    <div className="workspace-grid">{services.map(item => <article className="panel management-panel" key={item.id}><div className="booking-card-heading"><h3>{item.name}</h3><span className={`experience-status ${item.active ? "status-approved" : "status-pending"}`}>{item.active ? "Available" : "Unavailable"}</span></div><p className="muted">{item.description}</p><button className="button button-soft" aria-expanded={editing === item.id} onClick={() => setEditing(editing === item.id ? null : item.id)}>Edit service</button>{editing === item.id && <div className="management-inline-editor"><ServiceEditor key={item.id} service={item} close={() => setEditing(null)} /></div>}</article>)}</div>
    <RecordedServices />
  </section>;
}
