'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.2 — app/owner/calendar/CalendarShell.tsx        ║
// ║  Client shell: villa selector, calendar, booking modal      ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter }           from 'next/navigation';
import Calendar, { type BarSegment } from '@/components/Calendar';
import { useBookingsRealtime } from '@/hooks/useBookingsRealtime';
import { useToast }            from '@/components/Toast';
import {
  createBooking, cancelBooking, confirmHold,
} from '@/lib/services/booking.service';
import { toggleLockDate } from '@/lib/services/villa.service';
import { fetchVillaBookingsAction, fetchSaleHoldsAction } from '@/lib/cache/booking-cache-actions';
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
  initialBookings?: Booking[];
}

type ModalMode = 'create' | 'view' | 'locked';

interface BookingModal {
  mode:        ModalMode;
  checkin?:    string;
  checkout?:   string;
  booking?:    Booking;
  lockedDate?: string;   // ngày khóa khi mode='locked'
}

// ── Component ─────────────────────────────────────────────────────

// ── Amenity icon map ─────────────────────────────────────────────
const AMENITY_ICONS: Record<string, string> = {
  'pool':         '🏊',
  'bbq':          '🔥',
  'garden':       '🌿',
  'gym':          '💪',
  'jacuzzi':      '🛁',
  'karaoke':      '🎤',
  'parking':      '🅿️',
  'billiard':     '🎱',
  'xe đạp':       '🚲',
  'wifi':         '📶',
  'bếp':          '🍳',
  'điều hòa':     '❄️',
  'máy giặt':     '🫧',
  'tivi':         '📺',
  'bãi biển':     '🏖️',
  'view biển':    '🌊',
  'sân vườn':     '🌳',
  'ban công':     '🪟',
  'hồ bơi':       '🏊',
  'phòng tắm':    '🚿',
  'bồn tắm':      '🛁',
  'thang máy':    '🛗',
  'bảo vệ':       '💂',
  'camera':       '📷',
  'lò sưởi':      '🔥',
  'sauna':        '🧖',
  'tennis':       '🎾',
  'cafe':         '☕',
  'bar':          '🍹',
};

export default function CalendarShell({ villas, initialVillaId, userRole, initialBookings = [] }: CalendarShellProps) {
  const router = useRouter();
  const { show } = useToast();
  const [isPending, startTransition] = useTransition();

  const [selectedVillaId, setSelectedVillaId] = useState(initialVillaId);
  const [year,  setYear]  = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [modal, setModal] = useState<BookingModal | null>(null);
  const [serverBookings, setServerBookings] = useState<Booking[]>(initialBookings);
  const [allSaleHolds,   setAllSaleHolds]   = useState<Booking[]>([]);
  // Optimistic locked dates: update instantly without F5 (FIX 5)
  const [localLockedDates, setLocalLockedDates] = useState<string[] | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailVillaId, setDetailVillaId] = useState<string | null>(null);

  // ── Villa filter state ─────────────────────────────────────────
  const [showFilter,    setShowFilter]    = useState(false);
  const [highlightEmpty, setHighlightEmpty] = useState(false); // chế độ xem ngày trống
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
  const detailVilla = villas.find(v => v.id === detailVillaId) ?? villa;
  const [lbIndex, setLbIndex] = useState<number | null>(null);
  const lbImages = detailVilla.images ?? [];
  const lbNext = useCallback(() => setLbIndex(i => i !== null ? (i + 1) % lbImages.length : null), [lbImages.length]);
  const lbPrev = useCallback(() => setLbIndex(i => i !== null ? (i - 1 + lbImages.length) % lbImages.length : null), [lbImages.length]);
  const lbTouchX = useRef(0);

  useEffect(() => {
    if (lbIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') lbNext();
      if (e.key === 'ArrowLeft')  lbPrev();
      if (e.key === 'Escape')     setLbIndex(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lbIndex, lbNext, lbPrev]);

  // Realtime bookings: Supabase subscription tức thì
  const bookings = useBookingsRealtime(selectedVillaId, serverBookings);

  // Load bookings khi đổi villa (initial fetch)
  useEffect(() => {
    if (!selectedVillaId) return;
    fetchVillaBookingsAction(selectedVillaId).then(data => setServerBookings(data));
  }, [selectedVillaId]);

  // Load tất cả hold của sale này (kể cả khi đổi villa)
  useEffect(() => {
    if (userRole !== 'sale') return;
    const fetchHolds = () => {
      // Lấy userId từ booking đã có hoặc dùng createdBy từ profile
      // Fetch tất cả villa holds cho sale này
      Promise.all(villas.map(v => fetchVillaBookingsAction(v.id)))
        .then(results => {
          const allHolds = results.flat().filter(b =>
            b.status === 'hold' &&
            b.holdExpiresAt &&
            new Date(b.holdExpiresAt).getTime() > Date.now()
          );
          setAllSaleHolds(allHolds);
        });
    };
    fetchHolds();
    // Refresh mỗi 30 giây
    const interval = setInterval(fetchHolds, 30000);
    return () => clearInterval(interval);
  }, [userRole, villas]);

  // Load tất cả hold của sale (cross-villa) cho owner xem
  const [allOwnerHolds, setAllOwnerHolds] = useState<Booking[]>([]);
  useEffect(() => {
    if (userRole !== 'owner' && userRole !== 'admin') return;
    const fetchHolds = () => {
      Promise.all(villas.map(v => fetchVillaBookingsAction(v.id)))
        .then(results => {
          const holds = results.flat().filter(b =>
            b.status === 'hold' &&
            b.createdByRole === 'sale' &&
            b.holdExpiresAt &&
            new Date(b.holdExpiresAt).getTime() > Date.now()
          );
          setAllOwnerHolds(holds);
        });
    };
    fetchHolds();
    const interval = setInterval(fetchHolds, 30000);
    return () => clearInterval(interval);
  }, [userRole, villas]);

  // ── Form state (create booking) ────────────────────────────────
  const [customer,  setCustomer]  = useState('');
  const [phone,     setPhone]     = useState('');
  const [email,     setEmail]     = useState('');
  const [note,      setNote]      = useState('');
  const [bookStatus, setBookStatus] = useState<'confirmed' | 'hold'>('confirmed');
  const [checkin,   setCheckin]   = useState('');
  const [checkout,  setCheckout]  = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [holdSuccess, setHoldSuccess] = useState<{ hotline: string; villaName: string } | null>(null);

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
  function handleDayClick(ds: string, info: BarSegment | null) {
    // info = null → ngày trống hoặc checkout day → tạo booking mới
    if (!info) {
      if (ds >= todayISO()) openCreateModal(ds);
      return;
    }

    // Ngày bị khóa → hiển thị thông tin khóa
    if (info.type === 'locked') {
      setModal({ mode: 'locked', lockedDate: ds });
      return;
    }

    // Ngày có booking → mở view modal
    if (info.bkId) {
      const found = bookings.find(b => b.id === info.bkId);
      if (found) { openViewModal(found); return; }
      // Không thấy trong state → fetch lại rồi mở
      fetchVillaBookingsAction(selectedVillaId).then(data => {
        setServerBookings(data);
        const refetched = data.find(b => b.id === info.bkId);
        if (refetched) { openViewModal(refetched); return; }
        // Vẫn không thấy → tìm theo ngày
        const byDate = data.find(b => b.checkin <= ds && b.checkout > ds && b.status !== 'cancelled');
        if (byDate) openViewModal(byDate);
      });
      return;
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
      bookings, [{ id: villa.id, lockedDates: localLockedDates ?? villa.lockedDates }],
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

      if (userRole === 'sale' && bookStatus === 'hold') {
        // Hiện popup thành công với hotline
        closeModal();
        router.refresh();
        setHoldSuccess({ hotline: (villa as any).phone ?? '', villaName: villa.name ?? '' });
      } else {
        show('success', bookStatus === 'hold' ? '⏳ Đã tạo Hold' : '✅ Đã tạo Booking', `${customer} · ${formatDate(checkin)} → ${formatDate(checkout)}`);
        closeModal();
        router.refresh();
      }
    });
  }

  // ── Confirm hold ───────────────────────────────────────────────
  function handleConfirm(id: string) {
    startTransition(async () => {
      const result = await confirmHold(id);
      if (result.error) { show('error', 'Lỗi', result.error); return; }
      show('success', '✅ Đã xác nhận booking');
      setAllOwnerHolds(prev => prev.filter(b => b.id !== id));
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
      setAllOwnerHolds(prev => prev.filter(b => b.id !== id));
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
          {/* Search + Filter — tích hợp gọn */}
          <div className="villa-search-wrap">
            <div className="villa-search-inner">
              <input
                className="villa-search-input"
                placeholder="Tìm villa..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
              />
              {filterSearch && (
                <button className="villa-search-clear" onClick={() => setFilterSearch('')}>×</button>
              )}
              <svg className="villa-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            {userRole !== 'owner' && (
              <button
                className={`villa-search-filter-btn${showFilter ? ' active' : ''}`}
                onClick={() => setShowFilter(v => !v)}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Lọc
                {hasFilter && <span className="villa-filter-dot" />}
              </button>
            )}
          </div>
          {hasFilter && (
            <button className="villa-filter-clear-small" onClick={clearFilter}>✕ Xóa lọc</button>
          )}

          {/* Expanded filter panel */}
          {userRole !== 'owner' && showFilter && (
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
                        {AMENITY_ICONS[a.toLowerCase()] ?? '✨'} {a}
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

          {/* Villa card selector */}
          <div className="villa-selector">
            {filteredVillas.map(v => (
              <button
                key={v.id}
                className={`villa-card${v.id === selectedVillaId ? ' active' : ''}`}
                onClick={() => setSelectedVillaId(v.id)}
                onDoubleClick={() => {
                  if (userRole === 'sale') {
                    setDetailVillaId(v.id);
                    setShowDetail(true);
                  }
                }}
              >
                {/* Ảnh */}
                <div className="villa-card-img">
                  {v.images?.[0]
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={v.images[0]} alt={v.name} />
                    : <div className="villa-card-img-fallback">{v.emoji}</div>
                  }
                </div>
                {/* Info */}
                <div className="villa-card-body">
                  <div className="villa-card-name">{v.emoji} {v.name}</div>
                  <div className="villa-card-badge">
                    <span className="villa-card-dot" />
                    Đang hoạt động
                  </div>
                  <div className="villa-card-addr">📍 {v.district}, {v.province}</div>
                  <div className="villa-card-stats">
                    <span>🛏 {v.bedrooms} phòng</span>
                    <span>·</span>
                    <span>👥 {v.adults} người</span>
                    <span>·</span>
                    <span className="villa-card-price">{v.price.toLocaleString('vi-VN')}đ/đêm</span>
                  </div>
                  {userRole === 'sale' && (
                    <div className="villa-card-hint">Nhấn đúp để xem chi tiết</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}


      {/* Section label */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '10px',
        fontSize:       '0.62rem',
        fontWeight:     600,
        color:          'var(--gold, #C9A84C)',
        letterSpacing:  '0.14em',
        textTransform:  'uppercase',
        margin:         '20px 0 10px',
      }}>
        Lịch villa
        <span style={{ flex:1, height:'0.5px', background:'linear-gradient(90deg,rgba(201,168,76,.4) 0%,transparent 100%)' }} />
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
        hotline={userRole !== 'sale' ? ((villa as any).phone ?? '') : ''}
        role={userRole}
        highlightEmpty={highlightEmpty}
        onToggleEmpty={(userRole === 'sale' || userRole === 'owner') ? (v) => setHighlightEmpty(v) : undefined}
      />

      {/* ── YÊU CẦU GIỮ PHÒNG — owner thấy bên dưới lịch ─────── */}
      {userRole === 'owner' && (() => {
        const pendingHolds = allOwnerHolds;
        if (!pendingHolds.length) return null;
        return (
          <div className="hold-requests-luxury">
            {/* Section label */}
            <div className="hold-req-label">
              Yêu cầu giữ phòng
              <span className="hold-req-count">{pendingHolds.length}</span>
              <span className="hold-req-line" />
            </div>

            <div className="hold-req-list">
              {pendingHolds.map(b => {
                const nights   = calcNights(b.checkin, b.checkout);
                const bVilla   = villas.find(v => v.id === b.villaId);
                const exp      = new Date(b.holdExpiresAt!);
                const minLeft  = Math.max(0, Math.round((exp.getTime() - Date.now()) / 60000));
                const urgent   = minLeft <= 10;
                return (
                  <div key={b.id} className={`hold-req-card${urgent ? ' hold-req-card--urgent' : ''}`}>

                    {/* Top: sale info + timer */}
                    <div className="hold-req-top">
                      <div className="hold-req-sale">
                        <div className="hold-req-sale-avatar">
                          {(b.createdByName ?? 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="hold-req-sale-name">{b.createdByName ?? b.createdBy ?? 'Sale'}</div>
                          {b.createdByPhone && (
                            <a href={`tel:${b.createdByPhone}`} className="hold-req-sale-phone">
                              📞 {b.createdByPhone}
                            </a>
                          )}
                        </div>
                      </div>
                      <div className={`hold-req-timer${urgent ? ' hold-req-timer--urgent' : ''}`}>
                        ⏱ {minLeft} phút
                      </div>
                    </div>

                    {/* Middle: booking info */}
                    <div className="hold-req-body">
                      {bVilla && (
                        <div className="hold-req-villa">{bVilla.emoji} {bVilla.name}</div>
                      )}
                      <div className="hold-req-dates">
                        📅 {formatDate(b.checkin)} → {formatDate(b.checkout)}
                        <span className="hold-req-sep">·</span>
                        🌙 {nights} đêm
                        <span className="hold-req-sep">·</span>
                        <span className="hold-req-price">{fmtMoney(b.total)}</span>
                      </div>
                      <div className="hold-req-guest">
                        👤 {b.customer}
                        {b.phone && <span className="hold-req-sep">· 📞 {b.phone}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="hold-req-actions">
                      <button
                        className="hold-req-btn hold-req-btn--reject"
                        disabled={isPending}
                        onClick={() => handleCancel(b.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Từ chối
                      </button>
                      <button
                        className="hold-req-btn hold-req-btn--approve"
                        disabled={isPending}
                        onClick={() => handleConfirm(b.id)}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        Duyệt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── HOLD ĐANG CHỜ DUYỆT — chỉ sale ────────────────────── */}
      {userRole === 'sale' && (() => {
        // Dùng allSaleHolds — hiện tất cả hold kể cả khi đổi villa
        const saleHolds = allSaleHolds.length > 0
          ? allSaleHolds
          : bookings.filter(b =>
              b.status === 'hold' &&
              b.holdExpiresAt &&
              new Date(b.holdExpiresAt).getTime() > Date.now()
            );
        if (!saleHolds.length) return null;
        return (
          <div className="hold-requests" style={{ marginTop: 16 }}>
            <div className="hold-requests__header">
              <span className="hold-requests__title">⏳ Hold đang chờ duyệt</span>
              <span className="hold-requests__badge">{saleHolds.length}</span>
            </div>
            <div className="hold-requests__list">
              {saleHolds.map(b => {
                const nights  = calcNights(b.checkin, b.checkout);
                const villa   = villas.find(v => v.id === b.villaId);
                const exp     = new Date(b.holdExpiresAt!);
                const minLeft = Math.max(0, Math.round((exp.getTime() - Date.now()) / 60000));
                return (
                  <div key={b.id} className="hold-card">
                    <div className="hold-card__info">
                      <div className="hold-card__meta">
                        {villa && <span>{villa.emoji} <strong>{villa.name}</strong></span>}
                        <span className="hold-card__dot">·</span>
                        <span>📅 {formatDate(b.checkin)} → {formatDate(b.checkout)}</span>
                        <span className="hold-card__dot">·</span>
                        <span>🌙 {nights} đêm</span>
                        <span className="hold-card__dot">·</span>
                        <span>💰 {fmtMoney(b.total)}</span>
                      </div>
                      <div className="hold-card__guest">
                        👤 {b.customer}
                        {b.phone && <span> · 📞 {b.phone}</span>}
                      </div>
                      <div className="hold-card__timer" style={{ color: minLeft <= 5 ? 'var(--red)' : 'var(--amber)' }}>
                        ⏱ Còn {minLeft} phút · Đang chờ chủ nhà duyệt
                      </div>
                    </div>
                    <div className="hold-card__actions">
                      <button
                        className="hold-btn hold-btn--reject"
                        disabled={isPending}
                        onClick={() => handleCancel(b.id)}
                      >
                        ✕ Hủy hold
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* ── VILLA DETAIL MODAL ───────────────────────────────── */}
      {showDetail && createPortal(
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal modal-detail" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{detailVilla.emoji} {detailVilla.name}</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {detailVilla.images && detailVilla.images.length > 0 && (
                <div className="detail-gallery">
                  {detailVilla.images.map((src, i) => (
                    <div
                      key={i}
                      className="detail-gallery-cell"
                      onClick={() => setLbIndex(i)}
                      style={{ cursor: 'zoom-in' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`${detailVilla.name} ${i + 1}`} />
                      <div className="detail-img-zoom">🔍</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="detail-section">
                  <div className="detail-status-row">
                    <span className="detail-status-badge"><span className="detail-status-dot" /> Đang hoạt động</span>
                    <span className="detail-price">{fmtMoney(detailVilla.price)}<span style={{ fontSize:'0.8rem', fontWeight:400, color:'var(--ink-muted)' }}>/đêm</span></span>
                  </div>
                  <div className="detail-meta-grid">
                    <div className="detail-meta-item">
                      <span className="detail-meta-icon">📍</span>
                      <div>
                        <div className="detail-meta-label">Địa chỉ</div>
                        <div className="detail-meta-val">{[detailVilla.street, detailVilla.ward, detailVilla.district, detailVilla.province].filter(Boolean).join(', ')}</div>
                      </div>
                    </div>
                    <div className="detail-meta-item">
                      <span className="detail-meta-icon">🛏</span>
                      <div><div className="detail-meta-label">Phòng ngủ</div><div className="detail-meta-val">{detailVilla.bedrooms} phòng</div></div>
                    </div>
                    <div className="detail-meta-item">
                      <span className="detail-meta-icon">👥</span>
                      <div><div className="detail-meta-label">Sức chứa</div><div className="detail-meta-val">{detailVilla.adults} người lớn{detailVilla.children > 0 ? ` · ${detailVilla.children} trẻ em` : ''}</div></div>
                    </div>
                    {detailVilla.phone && userRole !== 'sale' && (
                      <div className="detail-meta-item">
                        <span className="detail-meta-icon">📞</span>
                        <div><div className="detail-meta-label">Hotline</div>
                          <div className="detail-meta-val"><a href={`tel:${detailVilla.phone}`} style={{ color:'var(--forest)', fontWeight:600 }}>{detailVilla.phone}</a></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {detailVilla.amenities && detailVilla.amenities.length > 0 && (
                  <div className="detail-section">
                    <div className="detail-section-title">✨ Tiện ích</div>
                    <div className="detail-amenities">
                      {detailVilla.amenities.map(a => {
                        return <div key={a} className="detail-amenity-chip"><span>{AMENITY_ICONS[a.toLowerCase()]??'✨'}</span><span>{a}</span></div>;
                      })}
                    </div>
                  </div>
                )}
                {detailVilla.description && (
                  <div className="detail-section">
                    <div className="detail-section-title">📝 Giới thiệu villa</div>
                    <p className="detail-description">{detailVilla.description}</p>
                  </div>
                )}
                {detailVilla.images && detailVilla.images.length > 0 && (
                  <div className="detail-section">
                    <div className="detail-section-title">📸 Tải ảnh gửi khách</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {detailVilla.images.map((src, i) => (
                        <a key={i} href={src} download={`${detailVilla.name}-anh-${i+1}.jpg`}
                          target="_blank" rel="noopener noreferrer" className="btn-download">
                          ⬇ Ảnh {i+1}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL ─────────────────────────────────────────────── */}
      {/* ── Hold Success Popup (sale) ── */}
      {holdSuccess && (
        <div className="hold-success-overlay" onClick={() => setHoldSuccess(null)}>
          <div className="hold-success-box" onClick={e => e.stopPropagation()}>
            <div className="hold-success-icon">✅</div>
            <h3 className="hold-success-title">Giữ phòng thành công!</h3>
            {holdSuccess.villaName && (
              <div className="hold-success-villa">{holdSuccess.villaName}</div>
            )}
            <p className="hold-success-note">
              Bạn có thể chủ động liên hệ với chủ nhà theo hotline hoặc đợi chủ nhà tự xác nhận.
            </p>
            {holdSuccess.hotline ? (
              <a href={`tel:${holdSuccess.hotline}`} className="hold-success-hotline">
                📞 {holdSuccess.hotline}
              </a>
            ) : (
              <p className="hold-success-no-hotline">Chủ nhà chưa cài hotline — vui lòng đợi xác nhận.</p>
            )}
            <button className="hold-success-btn" onClick={() => setHoldSuccess(null)}>
              Hoàn thành
            </button>
          </div>
        </div>
      )}

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
                      <label>{userRole === 'sale' ? 'Tên sale *' : 'Tên khách *'}</label>
                      <input value={customer} onChange={e => setCustomer(e.target.value)} placeholder={userRole === 'sale' ? 'Tên của bạn' : 'Nguyễn Văn A'} />
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
                    // Kiểm tra ngày checkin có booking confirmed/hold hợp lệ không
                    const hasBooking = bookings.some(b => {
                      if (b.status === 'cancelled') return false;
                      if (b.status === 'hold' && b.holdExpiresAt &&
                          new Date(b.holdExpiresAt).getTime() < Date.now()) return false;
                      return b.checkin <= modal.checkin! && b.checkout > modal.checkin!;
                    });
                    // Nếu đã có booking → chỉ hiển thị thông báo, không cho khóa
                    if (hasBooking && !isLocked) return null;
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
            {modal.mode === 'locked' && (
              <>
                <div className="modal-header">
                  <h3>🔒 Ngày bị khóa</h3>
                  <button className="modal-close" onClick={closeModal}>×</button>
                </div>
                <div className="modal-body">
                  <div className="booking-detail-grid">
                    <div className="booking-detail-item">
                      <span className="booking-detail-label">Ngày khóa</span>
                      <span className="booking-detail-value">📅 {modal.lockedDate ? formatDate(modal.lockedDate) : '—'}</span>
                    </div>
                    <div className="booking-detail-item">
                      <span className="booking-detail-label">Trạng thái</span>
                      <span className="booking-detail-value" style={{ color: 'var(--forest)', fontWeight: 600 }}>🔒 Đã khóa</span>
                    </div>
                    <div className="booking-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                        Chủ nhà đã khóa đêm này. Không thể nhận booking trong thời gian này.
                      </span>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  {(userRole === 'owner' || userRole === 'admin') && modal.lockedDate && (
                    <button
                      className="btn-secondary"
                      style={{ background: '#fff3e0', borderColor: '#f0b429', color: '#b8860b' }}
                      onClick={() => { handleLockDate(modal.lockedDate!); }}
                      disabled={isPending}
                    >
                      🔓 Mở khóa ngày này
                    </button>
                  )}
                  <button className="btn-secondary" onClick={closeModal}>Đóng</button>
                </div>
              </>
            )}

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

      {/* ── LIGHTBOX ── */}
      {lbIndex !== null && lbImages.length > 0 && (
        <div
          className="lb-overlay"
          onClick={() => setLbIndex(null)}
          onTouchStart={e => { lbTouchX.current = e.touches[0].clientX; }}
          onTouchEnd={e => {
            const diff = lbTouchX.current - e.changedTouches[0].clientX;
            if (Math.abs(diff) > 50) { if (diff > 0) lbNext(); else lbPrev(); }
          }}
        >
          <button className="lb-close" onClick={() => setLbIndex(null)}>×</button>
          <div className="lb-counter">{lbIndex + 1} / {lbImages.length}</div>
          {lbImages.length > 1 && (
            <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); lbPrev(); }}>‹</button>
          )}
          <div className="lb-img-wrap" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={lbIndex} src={lbImages[lbIndex]} alt={`${detailVilla.name} ${lbIndex + 1}`} className="lb-img" />
          </div>
          {lbImages.length > 1 && (
            <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); lbNext(); }}>›</button>
          )}
          {lbImages.length > 1 && (
            <div className="lb-dots">
              {lbImages.map((_, i) => (
                <button key={i} className={`lb-dot${i === lbIndex ? ' lb-dot--active' : ''}`}
                  onClick={e => { e.stopPropagation(); setLbIndex(i); }} />
              ))}
            </div>
          )}
          <a className="lb-download" href={lbImages[lbIndex]}
            download={`${detailVilla.name}-${lbIndex + 1}.jpg`}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}>⬇ Tải ảnh</a>
        </div>
      )}

      <style>{`
        .cal-shell { display: flex; flex-direction: column; gap: 16px; }

        .villa-selector {
          display:    flex;
          gap:        12px;
          overflow-x: auto;
          padding:    4px 2px 12px;
          scrollbar-width: thin;
          scrollbar-color: var(--sage) var(--sage-pale);
        }
        .villa-selector::-webkit-scrollbar { height: 4px; }
        .villa-selector::-webkit-scrollbar-track { background: var(--sage-pale); border-radius: 99px; }
        .villa-selector::-webkit-scrollbar-thumb { background: var(--sage); border-radius: 99px; }

        .villa-card {
          flex:          0 0 220px;
          display:       flex;
          flex-direction: column;
          border:        2px solid var(--stone);
          border-radius: var(--radius-lg);
          background:    var(--white);
          cursor:        pointer;
          text-align:    left;
          font-family:   var(--font-body);
          overflow:      hidden;
          transition:    all .18s;
          box-shadow:    none;
          padding:       0;
        }
        .villa-card:hover {
          border-color: var(--sage);
          box-shadow:   none;
          transform:    translateY(-2px);
        }
        .villa-card.active {
          border-color: var(--forest);
          box-shadow:   none;
        }

        .villa-card-img {
          position:    relative;
          height:      110px;
          overflow:    hidden;
          background:  var(--ivory-dark, #F0EDE6);
          flex-shrink: 0;
        }
        .villa-card-img::after {
          content:        '';
          position:       absolute;
          inset:          0;
          background:     linear-gradient(to bottom, transparent 35%, rgba(28,43,74,.5) 100%);
          pointer-events: none;
          z-index:        1;
        }
        .villa-card-img img {
          width:      100%;
          height:     100%;
          object-fit: cover;
          display:    block;
          transition: transform .3s;
        }
        .villa-card:hover .villa-card-img img { transform: scale(1.05); }
        .villa-card-img-fallback {
          width:           100%;
          height:          100%;
          display:         flex;
          align-items:     center;
          justify-content: center;
          font-size:       2.2rem;
        }
        .villa-card-badge {
          display:        inline-flex;
          align-items:    center;
          gap:            4px;
          background:     var(--gold-light, rgba(201,168,76,.12));
          border:         1px solid rgba(201,168,76,.35);
          border-radius:  99px;
          padding:        2px 7px;
          font-size:      0.58rem;
          font-weight:    600;
          color:          #8B6914;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          width:          fit-content;
        }
        .villa-card-dot {
          width:         5px;
          height:        5px;
          border-radius: 50%;
          background:    var(--gold, #C9A84C);
          flex-shrink:   0;
        }
        .villa-card.active .villa-card-badge {
          background:   var(--navy, #1C2B4A);
          border-color: var(--navy, #1C2B4A);
          color:        rgba(255,255,255,.9);
        }
        .villa-card.active .villa-card-dot { background: var(--gold, #C9A84C); }

        .villa-card-body {
          padding: 8px 12px 12px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .villa-card-name {
          font-family:   var(--font-display, Georgia, serif);
          font-size:     0.88rem;
          font-style:    italic;
          font-weight:   400;
          color:         var(--navy, #1C2B4A);
          white-space:   nowrap;
          overflow:      hidden;
          text-overflow: ellipsis;
        }
        .villa-card.active .villa-card-name { color: var(--navy, #1C2B4A); }
        .villa-card-addr {
          font-size:     0.7rem;
          color:         var(--ink-muted);
          white-space:   nowrap;
          overflow:      hidden;
          text-overflow: ellipsis;
        }
        .villa-card-stats {
          display:     flex;
          align-items: center;
          gap:         4px;
          flex-wrap:   wrap;
          font-size:   0.72rem;
          color:       var(--ink-light);
          margin-top:  2px;
        }
        .villa-card-price {
          font-family:    var(--font-display, Georgia, serif);
          font-size:      0.92rem;
          font-style:     italic;
          font-weight:    400;
          color:          var(--navy, #1C2B4A);
          letter-spacing: 0;
          margin-top:     2px;
        }
        .villa-card-hint {
          font-size:  0.65rem;
          color:      var(--ink-muted);
          opacity:    0;
          margin-top: 4px;
          transition: opacity .15s;
          text-align: right;
        }
        .villa-card:hover .villa-card-hint { opacity: 1; }
        .villa-card-view-btn {
          margin-top:    4px;
          align-self:    flex-end;
          padding:       4px 10px;
          border:        1.5px solid var(--sage);
          border-radius: var(--radius-md);
          background:    var(--sage-pale);
          color:         var(--forest);
          font-family:   var(--font-body);
          font-size:     0.72rem;
          font-weight:   600;
          cursor:        pointer;
          transition:    all .15s;
        }
        .villa-card-view-btn:hover { background: var(--sage); color: white; }
        .villa-card.active .villa-card-view-btn { background: rgba(255,255,255,.2); border-color: rgba(255,255,255,.5); color: white; }
        .villa-card.active .villa-card-view-btn:hover { background: rgba(255,255,255,.35); }

                /* ── Search + Filter integrated ── */
        .villa-search-wrap {
          display:       flex;
          align-items:   center;
          gap:           8px;
          margin-bottom: 12px;
        }
        .villa-search-inner {
          display:       flex;
          align-items:   center;
          flex:          1;
          background:    var(--white);
          border:        1px solid rgba(28,43,74,.14);
          border-radius: 99px;
          padding:       0 14px 0 38px;
          height:        38px;
          gap:           6px;
          transition:    border-color .15s, box-shadow .15s;
          position:      relative;
          min-width:     0;
        }
        .villa-search-inner:focus-within {
          border-color: var(--gold, #C9A84C);
          box-shadow:   0 0 0 3px rgba(201,168,76,.12);
        }
        .villa-search-icon {
          position:    absolute;
          left:        13px;
          top:         50%;
          transform:   translateY(-50%);
          color:       var(--ink-muted);
          flex-shrink: 0;
          pointer-events: none;
        }
        .villa-search-input {
          flex:        1;
          border:      none;
          outline:     none;
          background:  transparent;
          font-size:   0.84rem;
          color:       var(--ink);
          font-family: var(--font-body);
          min-width:   0;
          width:       100%;
        }
        .villa-search-input::placeholder { color: var(--ink-muted); }
        .villa-search-clear {
          background:  none;
          border:      none;
          cursor:      pointer;
          color:       var(--ink-muted);
          font-size:   1rem;
          padding:     0;
          line-height: 1;
          flex-shrink: 0;
          transition:  color .12s;
        }
        .villa-search-clear:hover { color: var(--ink); }
        .villa-search-filter-btn {
          display:        flex;
          align-items:    center;
          gap:            5px;
          height:         38px;
          padding:        0 16px;
          background:     var(--white);
          border:         1px solid rgba(28,43,74,.14);
          border-radius:  99px;
          font-size:      0.75rem;
          font-weight:    600;
          color:          var(--navy, #1C2B4A);
          cursor:         pointer;
          white-space:    nowrap;
          flex-shrink:    0;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          transition:     border-color .15s, background .15s;
        }
        .villa-search-filter-btn:hover {
          border-color: var(--gold, #C9A84C);
          background:   rgba(201,168,76,.06);
        }
        .villa-search-filter-btn.active {
          border-color: var(--gold, #C9A84C);
          background:   rgba(201,168,76,.08);
          color:        #8B6914;
        }
        .villa-filter-dot {
          width:         5px; height: 5px;
          border-radius: 50%;
          background:    var(--gold, #C9A84C);
          flex-shrink:   0;
        }
        .villa-filter-clear-small {
          background:     none; border: none; cursor: pointer;
          font-size:      0.72rem; color: var(--ink-muted);
          padding:        4px 0; white-space: nowrap;
          transition:     color .12s; flex-shrink: 0;
        }
        .villa-filter-clear-small:hover { color: var(--red); }

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
        /* ── Hold Requests Luxury (owner, below calendar) ── */
        .hold-requests-luxury { margin-top: 20px; }
        .hold-req-label {
          display:        flex;
          align-items:    center;
          gap:            8px;
          font-size:      0.62rem;
          font-weight:    600;
          color:          #C9A84C;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom:  12px;
        }
        .hold-req-count {
          background:  #1C2B4A;
          color:       #C9A84C;
          border-radius: 99px;
          padding:     1px 7px;
          font-size:   0.6rem;
        }
        .hold-req-line {
          flex:       1;
          height:     0.5px;
          background: linear-gradient(90deg,rgba(201,168,76,.4),transparent);
        }
        .hold-req-list { display:flex; flex-direction:column; gap:10px; }
        .hold-req-card {
          background:    #fff;
          border:        1px solid rgba(201,168,76,.2);
          border-radius: 14px;
          overflow:      hidden;
          box-shadow:    0 2px 10px rgba(28,43,74,.06);
          transition:    box-shadow .2s;
        }
        .hold-req-card:hover { box-shadow: 0 4px 18px rgba(28,43,74,.10); }
        .hold-req-card--urgent {
          border-color: rgba(120,48,63,.3);
          background:   rgba(120,48,63,.02);
        }

        /* Top row */
        .hold-req-top {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         12px 14px 8px;
          border-bottom:   0.5px solid rgba(28,43,74,.06);
        }
        .hold-req-sale {
          display:     flex;
          align-items: center;
          gap:         10px;
        }
        .hold-req-sale-avatar {
          width:           32px; height: 32px;
          border-radius:   50%;
          background:      linear-gradient(135deg,#1C2B4A,#2E4270);
          color:           #C9A84C;
          display:         flex;
          align-items:     center;
          justify-content: center;
          font-family:     Georgia,serif;
          font-style:      italic;
          font-size:       0.9rem;
          flex-shrink:     0;
        }
        .hold-req-sale-name {
          font-size:   0.82rem;
          font-weight: 600;
          color:       #1C2B4A;
        }
        .hold-req-sale-phone {
          font-size:       0.72rem;
          color:           #8B6914;
          text-decoration: none;
          font-weight:     500;
          display:         block;
          margin-top:      1px;
        }
        .hold-req-sale-phone:hover { text-decoration: underline; }
        .hold-req-timer {
          font-size:   0.72rem;
          font-weight: 600;
          color:       #8B6914;
          background:  rgba(201,168,76,.1);
          border:      1px solid rgba(201,168,76,.25);
          border-radius: 99px;
          padding:     3px 10px;
          white-space: nowrap;
        }
        .hold-req-timer--urgent {
          color:       #78303F;
          background:  rgba(120,48,63,.08);
          border-color:rgba(120,48,63,.25);
        }

        /* Body */
        .hold-req-body {
          padding:  8px 14px 10px;
          display:  flex;
          flex-direction: column;
          gap:      4px;
        }
        .hold-req-villa {
          font-family: Georgia,serif;
          font-style:  italic;
          font-size:   0.88rem;
          color:       #1C2B4A;
        }
        .hold-req-dates {
          font-size:   0.75rem;
          color:       #8A8F9A;
          display:     flex;
          align-items: center;
          flex-wrap:   wrap;
          gap:         4px;
        }
        .hold-req-price {
          font-family: Georgia,serif;
          font-style:  italic;
          color:       #1C2B4A;
          font-size:   0.82rem;
        }
        .hold-req-sep { opacity:.4; }
        .hold-req-guest {
          font-size:   0.75rem;
          color:       #4A5568;
          font-weight: 500;
        }

        /* Actions */
        .hold-req-actions {
          display:     flex;
          gap:         8px;
          padding:     10px 14px;
          border-top:  0.5px solid rgba(28,43,74,.06);
          background:  rgba(247,245,240,.6);
        }
        .hold-req-btn {
          flex:            1;
          display:         flex;
          align-items:     center;
          justify-content: center;
          gap:             6px;
          height:          36px;
          border-radius:   10px;
          border:          none;
          font-size:       0.82rem;
          font-weight:     600;
          cursor:          pointer;
          transition:      opacity .15s, transform .1s;
          letter-spacing:  0.02em;
        }
        .hold-req-btn:hover:not(:disabled)  { opacity:.88; transform:translateY(-1px); }
        .hold-req-btn:disabled { opacity:.5; cursor:not-allowed; }
        .hold-req-btn--reject {
          background: rgba(120,48,63,.08);
          color:      #78303F;
          border:     1px solid rgba(120,48,63,.2);
        }
        .hold-req-btn--approve {
          background: #1C2B4A;
          color:      #fff;
        }
        .hold-req-btn--approve:hover:not(:disabled) { background: #2E4270; }

        /* ── Hold Success Popup ── */
        .hold-success-overlay {
          position:        fixed;
          inset:           0;
          background:      rgba(28,43,74,.45);
          backdrop-filter: blur(4px);
          z-index:         1000;
          display:         flex;
          align-items:     center;
          justify-content: center;
          padding:         24px;
          animation:       fadeIn .2s ease;
        }
        .hold-success-box {
          background:    #FAFAF8;
          border-radius: 20px;
          padding:       32px 24px 24px;
          max-width:     340px;
          width:         100%;
          text-align:    center;
          box-shadow:    0 16px 48px rgba(28,43,74,.18);
          animation:     slideUp .25s ease;
        }
        .hold-success-icon {
          font-size:     3rem;
          margin-bottom: 12px;
          line-height:   1;
        }
        .hold-success-title {
          font-family:   Georgia, serif;
          font-style:    italic;
          font-size:     1.2rem;
          font-weight:   400;
          color:         #1C2B4A;
          margin:        0 0 6px;
        }
        .hold-success-villa {
          font-size:     0.8rem;
          font-weight:   600;
          color:         #C9A84C;
          letter-spacing:0.04em;
          text-transform:uppercase;
          margin-bottom: 10px;
        }
        .hold-success-no-hotline {
          font-size:   0.78rem;
          color:       #8A8F9A;
          margin:      0 0 16px;
          font-style:  italic;
        }
        .hold-success-note {
          font-size:     0.83rem;
          color:         #8A8F9A;
          line-height:   1.6;
          margin:        0 0 16px;
        }
        .hold-success-hotline {
          display:         inline-flex;
          align-items:     center;
          gap:             6px;
          padding:         8px 20px;
          background:      rgba(201,168,76,.1);
          border:          1px solid rgba(201,168,76,.35);
          border-radius:   99px;
          color:           #8B6914;
          font-size:       0.9rem;
          font-weight:     600;
          text-decoration: none;
          margin-bottom:   16px;
          transition:      background .15s;
        }
        .hold-success-hotline:hover { background: rgba(201,168,76,.2); }
        .hold-success-btn {
          display:      block;
          width:        100%;
          padding:      12px;
          background:   #1C2B4A;
          color:        white;
          border:       none;
          border-radius:12px;
          font-size:    0.9rem;
          font-weight:  500;
          cursor:       pointer;
          transition:   opacity .15s;
          letter-spacing: 0.02em;
        }
        .hold-success-btn:hover { opacity: .88; }

        /* ── Detail modal ── */
        .modal-detail {
          max-width:  820px;
          max-height: 88vh;
          overflow-y: auto;
          width:      95vw;
        }
        .detail-gallery {
          display:               grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap:                   6px;
          padding:               16px 16px 0;
        }
        .detail-gallery-cell {
          position:      relative;
          height:        140px;
          border-radius: var(--radius-md);
          overflow:      hidden;
          background:    var(--sage-pale);
        }
        .detail-gallery-cell img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .25s; }
        .detail-gallery-cell:hover img { transform: scale(1.04); }
        .detail-img-dl {
          position:absolute; bottom:6px; right:6px;
          background:rgba(0,0,0,.55); color:white;
          border-radius:99px; width:28px; height:28px;
          display:flex; align-items:center; justify-content:center;
          font-size:0.8rem; text-decoration:none;
          opacity:0; transition:opacity .15s;
        }
        .detail-gallery-cell:hover .detail-img-dl { opacity:1; }
        .detail-section { display:flex; flex-direction:column; gap:12px; }
        .detail-section-title {
          font-size:0.78rem; font-weight:700; text-transform:uppercase;
          letter-spacing:0.05em; color:var(--ink-muted);
          padding-bottom:8px; border-bottom:1px solid var(--sage-pale);
        }
        .detail-status-row { display:flex; align-items:center; justify-content:space-between; gap:12px; }
        .detail-status-badge {
          display:flex; align-items:center; gap:6px;
          font-size:0.82rem; font-weight:600; color:#2e7d52;
          background:#e8f5ee; padding:5px 12px; border-radius:99px;
        }
        .detail-status-dot { width:8px; height:8px; border-radius:50%; background:#4caf7d; }
        .detail-price { font-size:1.3rem; font-weight:700; color:var(--forest); font-family:var(--font-display); }
        .detail-meta-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:12px; }
        .detail-meta-item { display:flex; align-items:flex-start; gap:10px; }
        .detail-meta-icon { font-size:1.2rem; margin-top:1px; flex-shrink:0; }
        .detail-meta-label { font-size:0.7rem; color:var(--ink-muted); font-weight:600; text-transform:uppercase; letter-spacing:0.04em; }
        .detail-meta-val { font-size:0.88rem; color:var(--ink); font-weight:500; margin-top:2px; }
        .detail-amenities { display:flex; flex-wrap:wrap; gap:8px; }
        .detail-amenity-chip {
          display:flex; align-items:center; gap:6px;
          padding:7px 14px; background:var(--sage-pale);
          border:1px solid rgba(180,212,195,.4); border-radius:var(--radius-md);
          font-size:0.82rem; color:var(--forest-deep); font-weight:500;
        }
        .detail-description { font-size:0.9rem; color:var(--ink); line-height:1.7; white-space:pre-wrap; }
        .btn-download {
          padding:7px 14px; background:var(--forest); color:white;
          border-radius:var(--radius-md); font-size:0.8rem; font-weight:600;
          text-decoration:none; transition:background .15s;
          display:inline-flex; align-items:center; gap:5px;
        }
        .btn-download:hover { background:var(--forest-deep); }

        /* ── Zoom hint on gallery ── */
        .detail-img-zoom {
          position:absolute; bottom:6px; right:6px;
          background:rgba(0,0,0,.45); color:white;
          border-radius:99px; width:26px; height:26px;
          display:flex; align-items:center; justify-content:center;
          font-size:0.75rem; opacity:0; transition:opacity .15s;
        }
        .detail-gallery-cell:hover .detail-img-zoom { opacity:1; }

        /* ── Lightbox ── */
        .lb-overlay {
          position:fixed; inset:0; background:rgba(0,0,0,.92);
          z-index:99999; display:flex; align-items:center; justify-content:center;
          animation:fadeIn .15s ease;
        }
        .lb-img-wrap { max-width:92vw; max-height:80vh; display:flex; align-items:center; justify-content:center; }
        .lb-img { max-width:92vw; max-height:80vh; object-fit:contain; border-radius:8px; animation:lbIn .2s ease; user-select:none; }
        @keyframes lbIn { from{opacity:0;transform:scale(.95);} to{opacity:1;transform:scale(1);} }
        .lb-close {
          position:absolute; top:16px; right:16px;
          background:rgba(255,255,255,.15); border:none; color:white;
          font-size:2rem; width:44px; height:44px; border-radius:50%;
          cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:2;
          transition:background .12s;
        }
        .lb-close:hover { background:rgba(255,255,255,.3); }
        .lb-counter {
          position:absolute; top:20px; left:50%; transform:translateX(-50%);
          color:rgba(255,255,255,.85); font-size:0.82rem; font-weight:600;
          background:rgba(0,0,0,.4); padding:4px 12px; border-radius:99px;
        }
        .lb-nav {
          position:absolute; top:50%; transform:translateY(-50%);
          background:rgba(255,255,255,.15); border:none; color:white;
          font-size:2.5rem; width:48px; height:48px; border-radius:50%;
          cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:2;
          transition:background .12s;
        }
        .lb-nav:hover { background:rgba(255,255,255,.3); }
        .lb-prev { left:12px; } .lb-next { right:12px; }
        .lb-dots { position:absolute; bottom:60px; left:50%; transform:translateX(-50%); display:flex; gap:6px; }
        .lb-dot { width:8px; height:8px; border-radius:50%; background:rgba(255,255,255,.35); border:none; cursor:pointer; padding:0; transition:background .15s,transform .15s; }
        .lb-dot--active { background:white; transform:scale(1.3); }
        .lb-download {
          position:absolute; bottom:16px; right:16px;
          background:rgba(255,255,255,.15); color:white;
          padding:8px 16px; border-radius:99px; font-size:0.78rem; font-weight:600; text-decoration:none;
          transition:background .12s;
        }
        .lb-download:hover { background:rgba(255,255,255,.3); }
        @media (max-width:768px) {
          .lb-prev{left:6px;width:40px;height:40px;font-size:2rem;}
          .lb-next{right:6px;width:40px;height:40px;font-size:2rem;}
          .lb-img-wrap{max-width:100vw;}
          .lb-img{max-width:100vw;border-radius:0;}
        }

      `}</style>
    </div>
  );
}
