'use client';

import { useState, type FormEvent, type ChangeEvent } from 'react';
import Image from '@/components/ui/hotel-image';
import { roomImages } from '@/data/hotel';
import { useHotelProfile } from '@/hooks/use-management';
import { saveBackendHotel, uploadRoomPhoto } from '@/services/backend-rooms';

export function HotelManagement() {
  const { hotel, error: loadError } = useHotelProfile();
  const [editing, setEditing] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const chosenImage = image ?? hotel.heroImage;

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type) || selected.size > 2 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 2 MB.');
      return;
    }
    if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
    setImage(URL.createObjectURL(selected));
    setFile(selected);
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const heroImage = file ? (await uploadRoomPhoto(file)).url : chosenImage;
      await saveBackendHotel({
        name: String(data.get('name') ?? ''),
        tagline: String(data.get('tagline') ?? ''),
        description: String(data.get('description') ?? ''),
        location: String(data.get('location') ?? ''),
        heroImage,
      });
      if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
      setImage(null);
      setFile(null);
      setEditing(false);
      setNotice('Hotel details updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update hotel details.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (image?.startsWith('blob:')) URL.revokeObjectURL(image);
    setImage(null);
    setFile(null);
    setEditing(false);
    setError('');
  }

  return <section className="panel management-panel">
    <div className="staff-section-heading"><div><span className="eyebrow">Hotel profile</span><h2>{hotel.name}</h2><p className="muted">{hotel.location} · NGN</p></div><button type="button" className="button button-soft" onClick={() => editing ? close() : setEditing(true)}>{editing ? 'Cancel' : 'Edit hotel'}</button></div>
    {loadError && <p className="auth-error" role="alert">{loadError}</p>}
    {notice && <p className="auth-notice" role="status">{notice}</p>}
    {editing && <form className="experience-form" onSubmit={submit} aria-busy={busy}>
      <div className="management-form-grid">
        <label className="auth-field"><span>Hotel name</span><input name="name" defaultValue={hotel.name} minLength={2} maxLength={80} required /></label>
        <label className="auth-field"><span>Location</span><input name="location" defaultValue={hotel.location} minLength={2} maxLength={160} required /></label>
      </div>
      <label className="auth-field"><span>Tagline</span><input name="tagline" defaultValue={hotel.tagline} minLength={2} maxLength={160} required /></label>
      <label className="auth-field"><span>Description</span><textarea name="description" defaultValue={hotel.description} minLength={2} maxLength={1200} rows={3} required /></label>
      <div className="management-form-grid">
        <div className="management-image"><Image src={chosenImage} alt="Hotel image preview" fill unoptimized={chosenImage.startsWith('blob:')} sizes="280px" /></div>
        <div className="experience-form">
          <label className="auth-field"><span>Original hotel image</span><select value={roomImages.includes(chosenImage) ? chosenImage : ''} onChange={event => { if (event.target.value) { if (image?.startsWith('blob:')) URL.revokeObjectURL(image); setImage(event.target.value); setFile(null); } }}><option value="" disabled>Custom photo</option>{roomImages.map(path => <option value={path} key={path}>{path.split('/').pop()?.replace('.jpg', '').replaceAll('-', ' ')}</option>)}</select></label>
          <label className="auth-field"><span>Upload photo (max 2 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /></label>
        </div>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save hotel details'}</button>
    </form>}
  </section>;
}
