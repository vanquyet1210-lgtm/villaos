'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.2 — app/owner/calendar/CalendarShell.tsx        ║
// ║  Client shell: villa selector, calendar, booking modal      ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition, useEffect } from 'react';
import { useRouter }           from 'next/navigation';
import Calendar                from '@/components/Calendar';
import { useBookingsRealtime } from '@/hooks/useBookingsRealtime';
import { useToast }            from '@/components/Toast';
import {
  createBooking, cancelBooking, confirmHold,
} from '@/lib/services/booking.service';
import { toggleLockDate } from '@/lib/services/villa.service';
import { fetchVillaBookingsAction } from '@/lib/cache/booking-cache-actions';
import {
  fmtMoney, formatDate, calcNights, calcTotal,
  todayISO, addDays,
} from '@/lib/utils';
import { validateBooking } from '@/lib/validators';
import type { Villa, Booking, UserRole } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────

interface CalendarShellProps {
  villas:          Villa[];
  initialVillaId:  string;
  userRole:        UserRole;
}

type ModalMode = 'create' | 'view';

interface BookingModal {
  mode:      ModalMode;
  checkin?:  string;
  checkout?: string;
  booking?:  Booking;
}

// ── Component ─────────────────────────────────────────────────────

export default function CalendarShell({ villas, initialVillaId, userRole }: CalendarShellProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();

  const [selectedVillaId, setSelectedVillaId] = useState(initialVillaId);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState<BookingModal | null>(null);
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);
  // Optimistic locked dates: update instantly without F5 (FIX 5)
  const [localLockedDates, setLocalLockedDates] = useState<string[] | null>(null);

  // ── Villa filter state ─────────────────────────────────────────
  const [showFilter,    setShowFilter]    = useState(false);
  const [filterSearch,  setFilterSearch]  = useState('');
  const [filterProvince,setFilterProvince] = useState('');
  const [filterBedrooms,setFilterBedrooms] = useState('');
  const [filterPrice,   setFilterPrice]   = useState('');
  const [filterAdults,  setFilterAdults]  = useState('');
  const [filterAmenity,  setFilterAmenity]  = useState<string[]>([]);
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterCheckin,  setFilterCheckin]  = useState('');
  const [filterCheckout, setFilterCheckout] = useState('');

  // Derived: danh sách province và district từ villas
  const provinces = Array.from(new Set(villas.map(v => v.province).filter(Boolean))).sort();
  const districts = Array.from(new Set(
    villas.filter(v => !filterProvince || v.province === filterProvince)
          .map(v => v.district).filter(Boolean)
  )).sort();
  const allAmenities = Array.from(new Set(villas.flatMap(v => v.amenities ?? []))).sort();

  // Filtered villas (kể cả filter ngày trống)
  const filteredVillas = villas.filter(v => {
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      if (!v.name.toLowerCase().includes(s) &&
          !(v.district ?? '').toLowerCase().includes(s) &&
          !(v.province ?? '').toLowerCase().includes(s)) return false;
    }
    if (filterProvince && v.province !== filterProvince) return false;
    if (filterDistrict && v.district !== filterDistrict) return false;
    if (filterBedrooms && v.bedrooms !== Number(filterBedrooms)) return false;
    if (filterAdults && v.adults < Number(filterAdults)) return false;
    if (filterPrice) {
      const [min, max] = filterPrice.split('-').map(Number);
      if (v.price < min) return false;
      if (max && v.price > max) return false;
    }
    if (filterAmenity.length > 0) {
      if (!filterAmenity.every(a => (v.amenities ?? []).includes(a))) return false;
    }
    return true;
  });

  const hasFilter = !!(filterSearch || filterProvince || filterDistrict || filterBedrooms || filterPrice || filterAdults || filterAmenity.length || filterCheckin || filterCheckout);

  function clearFilter() {
    setFilterSearch(''); setFilterProvince(''); setFilterDistrict('');
    setFilterBedrooms(''); setFilterPrice(''); setFilterAdults('');
    setFilterAmenity([]); setFilterCheckin(''); setFilterCheckout('');
  }

  const villa = villas.find(v => v.id === selectedVillaId) ?? filteredVillas[0] ?? villas[0];

  // Realtime bookings (merge server + realtime)
  const bookings = useBookingsRealtime(selectedVillaId, serverBookings);

  // Load bookings khi đổi villa
  useEffect(() => {
    if (!selectedVillaId) return;
    fetchVillaBookingsAction(selectedVillaId).then(data => setServerBookings(data));
  }, [selectedVillaId]);

  // ── Form state (create booking) ────────────────────────────────
  const [customer,  setCustomer]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [note,      setNote]      = useState('');
  const [bookStatus, setBookStatus] = useState<'confirmed' | 'hold'>('confirmed');
  const [checkin,   setCheckin]   = useState('');
  const [checkout,  setCheckout]  = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  function openCreateModal(dateStr: string) {
    const co = addDays(dateStr, 1);
    setCheckin(dateStr);
    setCheckout(co);
    setCustomer(''); setPhone(''); setEmail(''); setNote('');
    // Sale chỉ được tạo Hold, owner mặc định confirmed
    setBookStatus(userRole === 'sale' ? 'hold' : 'confirmed');
    setFormError(null);
    setModal({ mode: 'create', checkin: dateStr, checkout: co });
  }

  function openViewModal(booking: Booking) {
    setModal({ mode: 'view', booking });
  }

  function closeModal() { setModal(null); }

  // ── Day click handler ──────────────────────────────────────────
  function handleDayClick(ds: string, info: { bkId?: string; type?: string; status?: string; isLock?: boolean } | null) {
    // Checkout day hoặc locked-checkout: nửa phải trống → cho tạo booking mới
    const isCheckoutOnly = info?.type === 'checkout' || info?.type === 'locked-checkout';

    // ⚠️ Ngày có phần bị khóa (kể cả split) → owner mở khóa, sale cảnh báo
    if (info?.isLock) {
      if (userRole === 'owner' || userRole === 'admin') {
        // Owner click vào ngày có lock → mở modal (có nút Mở khóa)
        if (ds >= todayISO()) openCreateModal(ds);
      } else {
        show('warning', '🔒 Ngày bị khóa', 'Chủ nhà đã khóa ngày này. Không thể đặt phòng.');
      }
      return;
    }

    // ⚠️ Cảnh báo sớm nếu ngày đã có booking confirmed/hold (trừ checkout)
    if (info?.type === 'middle' || info?.type === 'checkin') {
      if (info.bkId) {
        const found = bookings.find(b => b.id === info.bkId);
        if (found) { openViewModal(found); return; }
      }
      const statusLabel = info.status === 'hold' ? 'Hold' : 'Confirmed';
      show('warning', `📅 Ngày đã có ${statusLabel}`, 'Ngày này đã được đặt. Vui lòng chọn ngày khác.');
      return;
    }

    if (!info || isCheckoutOnly) {
      if (ds >= todayISO()) openCreateModal(ds);
      return;
    }
    // checkout+checkin split: click opens the existing booking on left side
    if (info.bkId) {
      const found = bookings.find(b => b.id === info.bkId);
      if (found) { openViewModal(found); return; }
    }
    if (ds >= todayISO()) openCreateModal(ds);
  }

  // ── Create booking ─────────────────────────────────────────────
  async function handleLockDate(ds: string) {
    const current = localLockedDates ?? villa.lockedDates;
    const isLocked = current.includes(ds);
    const optimistic = isLocked ? current.filter((d: string) => d !== ds) : [...current, ds].sort();
    setLocalLockedDates(optimistic); // instant visual update

    startTransition(async () => {
      const result = await toggleLockDate(villa.id, ds);
      if (result.error) {
        show('error', '❌ Lỗi', result.error);
        setLocalLockedDates(current); // revert
      } else if (result.data) {
        setLocalLockedDates(result.data);
        show('success', isLocked ? '🔓 Đã mở khóa ngày' : '🔒 Đã khóa ngày', ds);
      }
    });
    closeModal();
  }

  function handleCreateBooking() {
    setFormError(null);
    const errs = validateBooking(
      { villaId: selectedVillaId, checkin, checkout, customer, phone },
      bookings, [{ id: villa.id, lockedDates: villa.lockedDates }],
      userRole,
    );
    if (errs.length) { setFormError(errs[0].msg); return; }

    startTransition(async () => {
      const total = calcTotal(checkin, checkout, villa.price);
      const result = await createBooking({
        villaId: selectedVillaId,
        customer: customer.trim(),
        phone, email,
        checkin, checkout,
        status: bookStatus,
        total, note,
      });

      if (result.error) { setFormError(result.error); return; }
      show('success', bookStatus === 'hold' ? '⏳ Đã tạo Hold' : '✅ Đã tạo Booking', `${customer} · ${formatDate(checkin)} → ${formatDate(checkout)}`);
      closeModal();
      router.refresh();
    });
  }

  // ── Confirm hold ───────────────────────────────────────────────
  function handleConfirm(id: string) {
    startTransition(async () => {
      const result = await confirmHold(id);
      if (result.error) { show('error', 'Lỗi', result.error); return; }
      show('success', '✅ Đã xác nhận booking');
      closeModal(); router.refresh();
    });
  }

  // ── Cancel booking ─────────────────────────────────────────────
  function handleCancel(id: string) {
    if (!confirm('Hủy booking này?')) return;
    startTransition(async () => {
      const result = await cancelBooking(id);
      if (result.error) { show('error', 'Lỗi', result.error); return; }
      show('info', 'Đã hủy booking');
      closeModal(); router.refresh();
    });
  }

  const nights = (checkin && checkout) ? calcNights(checkin, checkout) : 0;
  const total  = nights * villa.price;

  return (
    <div className="cal-shell">
      {/* Villa filter + selector */}
      {villas.length > 1 && (
        <div>
          {/* Filter bar */}
          <div className="villa-filter-bar">
            <input
              className="villa-filter-search"
              placeholder="🔍 Tìm nhanh theo tên, đường, địa chỉ..."
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
            />
            <button
              className={`villa-filter-toggle${showFilter ? ' active' : ''}`}
              onClick={() => setShowFilter(v => !v)}
            >
              {showFilter ? '▲ Ẩn bộ lọc' : '▼ Bộ lọc'}
              {hasFilter && <span className="filter-badge"> ●</span>}
            </button>
            {hasFilter && (
              <button className="villa-filter-clear" onClick={clearFilter}>✕ Xóa bộ lọc</button>
            )}
          </div>

          {/* Expanded filter panel */}
          {showFilter && (
            <div className="villa-filter-panel">
              <div className="filter-row">
                <div className="filter-field">
                  <label>Tỉnh / TP</label>
                  <select value={filterProvince} onChange={e => { setFilterProvince(e.target.value); setFilterDistrict(''); }}>
                    <option value="">Tất cả tỉnh</option>
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="filter-field">
                  <label>Quận / Huyện</label>
                  <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}>
                    <option value="">Tất cả quận</option>
                    {districts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="filter-field">
                  <label>Số phòng ngủ</label>
                  <select value={filterBedrooms} onChange={e => setFilterBedrooms(e.target.value)}>
                    <option value="">Tất cả</option>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} phòng</option>)}
                  </select>
                </div>
                <div className="filter-field">
                  <label>Khoảng giá / đêm</label>
                  <select value={filterPrice} onChange={e => setFilterPrice(e.target.value)}>
                    <option value="">Tất cả giá</option>
                    <option value="0-1000000">Dưới 1 triệu</option>
                    <option value="1000000-3000000">1 - 3 triệu</option>
                    <option value="3000000-5000000">3 - 5 triệu</option>
                    <option value="5000000-10000000">5 - 10 triệu</option>
                    <option value="10000000-99999999">Trên 10 triệu</option>
                  </select>
                </div>
                <div className="filter-field">
                  <label>Số người lớn tối đa</label>
                  <select value={filterAdults} onChange={e => setFilterAdults(e.target.value)}>
                    <option value="">Tất cả</option>
                    {[2,4,6,8,10,12].map(n => <option key={n} value={n}>≥ {n} người</option>)}
                  </select>
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-field">
                  <label>Ngày check-in</label>
                  <input type="date" value={filterCheckin}
                    onChange={e => { setFilterCheckin(e.target.value); if (filterCheckout && e.target.value > filterCheckout) setFilterCheckout(''); }}
                    style={{ padding:'7px 10px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', fontSize:'0.875rem' }}
                  />
                </div>
                <div className="filter-field">
                  <label>Ngày check-out</label>
                  <input type="date" value={filterCheckout} min={filterCheckin}
                    onChange={e => setFilterCheckout(e.target.value)}
                    style={{ padding:'7px 10px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', fontSize:'0.875rem' }}
                  />
                </div>
                {(filterCheckin || filterCheckout) && (
                  <div className="filter-field" style={{ justifyContent:'flex-end', paddingTop:'20px' }}>
                    <span style={{ fontSize:'0.8rem', color:'var(--ink-muted)' }}>
                      {filterCheckin && filterCheckout
                        ? `Tìm villa trống: ${filterCheckin} → ${filterCheckout}`
                        : filterCheckin ? `Từ ngày ${filterCheckin}` : `Đến ngày ${filterCheckout}`}
                    </span>
                  </div>
                )}
              </div>
              {allAmenities.length > 0 && (
                <div className="filter-amenities">
                  <label>Tiện ích</label>
                  <div className="amenity-chips">
                    {allAmenities.map(a => (
                      <button
                        key={a}
                        className={`amenity-chip${filterAmenity.includes(a) ? ' active' : ''}`}
                        onClick={() => setFilterAmenity(prev =>
                          prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a]
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {filteredVillas.length === 0 && (
                <div style={{ padding:'12px', color:'var(--ink-muted)', fontSize:'0.875rem', textAlign:'center' }}>
                  Không tìm thấy villa phù hợp
                </div>
              )}
            </div>
          )}

          {/* Villa tab selector */}
          <div className="villa-selector">
            {filteredVillas.map(v => (
              <button
                key={v.id}
                className={`villa-tab${v.id === selectedVillaId ? ' active' : ''}`}
                onClick={() => setSelectedVillaId(v.id)}
              >
                <span style={{ fontSize: '1.2rem' }}>{v.emoji}</span>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{v.name}</span>
                  <span style={{ fontSize: '0.7rem', opacity: 0.75 }}>🛏 {v.bedrooms} phòng · 👥 {v.adults} người</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Villa info bar */}
      <div className="villa-info-bar">
        <span className="villa-info-name">{villa.emoji} {villa.name}</span>
        <span className="villa-info-meta">
          🛏 {villa.bedrooms} phòng · 👥 {villa.adults} người · 💰 {fmtMoney(villa.price)}/đêm
          {villa.phone && (
            <span className="villa-hotline">
              &nbsp;·&nbsp;📞 <a href={`tel:${villa.phone}`} className="hotline-link">{villa.phone}</a>
            </span>
          )}
        </span>
        <span className="booking-count">
          {bookings.filter(b => b.status !== 'cancelled').length} booking
        </span>
      </div>

      {/* Calendar */}
      <Calendar
        bookings={bookings}
        villaId={selectedVillaId}
        lockedDates={localLockedDates ?? villa.lockedDates}
        month={month}
        year={year}
        onMonthChange={(y, m) => { setYear(y); setMonth(m); }}
        onDayClick={handleDayClick}
        role={userRole}
      />

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>

            {/* CREATE BOOKING */}
            {modal.mode === 'create' && (
              <>
                <div className="modal-header">
                  <h3>
                    📅 Tạo booking mới
                    {modal?.checkin && (localLockedDates ?? villa.lockedDates).includes(modal.checkin) && (
                      <span style={{ marginLeft: 8, fontSize: '0.75rem', background: '#dde8e3', color: '#2d6b5e', padding: '2px 8px', borderRadius: 99 }}>
                        🔒 Ngày này đang bị khóa
                      </span>
                    )}
                  </h3>
                  <button className="modal-close" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <div className="form-row">
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Tên khách *</label>
                      <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder="Nguyễn Văn A" />
                    </div>
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Số điện thoại *</label>
                      <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0901234567" />
                    </div>
                  </div>
                  <div className="field-group">
                    <label>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="khach@email.com" />
                  </div>
                  <div className="form-row">
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Check-in *</label>
                      <input type="date" value={checkin} min={todayISO()} onChange={e => setCheckin(e.target.value)} />
                    </div>
                    <div className="field-group" style={{ flex: 1 }}>
                      <label>Check-out *</label>
                      <input type="date" value={checkout} min={addDays(checkin, 1)} onChange={e => setCheckout(e.target.value)} />
                    </div>
                  </div>

                  {nights > 0 && (
                    <div className="booking-summary">
                      <span>🌙 {nights} đêm</span>
                      <span>💰 {fmtMoney(total)}</span>
                    </div>
                  )}

                  {/* Sale chỉ tạo được Hold, không có lựa chọn */}
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <div className="field-group">
                      <label>Loại đặt</label>
                      <div className="status-toggle">
                        <button type="button"
                          className={`status-btn${bookStatus === 'confirmed' ? ' active confirmed' : ''}`}
                          onClick={() => setBookStatus('confirmed')}>
                          ✅ Confirmed
                        </button>
                        <button type="button"
                          className={`status-btn${bookStatus === 'hold' ? ' active hold' : ''}`}
                          onClick={() => setBookStatus('hold')}>
                          ⏳ Hold (30 phút)
                        </button>
                      </div>
                    </div>
                  )}
                  {userRole === 'sale' && (
                    <div className="field-group">
                      <div style={{ padding:'8px 12px', background:'var(--amber-light)', borderRadius:'var(--radius-md)', fontSize:'0.85rem', color:'var(--amber)', fontWeight:600 }}>
                        ⏳ Hold (30 phút) — Sale chỉ được tạo hold
                      </div>
                    </div>
                  )}

                  <div className="field-group">
                    <label>Ghi chú</label>
                    <textarea value={note} onChange={e => setNote(e.target.value)}
                      placeholder="Ghi chú thêm..." rows={2}
                      style={{ width:'100%', padding:'8px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', resize:'vertical' }} />
                  </div>

                  {formError && <div className="auth-alert error">❌ {formError}</div>}
                </div>
                <div className="modal-footer">
                  <button className="btn-secondary" onClick={closeModal}>Hủy</button>
                  {(userRole === 'owner' || userRole === 'admin') && modal?.checkin && (() => {
                    const isLocked = (localLockedDates ?? villa.lockedDates).includes(modal.checkin!);
                    return (
                      <button
                        className="btn-secondary"
                        style={isLocked
                          ? { background: '#fff3e0', borderColor: '#f0b429', color: '#b8860b' }
                          : { background: '#dde8e3', borderColor: '#7aaba3', color: '#2d6b5e' }}
                        onClick={() => handleLockDate(modal.checkin!)}
                        disabled={isPending}
                      >
                        {isLocked ? '🔓 Mở khóa ngày này' : '🔒 Khóa phòng'}
                      </button>
                    );
                  })()}
                  <button className="btn-primary" onClick={handleCreateBooking} disabled={isPending}>
                    {isPending
                      ? 'Đang tạo...'
                      : userRole === 'sale'
                        ? '⏳ Giữ chỗ 30 phút'
                        : bookStatus === 'hold'
                          ? '⏳ Tạo Hold'
                          : '✅ Tạo Booking'}
                  </button>
                </div>
              </>
            )}

            {/* VIEW BOOKING */}
            {modal.mode === 'view' && modal.booking && (() => {
              const b = modal.booking;
              const canSeePrivate = userRole !== 'sale' || b.createdByRole === 'sale';
              return (
                <>
                  <div className="modal-header">
                    <h3>
                      <span className={`badge badge-${b.status}`} style={{ marginRight: 8 }}>
                        {b.status === 'confirmed' ? '✅ Confirmed' : b.status === 'hold' ? '⏳ Hold' : '❌ Cancelled'}
                      </span>
                      {canSeePrivate ? b.customer : '🔒 Booking của chủ nhà'}
                    </h3>
                    <button className="modal-close" onClick={closeModal}>×</button>
                  </div>
                  <div className="modal-body">
                    <div className="booking-detail-grid">
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Check-in</span>
                        <span className="booking-detail-value">📅 {formatDate(b.checkin)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Check-out</span>
                        <span className="booking-detail-value">📅 {formatDate(b.checkout)}</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Số đêm</span>
                        <span className="booking-detail-value">🌙 {calcNights(b.checkin, b.checkout)} đêm</span>
                      </div>
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Tổng tiền</span>
                        <span className="booking-detail-value" style={{ color: 'var(--forest)', fontWeight: 700 }}>
                          💰 {fmtMoney(b.total)}
                        </span>
                      </div>
                      {canSeePrivate && b.phone && (
                        <div className="booking-detail-item">
                          <span className="booking-detail-label">Điện thoại</span>
                          <span className="booking-detail-value">📞 {b.phone}</span>
                        </div>
                      )}
                      {canSeePrivate && b.email && (
                        <div className="booking-detail-item">
                          <span className="booking-detail-label">Email</span>
                          <span className="booking-detail-value">✉️ {b.email}</span>
                        </div>
                      )}
                      {!canSeePrivate && (
                        <div className="booking-detail-item" style={{ gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                            🔒 Thông tin khách được ẩn — chỉ hiển thị với người tạo booking
                          </span>
                        </div>
                      )}
                      <div className="booking-detail-item">
                        <span className="booking-detail-label">Tạo bởi</span>
                        <span className="booking-detail-value">
                          {b.createdByRole === 'owner' ? '👑' : b.createdByRole === 'sale' ? '🏷️' : '👥'} {b.createdByRole}
                        </span>
                      </div>
                    </div>
                    {b.note && (
                      <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--parchment)', borderRadius: 'var(--radius-md)', fontSize: '0.875rem', color: 'var(--ink-light)' }}>
                        📝 {b.note}
                      </div>
                    )}
                    {b.status === 'hold' && b.holdExpiresAt && (() => {
                      const exp  = new Date(b.holdExpiresAt);
                      const now  = new Date();
                      const diff = Math.round((exp.getTime() - now.getTime()) / 60000);
                      const isExpired = diff <= 0;
                      return (
                        <div style={{
                          marginTop: 12, padding: '8px 14px',
                          background: isExpired ? '#fff0f0' : '#fef6e4',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem', fontWeight: 600,
                          color: isExpired ? '#c0392b' : '#b8860b',
                        }}>
                          {isExpired
                            ? '⚠️ Hold đã hết hạn — cần xác nhận hoặc hủy'
                            : `⏳ Tự động hủy sau ${diff} phút`}
                        </div>
                      );
                    })()}
                  </div>
                  <div className="modal-footer">
                    {b.status === 'hold' && (userRole === 'owner' || userRole === 'admin') && (
                      <button className="btn-primary" onClick={() => handleConfirm(b.id)} disabled={isPending}>
                        ✅ Xác nhận booking
                      </button>
                    )}
                    {b.status !== 'cancelled' && (() => {
                      const canCancel =
                        userRole === 'owner' || userRole === 'admin'
                          ? true
                          : userRole === 'sale' && b.status === 'hold';
                      if (!canCancel) return null;
                      return (
                        <button
                          className="btn-secondary"
                          style={{ color: 'var(--red)', borderColor: 'rgba(192,57,43,.3)' }}
                          onClick={() => handleCancel(b.id)}
                          disabled={isPending}
                        >
                          ❌ Hủy {b.status === 'hold' ? 'hold' : 'booking'}
                        </button>
                      );
                    })()}
                    <button className="btn-secondary" onClick={closeModal}>Đóng</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <style>{`
        .cal-shell { display: flex; flex-direction: column; gap: 16px; }

        /* ── Villa Selector: horizontal scroll cards ── */
        .villa-selector {
          display:     flex;
          gap:         10px;
          overflow-x:  auto;
          padding:     4px 2px 10px;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .villa-selector::-webkit-scrollbar { display: none; }

        .villa-tab {
          flex:           0 0 auto;
          display:        flex;
          align-items:    center;
          gap:            8px;
          padding:        10px 14px;
          border:         1.5px solid var(--stone);
          border-radius:  14px;
          background:     var(--white);
          font-family:    var(--font-body);
          font-size:      0.875rem;
          cursor:         pointer;
          color:          var(--ink-muted);
          transition:     all .15s;
          white-space:    nowrap;
          box-shadow:     0 1px 4px rgba(0,0,0,.04);
          min-width:      120px;
        }
        .villa-tab:hover {
          border-color: var(--sage);
          background:   var(--sage-pale);
          color:        var(--forest);
          box-shadow:   0 2px 8px rgba(0,0,0,.08);
        }
        .villa-tab.active {
          background:   var(--forest);
          border-color: var(--forest);
          color:        #fff;
          font-weight:  600;
          box-shadow:   0 3px 10px rgba(45,90,45,.25);
        }

                .villa-filter-bar {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;
        }
        .villa-filter-search {
          flex: 1; min-width: 200px; padding: 8px 14px;
          border: 1.5px solid var(--stone); border-radius: 99px;
          font-family: var(--font-body); font-size: 0.875rem; color: var(--ink);
          outline: none; transition: border-color .15s; background: var(--white);
        }
        .villa-filter-search:focus { border-color: var(--sage); }
        .villa-filter-toggle {
          padding: 8px 14px; border: 1.5px solid var(--stone); border-radius: 99px;
          background: var(--white); font-family: var(--font-body); font-size: 0.82rem;
          cursor: pointer; color: var(--ink); transition: all .15s; white-space: nowrap;
        }
        .villa-filter-toggle:hover, .villa-filter-toggle.active {
          border-color: var(--sage); background: var(--sage-pale); color: var(--forest);
        }
        .filter-badge { color: var(--forest); font-size: 0.7rem; }
        .villa-filter-clear {
          padding: 8px 12px; border: 1.5px solid rgba(192,57,43,.3); border-radius: 99px;
          background: var(--white); font-family: var(--font-body); font-size: 0.82rem;
          cursor: pointer; color: var(--red); transition: all .15s;
        }
        .villa-filter-clear:hover { background: #fff0f0; }
        .villa-filter-panel {
          background: var(--white); border: 1px solid rgba(180,212,195,.3);
          border-radius: var(--radius-md); padding: 14px 16px; margin-bottom: 10px;
        }
        .filter-row {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 12px; margin-bottom: 12px;
        }
        .filter-field { display: flex; flex-direction: column; gap: 4px; }
        .filter-field label { font-size: 0.75rem; font-weight: 700; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .filter-field select {
          padding: 7px 10px; border: 1.5px solid var(--stone); border-radius: var(--radius-md);
          font-family: var(--font-body); font-size: 0.875rem; color: var(--ink);
          outline: none; background: var(--white); transition: border-color .15s;
        }
        .filter-field select:focus { border-color: var(--sage); }
        .filter-amenities { display: flex; flex-direction: column; gap: 8px; }
        .filter-amenities label { font-size: 0.75rem; font-weight: 700; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
        .amenity-chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .amenity-chip {
          padding: 5px 12px; border: 1.5px solid var(--stone); border-radius: 99px;
          background: var(--white); font-family: var(--font-body); font-size: 0.8rem;
          cursor: pointer; color: var(--ink); transition: all .15s;
        }
        .amenity-chip:hover { border-color: var(--sage); background: var(--sage-pale); }
        .amenity-chip.active { background: var(--forest); border-color: var(--forest); color: white; font-weight: 600; }
      `}</style>
    </div>
  );
}
