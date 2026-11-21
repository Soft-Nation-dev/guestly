"use client";

import Image from "@/components/ui/hotel-image";
import { useState, type FormEvent, type ChangeEvent } from "react";
import { roomImages } from "@/data/hotel";
import { uploadRoomPhoto } from "@/services/backend-rooms";
import { useRoomCatalogue } from "@/hooks/use-management";
import { HotelManagement } from "@/components/management/hotel-management";
import { useManagement } from "@/hooks/use-management";
import { saveRoom } from "@/services/management";
import { formatMoney } from "@/lib/format";
import { Icon } from "@/components/ui/icon";
import type { Room, RoomCategory } from "@/types/hotel";

function RoomEditor({ room, onClose }: { room?: Room; onClose: () => void }) {
  const [image, setImage] = useState(room?.image ?? roomImages[0]);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    const maxSize = 2 * 1024 * 1024;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > maxSize) { setError("Choose a JPEG, PNG or WebP image under 2 MB."); return; }
    setFile(file);
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => { setImage(String(reader.result)); setReading(false); };
    reader.onerror = () => { setError("Unable to read this image."); setReading(false); };
    reader.readAsDataURL(file);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "");
    try {
      const storedImage = file ? (await uploadRoomPhoto(file)).url : image;
      await saveRoom({ name: value("name"), category: value("category") as RoomCategory, image: storedImage, nightlyRate: Number(value("nightlyRate")), capacity: Number(value("capacity")), size: Number(value("size")), bed: value("bed"), view: value("view"), amenities: value("amenities").split(",").map(item => item.trim()).filter(Boolean), description: value("description"), inventory: Number(value("inventory")), featured: data.has("featured") }, room?.id);
      onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save room."); }
    finally { setBusy(false); }
  }
  return <form className="panel experience-form" onSubmit={submit}>
    <div className="staff-section-heading"><h2>{room ? "Edit room type" : "Add room type"}</h2><button type="button" className="text-link" onClick={onClose}>Cancel</button></div>
    <div className="management-form-grid">
      <label className="auth-field"><span>Room name</span><input name="name" required maxLength={80} defaultValue={room?.name} /></label>
      <label className="auth-field"><span>Category</span><select name="category" defaultValue={room?.category ?? "Standard"}>{["Standard", "Deluxe", "Executive"].map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="auth-field"><span>Nightly price (₦)</span><input type="number" name="nightlyRate" min={1} max={100000000} required defaultValue={room?.nightlyRate} /></label>
      <label className="auth-field"><span>Total room inventory</span><input type="number" name="inventory" min={0} max={1000} required defaultValue={room?.inventory ?? 1} /></label>
      <label className="auth-field"><span>Guest capacity</span><select name="capacity" defaultValue={room?.capacity ?? 2}>{[1,2,3].map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="auth-field"><span>Room size (m²)</span><input type="number" name="size" min={1} step="0.1" required defaultValue={room?.size} /></label>
      <label className="auth-field"><span>Bed type</span><input name="bed" required defaultValue={room?.bed} /></label>
      <label className="auth-field"><span>View</span><input name="view" required defaultValue={room?.view} /></label>
    </div>
    <label className="auth-field"><span>Amenities (comma separated)</span><input name="amenities" defaultValue={room?.amenities.join(", ")} /></label>
    <label className="auth-field"><span>Description</span><textarea name="description" required rows={3} defaultValue={room?.description} /></label>
    <div className="management-form-grid"><div className="management-image"><Image src={image} alt="Room photo preview" fill sizes="280px" unoptimized={image.startsWith("data:")} /></div><div className="experience-form"><label className="auth-field"><span>Original hotel image</span><select value={roomImages.includes(image) ? image : ""} onChange={event => { if(event.target.value) { setImage(event.target.value); setFile(null); } }}><option value="" disabled>Uploaded photo</option>{roomImages.map(path => <option key={path} value={path}>{path.split("/").pop()?.replace(".jpg", "").replaceAll("-", " ")}</option>)}</select></label><label className="auth-field"><span>Upload photo (max 2 MB)</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} /></label></div></div>
    <label className="management-check"><input name="featured" type="checkbox" defaultChecked={room?.featured} /> Feature on homepage</label>
    <p className="muted">Set inventory to zero to stop new bookings, if no confirmed future reservations require the room.</p>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button button-primary" disabled={reading || busy} type="submit">{busy ? "Saving…" : "Save room"}</button>
  </form>;
}

export function RoomManagement() {
  const { rooms } = useManagement();
  const catalogue = useRoomCatalogue();
  const [editing, setEditing] = useState<string | null>(null);
  return <section className="workspace-section">
    <div className="staff-snapshot-heading"><div><span className="eyebrow">Hotel configuration</span><h2>Room management</h2><p className="muted">Manage room types, prices, photos and inventory.</p></div><button className="button button-primary" onClick={() => setEditing("new")}>Add room type <Icon name="arrow" /></button></div>
    <HotelManagement />
    {!catalogue.loaded && !catalogue.error && <p role="status">Loading managed room types…</p>}
    {catalogue.error && <p className="auth-error" role="alert">{catalogue.error}</p>}
    {editing === "new" && <RoomEditor key="new" onClose={() => setEditing(null)} />}
    <div className="room-grid">{rooms.map(room => <article className="panel management-panel" key={room.id}><div className="management-image"><Image src={room.image} alt={room.name} fill sizes="(max-width:760px) 100vw,33vw" unoptimized={room.image.startsWith("data:")} /></div><div className="booking-card-heading"><h3>{room.name}</h3><span className="role-pill">{room.inventory ? "Listed" : "Unavailable"}</span></div><p className="muted">{room.category} · {room.capacity} guests · {room.inventory} rooms</p><strong className="price">{formatMoney(room.nightlyRate)} <small className="muted">/ night</small></strong><button className="button button-soft" aria-expanded={editing === room.id} onClick={() => setEditing(editing === room.id ? null : room.id)}>Edit room</button>{editing === room.id && <div className="management-inline-editor"><RoomEditor key={room.id} room={room} onClose={() => setEditing(null)} /></div>}</article>)}</div>
  </section>;
}
