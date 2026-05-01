'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/VillaForm.tsx                      ║
// ║  Shared form cho Add + Edit villa                           ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition } from 'react';
import { useRouter }    from 'next/navigation';
import { useToast }     from '@/components/Toast';
import AmenityManager   from '@/components/AmenityManager';
import ImageUploader    from '@/components/ImageUploader';
import { validateVilla, errorsToMap } from '@/lib/validators';
import { createVilla, updateVilla }   from '@/lib/services/villa.service';
import { CONFIG }       from '@/lib/config';
import { randomVillaEmoji } from '@/lib/utils';
import type { Villa }   from '@/types/database';

interface VillaFormProps {
  /** Truyền vào khi edit, undefined khi add */
  villa?: Villa;
}

export default function VillaForm({ villa }: VillaFormProps) {
  const isEdit = !!villa;
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();

  // ── Form state ─────────────────────────────────────────────────
  const [name,        setName]        = useState(villa?.name        ?? '');
  const [province,    setProvince]    = useState(villa?.province    ?? '');
  const [district,    setDistrict]    = useState(villa?.district    ?? '');
  const [ward,        setWard]        = useState(villa?.ward        ?? '');
  const [street,      setStreet]      = useState(villa?.street      ?? '');
  const [bedrooms,    setBedrooms]    = useState(villa?.bedrooms    ?? 3);
  const [adults,      setAdults]      = useState(villa?.adults      ?? 6);
  const [children,    setChildren]    = useState(villa?.children    ?? 0);
  const [price,       setPrice]       = useState(villa?.price       ?? 3000000);
  const [description, setDescription] = useState(villa?.description ?? '');
  const [amenities,   setAmenities]   = useState<string[]>(villa?.amenities ?? []);
  const [images,      setImages]      = useState<string[]>(villa?.images    ?? []);
  const [emoji,       setEmoji]       = useState(villa?.emoji ?? randomVillaEmoji());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Address cascades ───────────────────────────────────────────
  const provinces  = Object.keys(CONFIG.ADDRESS_DATA);
  const districts  = province ? Object.keys(CONFIG.ADDRESS_DATA[province] ?? {}) : [];
  const wards      = (province && district)
    ? (CONFIG.ADDRESS_DATA[province]?.[district] ?? [])
    : [];

  function handleProvinceChange(p: string) {
    setProvince(p);
    setDistrict('');
    setWard('');
  }

  function handleDistrictChange(d: string) {
    setDistrict(d);
    setWard('');
  }

  // ── Submit ─────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const errs = validateVilla({ name, province, district, price, bedrooms, adults });
    if (errs.length) { setFieldErrors(errorsToMap(errs)); return; }

    const input = {
      name: name.trim(), province, district,
      ward: ward || undefined, street: street.trim() || undefined,
      bedrooms: Number(bedrooms), adults: Number(adults),
      children: Number(children), price: Number(price),
      amenities: JSON.stringify(amenities), description: description.trim() || undefined,
      images: JSON.stringify(images), emoji,
    };

    startTransition(async () => {
      const result = isEdit
        ? await updateVilla(villa!.id, input)
        : await createVilla(input);

      if (result.error) {
        show('error', isEdit ? 'Cập nhật thất bại' : 'Thêm villa thất bại', result.error);
        return;
      }

      show('success',
        isEdit ? '✅ Đã cập nhật villa' : '✅ Đã thêm villa mới',
        result.data?.name
      );
      router.push('/owner/villas');
      router.refresh();
    });
  }

  const fe = fieldErrors;

  return (
    <form onSubmit={handleSubmit} className="villa-form">
      {/* ── Thông tin cơ bản ─────────────────────────────────── */}
      <section className="form-section">
        <h3 className="form-section-title">📋 Thông tin cơ bản</h3>

        <div className="form-row">
          <div className="field-group" style={{ flex: 1 }}>
            <label>Tên villa *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Villa Xuân Quỳnh" disabled={isPending} />
            {fe.name && <span className="field-error">{fe.name}</span>}
          </div>
          <div className="field-group" style={{ width: 100 }}>
            <label>Emoji</label>
            <select value={emoji} onChange={e => setEmoji(e.target.value)} disabled={isPending}>
              {CONFIG.VILLA_EMOJIS.map(em => (
                <option key={em} value={em}>{em}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field-group">
          <label>Mô tả</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Mô tả ngắn về villa..."
            rows={3}
            disabled={isPending}
            style={{ resize: 'vertical' }}
          />
        </div>
      </section>

      {/* ── Địa chỉ ──────────────────────────────────────────── */}
      <section className="form-section">
        <h3 className="form-section-title">📍 Địa chỉ</h3>

        <div className="form-row">
          <div className="field-group" style={{ flex: 1 }}>
            <label>Tỉnh / Thành phố *</label>
            <select value={province} onChange={e => handleProvinceChange(e.target.value)} disabled={isPending}>
              <option value="">-- Chọn tỉnh --</option>
              {provinces.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            {fe.province && <span className="field-error">{fe.province}</span>}
          </div>
          <div className="field-group" style={{ flex: 1 }}>
            <label>Quận / Huyện *</label>
            <select value={district} onChange={e => handleDistrictChange(e.target.value)} disabled={isPending || !province}>
              <option value="">-- Chọn quận --</option>
              {districts.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            {fe.district && <span className="field-error">{fe.district}</span>}
          </div>
        </div>

        <div className="form-row">
          <div className="field-group" style={{ flex: 1 }}>
            <label>Phường / Xã</label>
            <select value={ward} onChange={e => setWard(e.target.value)} disabled={isPending || !district}>
              <option value="">-- Chọn phường --</option>
              {wards.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="field-group" style={{ flex: 2 }}>
            <label>Số nhà, tên đường</label>
            <input value={street} onChange={e => setStreet(e.target.value)}
              placeholder="270 Đoàn Khuê" disabled={isPending} />
          </div>
        </div>
      </section>

      {/* ── Sức chứa & Giá ───────────────────────────────────── */}
      <section className="form-section">
        <h3 className="form-section-title">👥 Sức chứa & Giá</h3>

        <div className="form-row">
          <div className="field-group">
            <label>Phòng ngủ *</label>
            <input type="number" min={1} max={50} value={bedrooms}
              onChange={e => setBedrooms(Number(e.target.value))} disabled={isPending} />
            {fe.bedrooms && <span className="field-error">{fe.bedrooms}</span>}
          </div>
          <div className="field-group">
            <label>Người lớn *</label>
            <input type="number" min={1} max={200} value={adults}
              onChange={e => setAdults(Number(e.target.value))} disabled={isPending} />
            {fe.adults && <span className="field-error">{fe.adults}</span>}
          </div>
          <div className="field-group">
            <label>Trẻ em</label>
            <input type="number" min={0} max={50} value={children}
              onChange={e => setChildren(Number(e.target.value))} disabled={isPending} />
          </div>
          <div className="field-group" style={{ flex: 2 }}>
            <label>Giá / đêm (VNĐ) *</label>
            <input type="number" min={100000} step={100000} value={price}
              onChange={e => setPrice(Number(e.target.value))} disabled={isPending} />
            {fe.price && <span className="field-error">{fe.price}</span>}
          </div>
        </div>
      </section>

      {/* ── Tiện ích ─────────────────────────────────────────── */}
      <section className="form-section">
        <h3 className="form-section-title">✨ Tiện ích</h3>
        <AmenityManager value={amenities} onChange={setAmenities} disabled={isPending} />
      </section>

      {/* ── Ảnh ──────────────────────────────────────────────── */}
      <section className="form-section">
        <h3 className="form-section-title">📸 Hình ảnh</h3>
        <ImageUploader value={images} onChange={setImages} disabled={isPending} />
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <div className="form-footer">
        <button type="button" className="btn-secondary"
          onClick={() => router.back()} disabled={isPending}>
          Hủy
        </button>
        <button type="submit" className="btn-primary" disabled={isPending}>
          {isPending
            ? (isEdit ? 'Đang lưu...' : 'Đang thêm...')
            : (isEdit ? '💾 Lưu thay đổi' : '+ Thêm villa')}
        </button>
      </div>

      <style>{`
        .villa-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 860px;
        }

        .form-section {
          background:    var(--white);
          border-radius: var(--radius-lg);
          border:        1px solid rgba(180,212,195,.3);
          box-shadow:    var(--shadow-sm);
          padding:       20px 24px;
          display:       flex;
          flex-direction: column;
          gap:           16px;
        }

        .form-section-title {
          font-size:     0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color:         var(--forest);
          font-family:   var(--font-body);
          font-weight:   700;
          margin-bottom: 4px;
          padding-bottom: 10px;
          border-bottom: 1px solid var(--sage-pale);
        }

        .form-row {
          display:   flex;
          gap:       12px;
          flex-wrap: wrap;
        }

        .form-row .field-group { flex: 1; min-width: 120px; }

        .field-error {
          font-size:  0.78rem;
          color:      var(--red);
          margin-top: 3px;
          display:    block;
        }

        .form-footer {
          display:         flex;
          justify-content: flex-end;
          gap:             10px;
          padding-top:     8px;
        }

        textarea {
          width:         100%;
          padding:       10px 14px;
          border:        1.5px solid var(--stone);
          border-radius: var(--radius-md);
          font-family:   var(--font-body);
          font-size:     0.95rem;
          color:         var(--ink);
          background:    var(--white);
          outline:       none;
          transition:    border-color .15s, box-shadow .15s;
        }

        textarea:focus {
          border-color: var(--sage);
          box-shadow:   0 0 0 3px rgba(122,171,143,.2);
        }
      `}</style>
    </form>
  );
}
