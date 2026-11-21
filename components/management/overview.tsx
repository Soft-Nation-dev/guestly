"use client";

import Link from "@/components/navigation/app-link";
import { DatasetOverview } from "@/components/dataset/overview";
import { Icon } from "@/components/ui/icon";

export function ManagerOverview() {
  return <div className="staff-overview">
    <DatasetOverview />
    <section className="panel management-panel">
      <h2>Operational tools</h2>
      <p className="muted">Live KPIs above come from the backend&apos;s complete records, not the first page of locally loaded bookings. Historical records are reported separately.</p>
      <div className="management-stat"><Link href="/manager/bookings">Live bookings, verified payments and source booking records <Icon name="arrow" /></Link></div>
      <div className="management-stat"><Link href="/manager/services">Live service requests and historical service data <Icon name="arrow" /></Link></div>
      <div className="management-stat"><Link href="/manager/loyalty">Verified loyalty awards and rule history <Icon name="arrow" /></Link></div>
      <div className="management-stat"><Link href="/manager/rooms">Room inventory management <Icon name="arrow" /></Link></div>
    </section>
  </div>;
}
