"use client";

import Image from "@/components/ui/hotel-image";
import Link from "@/components/navigation/app-link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { RoomCard } from "@/components/public/room-card";
import { StaySearch } from "@/components/public/stay-search";
import { useManagement, useRoomCatalogue } from "@/hooks/use-management";
import { bookingQuery, readStay } from "@/lib/booking-query";
import { formatMoney, localDate, stayNights } from "@/lib/format";
import { getRoom } from "@/services/rooms";
import { fetchRoomAvailability, refreshRooms, type LiveRoom } from "@/services/backend-rooms";
import type { Room, StaySearch as Search } from "@/types/hotel";

const categories = ["All", "Standard", "Deluxe", "Executive"] as const;

function RoomDetail({ room, stay, back, liveAvailability, checking, availabilityError }: {
  room: Room;
  stay?: Search;
  back: string;
  liveAvailability: LiveRoom[] | null;
  checking: boolean;
  availabilityError: string;
}) {
  const nights = stay ? stayNights(stay.checkIn, stay.checkOut) : 0;
  const quantity = liveAvailability?.find(item => item.id === room.id)?.availableInventory ?? 0;
  const available = stay && stay.checkIn >= localDate() && stay.guests <= room.capacity &&
    quantity > 0;

  return <div className="detail-page">
    <Link className="text-link" href={back}><Icon name="back" /> All rooms</Link>
    <div className="page-heading"><span className="eyebrow">{room.category} · {room.view}</span><h1>{room.name}</h1><p>{room.description}</p></div>
    <div className="detail-grid">
      <div className="detail-main">
        <div className="detail-photo"><Image src={room.image} alt={room.name} fill sizes="(max-width: 800px) 100vw, 60vw" unoptimized={room.image.startsWith("data:")} priority /></div>
        <section className="panel detail-info"><h2>About this room</h2>
          <div className="room-meta"><span><Icon name="bed" />{room.bed}</span><span><Icon name="people" />Up to {room.capacity} guests</span><span>{room.size} m²</span></div>
          <div className="detail-amenities">{room.amenities.map(amenity => <span key={amenity}><Icon name="check" />{amenity}</span>)}</div>
        </section>
      </div>
      <aside className="panel detail-booking">
        <span className="eyebrow">Plan your stay</span><h2><span className="price">{formatMoney(room.nightlyRate)}</span> <small>/ night</small></h2>
        <StaySearch key={JSON.stringify(stay)} initial={stay} roomId={room.id} />
        {stay && <div className="availability-result" role="status">
          {checking ? <p>Checking live room availability…</p> :
          availabilityError ? <p className="form-error">{availabilityError}</p> :
          available ? <><span className="availability-label"><Icon name="check" /> Available for your dates{" · " + quantity + " remaining"}</span>
            <div className="estimate"><span>{nights} {nights === 1 ? "night" : "nights"}</span><strong>{formatMoney(room.nightlyRate * nights)}</strong></div>
            <Link className="button button-primary" href={"/checkout?" + bookingQuery({ ...stay, roomId: room.id })}>Reserve room <Icon name="arrow" /></Link></> :
            <p className="form-error">This room does not accommodate your selected stay. Try other dates or fewer guests.</p>}
        </div>}
      </aside>
    </div>
  </div>;
}

export function RoomBrowser() {
  const params = useSearchParams();
  const { rooms } = useManagement();
  const catalogue = useRoomCatalogue();
  const [category, setCategory] = useState<(typeof categories)[number]>("All");
  const [sort, setSort] = useState("recommended");
  const [availability, setAvailability] = useState<{ key: string; items: LiveRoom[] } | null>(null);
  const [availabilityFailure, setAvailabilityFailure] = useState<{ key: string; message: string } | null>(null);
  const checkIn = params.get("checkIn") ?? "";
  const checkOut = params.get("checkOut") ?? "";
  const nights = stayNights(checkIn, checkOut);
  const requestedStay = readStay(params);
  const stay = requestedStay && requestedStay.checkIn >= localDate() ? requestedStay : undefined;
  const searchKey = stay ? [stay.checkIn, stay.checkOut, stay.guests].join("|") : "";
  const currentAvailability = availability?.key === searchKey ? availability.items : null;
  const availabilityError = availabilityFailure?.key === searchKey ? availabilityFailure.message : "";
  const roomId = params.get("room");
  const query = new URLSearchParams();
  if (stay) Object.entries(stay).forEach(([key, value]) => query.set(key, String(value)));
  const queryString = query.toString();
  const back = queryString ? "/rooms?" + queryString : "/rooms";
  const room = roomId ? getRoom(roomId, rooms) : undefined;

  useEffect(() => {
    if (!searchKey) return;
    const [from, to, guestCount] = searchKey.split("|");
    const controller = new AbortController();
    void fetchRoomAvailability({ checkIn: from, checkOut: to, guests: Number(guestCount) }, controller.signal)
      .then(items => { if (!controller.signal.aborted) setAvailability({ key: searchKey, items }); })
      .catch(error => {
        if (!controller.signal.aborted) setAvailabilityFailure({ key: searchKey, message: error instanceof Error ? error.message : "Unable to check availability." });
      });
    return () => controller.abort();
  }, [searchKey]);

  if (!catalogue.loaded && !catalogue.error) {
    return <div className="panel empty-state"><Icon name="bed" /><h1>Rooms &amp; suites</h1><p role="status">Loading hotel rooms…</p></div>;
  }

  if (catalogue.error) {
    return <div className="panel empty-state"><Icon name="bed" /><h1>Rooms unavailable</h1><p role="alert">{catalogue.error}</p><button className="button button-soft" onClick={() => void refreshRooms(true).catch(() => {})}>Try again</button></div>;
  }

  if (room) return <RoomDetail room={room} stay={stay} back={back}
    liveAvailability={currentAvailability} checking={Boolean(stay) && !currentAvailability && !availabilityError}
    availabilityError={availabilityError} />;

  const source = stay ? (currentAvailability ?? []) : rooms;
  const matches = source.filter(item => category === "All" || item.category === category);
  const results = [...matches].sort((a, b) => sort === "price-low" ? a.nightlyRate - b.nightlyRate : sort === "price-high" ? b.nightlyRate - a.nightlyRate : 0);
  return <>
    <div className="page-heading"><span className="eyebrow">Stay at Guestly</span><h1>Rooms &amp; suites</h1><p>Find a space to make your own, with the comforts that matter most.</p></div>
    {roomId && <p className="form-error" role="alert">We could not find that room. Explore our available rooms below.</p>}
    <section className="panel search-panel" aria-label="Find rooms"><StaySearch key={queryString} initial={stay} /></section>
    {!!(checkIn || checkOut) && !stay && <p className="form-error" role="alert">Enter valid dates and guest count to check availability.</p>}
    {stay && !currentAvailability && !availabilityError && <p role="status">Checking live availability…</p>}
    {availabilityError && <p className="form-error" role="alert">{availabilityError}</p>}
    <div className="results-toolbar">
      <div className="filter-tabs" aria-label="Room categories">{categories.map(item => <button type="button" key={item} aria-pressed={category === item} className={category === item ? "filter-active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <label className="sort-field"><span>Sort by</span><select value={sort} onChange={event => setSort(event.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
    </div>
    <div className="results-heading"><p role="status">{results.length} {results.length === 1 ? "room type" : "room types"} {stay ? "available" : "to explore"}{stay && " · " + nights + " " + (nights === 1 ? "night" : "nights")}</p>{stay && <Link className="text-link" href="/rooms">Clear dates</Link>}</div>
    {results.length ? <div className="room-grid">{results.map(item => <RoomCard key={item.id} room={item} query={queryString} nights={stay ? nights : 0} />)}</div> :
      <div className="panel empty-state"><Icon name="bed" width={32} height={32} /><h2>No matching rooms</h2><p>Try a different date, guest count or room category.</p><button type="button" className="button button-soft" onClick={() => { setCategory("All"); setSort("recommended"); }}>Reset filters</button></div>}
  </>;
}
