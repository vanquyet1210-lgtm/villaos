'use client';
// VillaOS v7 — app/customer/villas/CustomerBookingButton.tsx
import { useState, useTransition } from 'react';
import { useRouter }    from 'next/navigation';
import { useToast }     from '@/components/Toast';
import { createBooking } from '@/lib/services/booking.service';
import { validateBooking } from '@/lib/validators';
import { fmtMoney, calcTotal, calcNights, addDays, todayISO, formatDate } from '@/lib/utils';

interface Props {
  villa: { id: string; name: string; price: number; lockedDates: string[] };
}

export default function CustomerBookingButton({ villa }: Props) {
  const [open, setOpen]       = useState(false);
  const [isPending, start]    = useTransition();
  const { show } = useToast();
  const router   = useRouter();

  const [checkin,  setCheckin]  = useState('');
  const [checkout, setCheckout] = useState('');
  const [note,     setNote]     = useState('');
  const [error,    setError]    = useState<string | null>(null);

  const nights = (checkin && checkout) ? calcNights(checkin, checkout) : 0;
  const total  = nights * villa.price;

  function handleBook() {
    setError(null);
    const errs = validateBooking(
      { villaId: villa.id, checkin, checkout },
      [], [{ id: villa.id, lockedDates: villa.lockedDates }],
      'customer',
    );
    if (errs.length) { setError(errs[0].msg); return; }

    start(async () => {
      const result = await createBooking({
        villaId:  villa.id,
        customer: 'Khách đặt online',
        checkin, checkout,
        status:  'confirmed',
        total:   calcTotal(checkin, checkout, villa.price),
        note,
      });
      if (result.error) { setError(result.error); return; }
      show('success', '🎉 Đặt phòng thành công!', `${villa.name} · ${formatDate(checkin)} → ${formatDate(checkout)}`);
      setOpen(false); setCheckin(''); setCheckout(''); setNote('');
      router.push('/customer/bookings');
    });
  }

  return (
    <>
      <button className="btn-primary" style={{ width:'100%', marginTop:4 }} onClick={() => setOpen(true)}>
        📅 Đặt phòng ngay
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 Đặt phòng — {villa.name}</h3>
              <button className="modal-close" onClick={() => setOpen(false)}>×</button>
            </div>
            <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:14 }}>
              <div style={{ display:'flex', gap:12 }}>
                <div className="field-group" style={{ flex:1 }}>
                  <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>Check-in</label>
                  <input type="date" value={checkin} min={todayISO()} onChange={e => setCheckin(e.target.value)}
                    style={{ padding:'9px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', width:'100%' }} />
                </div>
                <div className="field-group" style={{ flex:1 }}>
                  <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>Check-out</label>
                  <input type="date" value={checkout} min={checkin ? addDays(checkin,1) : todayISO()} onChange={e => setCheckout(e.target.value)}
                    style={{ padding:'9px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', width:'100%' }} />
                </div>
              </div>

              {nights > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 16px', background:'var(--sage-pale)', borderRadius:'var(--radius-md)', fontWeight:600 }}>
                  <span>🌙 {nights} đêm</span>
                  <span style={{ color:'var(--forest)', fontSize:'1.05rem' }}>💰 {fmtMoney(total)}</span>
                </div>
              )}

              <div className="field-group">
                <label style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--forest)', textTransform:'uppercase' }}>Ghi chú (tùy chọn)</label>
                <textarea value={note} onChange={e => setNote(e.target.value)}
                  placeholder="Yêu cầu đặc biệt, số người, ..." rows={2}
                  style={{ width:'100%', padding:'8px 12px', border:'1.5px solid var(--stone)', borderRadius:'var(--radius-md)', fontFamily:'var(--font-body)', resize:'vertical' }} />
              </div>

              {error && <div className="auth-alert error">❌ {error}</div>}

              <div style={{ padding:'10px 14px', background:'var(--parchment)', borderRadius:'var(--radius-md)', fontSize:'0.78rem', color:'var(--ink-muted)' }}>
                💡 Đặt phòng sẽ được xác nhận ngay. Chúng tôi sẽ liên hệ để xác nhận chi tiết.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setOpen(false)}>Hủy</button>
              <button className="btn-primary" onClick={handleBook} disabled={isPending || !checkin || !checkout}>
                {isPending ? 'Đang đặt...' : '🎉 Xác nhận đặt phòng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
