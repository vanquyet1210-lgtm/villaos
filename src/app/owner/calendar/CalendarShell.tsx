'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — app/owner/calendar/CalendarShell.tsx          ║
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

  const villa = villas.find(v => v.id === selectedVillaId) ?? villas[0];

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
  function handleDayClick(ds: string, info: { bkId?: string; type?: string } | null) {
    // Checkout day: nửa phải trống → cho tạo booking mới checkin ngày đó
    const isCheckoutOnly = info?.type === 'checkout' || info?.type === 'locked-checkout';
    if (!info || isCheckoutOnly) {
      if (ds >= todayISO()) openCreateModal(ds);
      return;
    }
    // Có booking/hold → mở modal xem
    if (info.bkId) {
      const found = bookings.find(b => b.id === info.bkId);
      if (found) { openViewModal(found); return; }
    }
    if (ds >= todayISO()) openCreateModal(ds);
  }

  // ── Create booking ─────────────────────────────────────────────
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
      {/* Villa selector */}
      {villas.length > 1 && (
        <div className="villa-selector">
          {villas.map(v => (
            <button
              key={v.id}
              className={`villa-tab${v.id === selectedVillaId ? ' active' : ''}`}
              onClick={() => setSelectedVillaId(v.id)}
            >
              {v.emoji} {v.name}
            </button>
          ))}
        </div>
      )}

      {/* Villa info bar */}
      <div className="villa-info-bar">
        <span className="villa-info-name">{villa.emoji} {villa.name}</span>
        <span className="villa-info-meta">
          🛏 {villa.bedrooms} phòng · 👥 {villa.adults} người · 💰 {fmtMoney(villa.price)}/đêm
        </span>
        <span className="booking-count">
          {bookings.filter(b => b.status !== 'cancelled').length} booking
        </span>
      </div>

      {/* Calendar */}
      <Calendar
        bookings={bookings}
        villaId={selectedVillaId}
        lockedDates={villa.lockedDates}
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
                  <h3>📅 Tạo booking mới</h3>
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
              return (
                <>
                  <div className="modal-header">
                    <h3>
                      <span className={`badge badge-${b.status}`} style={{ marginRight: 8 }}>
                        {b.status === 'confirmed' ? '✅ Confirmed' : b.status === 'hold' ? '⏳ Hold' : '❌ Cancelled'}
                      </span>
                      {b.customer}
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
                      {b.phone && (
                        <div className="booking-detail-item">
                          <span className="booking-detail-label">Điện thoại</span>
                          <span className="booking-detail-value">📞 {b.phone}</span>
                        </div>
                      )}
                      {b.email && (
                        <div className="booking-detail-item">
                          <span className="booking-detail-label">Email</span>
                          <span className="booking-detail-value">✉️ {b.email}</span>
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
                    {/* Confirm: chỉ owner/admin mới được confirm hold */}
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

        .villa-selector {
          display:   flex;
          gap:       8px;
          flex-wrap: wrap;
        }

        .villa-tab {
          padding:       8px 16px;
          border:        1.5px solid var(--stone);
          border-radius: 99px;
          background:    var(--white);
          font-family:   var(--font-body);
          font-size:     0.875rem;
          cursor:        pointer;
          transition:    all .15s;
          color:         var(--ink);
        }

        .villa-tab:hover  { border-color: var(--sage); background: var(--sage-pale); }
        .villa-tab.active {
          background:   var(--forest);
          border-color: var(--forest);
          color:        white;
          font-weight:  600;
        }

        .villa-info-bar {
          display:       flex;
          align-items:   center;
          gap:           12px;
          padding:       12px 16px;
          background:    var(--white);
          border-radius: var(--radius-md);
          border:        1px solid rgba(180,212,195,.3);
          flex-wrap:     wrap;
        }

        .villa-info-name { font-family: var(--font-display); font-size: 1rem; color: var(--forest-deep); }
        .villa-info-meta { font-size: 0.82rem; color: var(--ink-muted); flex: 1; }
        .booking-count   { font-size: 0.8rem; font-weight: 600; color: var(--forest); background: var(--sage-pale); padding: 3px 10px; border-radius: 99px; }

        .booking-summary {
          display:       flex;
          gap:           16px;
          padding:       10px 14px;
          background:    var(--sage-pale);
          border-radius: var(--radius-md);
          font-size:     0.9rem;
          font-weight:   600;
          color:         var(--forest);
        }

        .status-toggle { display: flex; gap: 8px; }
        .status-btn {
          flex: 1;
          padding:       8px 12px;
          border:        1.5px solid var(--stone);
          border-radius: var(--radius-md);
          background:    var(--white);
          font-family:   var(--font-body);
          font-size:     0.85rem;
          cursor:        pointer;
          transition:    all .15s;
          color:         var(--ink);
        }
        .status-btn.active.confirmed { background: var(--sage-pale); border-color: var(--sage); color: var(--forest); font-weight: 700; }
        .status-btn.active.hold      { background: var(--amber-light); border-color: var(--amber); color: var(--amber); font-weight: 700; }

        .booking-detail-grid {
          display:               grid;
          grid-template-columns: 1fr 1fr;
          gap:                   10px;
        }

        .booking-detail-item {
          display:        flex;
          flex-direction: column;
          gap:            2px;
          padding:        10px 12px;
          background:     var(--parchment);
          border-radius:  var(--radius-md);
        }

        .booking-detail-label { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--ink-muted); font-weight: 700; }
        .booking-detail-value { font-size: 0.9rem; color: var(--ink); }

        .form-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
        .form-row .field-group { flex: 1; min-width: 120px; }
        .field-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 12px; }
        .field-group label { font-size: 0.82rem; font-weight: 600; color: var(--forest); text-transform: uppercase; letter-spacing: 0.03em; }
        .field-group input, .field-group select {
          padding: 9px 12px; border: 1.5px solid var(--stone); border-radius: var(--radius-md);
          font-family: var(--font-body); font-size: 0.9rem; color: var(--ink);
          outline: none; transition: border-color .15s;
        }
        .field-group input:focus, .field-group select:focus { border-color: var(--sage); }
      `}</style>
    </div>
  );
}
