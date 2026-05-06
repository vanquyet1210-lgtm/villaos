'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/Calendar.tsx                       ║
// ║  Agoda overlay: bar xuyên suốt, total+tick cuối bar 1 lần  ║
// ╚══════════════════════════════════════════════════════════════╝

import { useMemo, useCallback } from 'react';
import {
  addDays, dateRange,
  prevMonth, nextMonth, formatMonthYear,
  daysInMonth, firstDayOfMonth, todayISO,
} from '@/lib/utils';
import { CONFIG }          from '@/lib/config';
import type { Booking }    from '@/types/database';

// ── Public types ──────────────────────────────────────────────────

export interface BarSegment {
  bkId:       string;
  status:     string;
  customer:   string;
  fullName:   string;
  saleLabel?: string;
  phone?:     string;
  total:      number;
  checkin:    string;
  checkout:   string;
  type:       'booking' | 'locked';
}

export interface CalendarProps {
  bookings:      Booking[];
  villaId:       string;
  lockedDates?:  string[];
  month:         number;
  year:          number;
  onMonthChange: (year: number, month: number) => void;
  onDayClick?:   (dateStr: string, info: BarSegment | null) => void;
  role?:         'owner' | 'sale' | 'customer' | 'admin';
  readonly?:     boolean;
}

// ── Colors ────────────────────────────────────────────────────────

const C = {
  confirmed: { bg: '#fde8e8', bar: '#e57373' },
  hold:      { bg: '#fef6e4', bar: '#f0b429' },
  locked:    { bg: '#dde8e3', bar: '#7aaba3' },
};
const col = (s?: string) => s === 'hold' ? C.hold : s === 'locked' ? C.locked : C.confirmed;

// ── Constants ─────────────────────────────────────────────────────

const CELL_H   = 72;   // px — height của 1 ô ngày
const BAR_T    = 26;   // px từ top ô đến top bar đầu tiên
const BAR_H    = 20;   // px chiều cao bar
const BAR_GAP  = 3;    // px khoảng cách giữa 2 bar chồng nhau
const BAR_R    = 7;    // px border-radius đầu/cuối bar

// ── Build click map ───────────────────────────────────────────────

interface ClickEntry {
  seg:        BarSegment;
  isCheckout: boolean;
}

function buildClickMap(
  bookings:    Booking[],
  villaId:     string,
  lockedDates: string[],
): Record<string, ClickEntry> {
  const now = Date.now();
  const map: Record<string, ClickEntry> = {};

  const addRange = (seg: BarSegment, ci: string, co: string) => {
    let d = ci;
    while (d <= co) {
      map[d] = { seg, isCheckout: d === co };
      d = addDays(d, 1);
    }
  };

  // Bookings
  for (const b of bookings) {
    if (b.villaId !== villaId || b.status === 'cancelled') continue;
    if (b.status === 'hold' && b.holdExpiresAt) {
      if (new Date(b.holdExpiresAt).getTime() < now) continue;
    }
    const ci = b.checkin.split('T')[0];
    const co = b.checkout.split('T')[0];
    const seg: BarSegment = {
      bkId:      b.id,
      status:    b.status,
      customer:  (b.customer ?? '').split(' ').pop() ?? '',
      fullName:  b.customer ?? '',
      saleLabel: (b as any).createdByRole === 'sale' && (b as any).createdByName
        ? `${(b as any).createdByName}${(b as any).createdByPhone ? ' • ' + (b as any).createdByPhone : ''}`
        : undefined,
      phone:     b.phone ?? '',
      total:     b.total ?? 0,
      checkin:   ci,
      checkout:  co,
      type:      'booking',
    };
    addRange(seg, ci, co);
  }

  // Locked dates — gộp các đêm liên tiếp thành 1 range để hiển thị gọn
  // Range [start, end] = đêm start đến đêm end đều bị khóa
  // → thanh từ nửa phải ngày start đến nửa trái ngày (end+1)
  if (lockedDates.length) {
    const sorted = [...lockedDates].map(d => d.split('T')[0]).sort();
    let start = sorted[0], end = sorted[0];
    const flush = () => {
      const co = addDays(end, 1);
      const seg: BarSegment = {
        bkId: `lock-${start}`, status: 'locked',
        customer: '🔒', fullName: 'Ngày khóa',
        total: 0, checkin: start, checkout: co, type: 'locked',
      };
      addRange(seg, start, co);
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === addDays(end, 1)) { end = sorted[i]; }
      else { flush(); start = sorted[i]; end = sorted[i]; }
    }
    flush();
  }

  return map;
}

// ── Build bar render list ─────────────────────────────────────────
// Mỗi booking → 1+ "bar pieces" (bị cắt khi xuống hàng mới)
// Mỗi piece có: row, colStart, colEnd, leftOffset, rightOffset (px fraction)

interface BarPiece {
  key:       string;
  row:       number;
  colStart:  number;       // 0..6
  colEnd:    number;       // 0..6
  leftFrac:  number;       // 0..1 — phần trăm trong cột bắt đầu
  rightFrac: number;       // 0..1 — phần trăm trong cột cuối (từ phải)
  isFirst:   boolean;      // rounded left
  isLast:    boolean;      // rounded right
  seg:       BarSegment;
  slot:      number;       // 0,1,2... — vị trí vertical trong row (để stack)
}

function buildBarPieces(
  bookings:    Booking[],
  villaId:     string,
  lockedDates: string[],
  year:        number,
  month:       number,
  totalDays:   number,
  startDay:    number,    // firstDayOfMonth
): BarPiece[] {
  const pieces: BarPiece[] = [];
  const now      = Date.now();
  const monthPad = String(month + 1).padStart(2, '0');
  const mStart   = `${year}-${monthPad}-01`;
  const mEnd     = `${year}-${monthPad}-${String(totalDays).padStart(2,'0')}`;

  const addPieces = (seg: BarSegment, ci: string, co: string, keyPrefix: string) => {
    // Clamp to month
    const visStart = ci < mStart ? mStart : ci;
    const visEnd   = co > mEnd   ? mEnd   : co;
    if (visStart > visEnd) return;

    const startDay2 = parseInt(visStart.split('-')[2], 10);
    const endDay    = parseInt(visEnd.split('-')[2],   10);
    const startGI   = startDay + startDay2 - 1;
    const endGI     = startDay + endDay   - 1;

    let cur = startGI;
    let pieceIdx = 0;

    while (cur <= endGI) {
      const row    = Math.floor(cur / 7);
      const rowEnd = row * 7 + 6;
      const segEnd = Math.min(endGI, rowEnd);

      const colStart = cur % 7;
      const colEnd   = segEnd % 7;
      const isFirstSeg = cur === startGI;
      const isLastSeg  = segEnd === endGI;

      // Checkin bắt đầu tại 5/8 ô (62.5% từ trái)
      // Checkout kết thúc tại 2/8 ô (25% từ trái → rightFrac = 1 - 2/8 = 6/8 = 0.75)
      // → khoảng trống rõ ràng giữa các bar liền nhau
      const leftFrac  = isFirstSeg && visStart === ci ? (5/8) : 0;
      const rightFrac = isLastSeg  && visEnd   === co ? (6/8) : 0;

      pieces.push({
        key:      `${keyPrefix}-${pieceIdx}`,
        row, colStart, colEnd,
        leftFrac, rightFrac,
        isFirst:  isFirstSeg && visStart === ci,
        isLast:   isLastSeg  && visEnd   === co,
        seg,
        slot:     0,   // assigned later
      });

      cur = segEnd + 1;
      pieceIdx++;
    }
  };

  // Bookings
  for (const b of bookings) {
    if (b.villaId !== villaId || b.status === 'cancelled') continue;
    if (b.status === 'hold' && b.holdExpiresAt) {
      if (new Date(b.holdExpiresAt).getTime() < now) continue;
    }
    const ci = b.checkin.split('T')[0];
    const co = b.checkout.split('T')[0];
    const seg: BarSegment = {
      bkId:      b.id,
      status:    b.status,
      customer:  (b.customer ?? '').split(' ').pop() ?? '',
      fullName:  b.customer ?? '',
      saleLabel: (b as any).createdByRole === 'sale' && (b as any).createdByName
        ? `${(b as any).createdByName}${(b as any).createdByPhone ? ' • ' + (b as any).createdByPhone : ''}`
        : undefined,
      phone:     b.phone ?? '',
      total:     b.total ?? 0,
      checkin:   ci,
      checkout:  co,
      type:      'booking',
    };
    addPieces(seg, ci, co, `bk-${b.id}`);
  }

  // Locked — gộp các đêm liên tiếp thành 1 range để hiển thị gọn
  if (lockedDates.length) {
    const sorted = [...lockedDates].map(d => d.split('T')[0]).sort();
    let start = sorted[0], end = sorted[0];
    let lockIdx = 0;
    const flush = () => {
      const co = addDays(end, 1);
      const seg: BarSegment = {
        bkId: `lock-${lockIdx}`, status: 'locked',
        customer: '🔒', fullName: 'Ngày khóa',
        total: 0, checkin: start, checkout: co, type: 'locked',
      };
      addPieces(seg, start, co, `lock-${lockIdx}`);
      lockIdx++;
    };
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === addDays(end, 1)) { end = sorted[i]; }
      else { flush(); start = sorted[i]; end = sorted[i]; }
    }
    flush();
  }

  // Assign vertical slots per row — mỗi piece được assign độc lập theo từng row
  // Hai bar cùng row cần slot khác nhau khi chúng overlap về cột
  // Nếu không overlap (vd: booking kết thúc ngày T2, booking mới bắt đầu ngày T3)
  // → cả 2 dùng slot 0, nằm cùng hàng, không lãng phí slot
  pieces.sort((a, b) => a.row !== b.row ? a.row - b.row : a.colStart - b.colStart);

  const rowSlots: Record<number, Array<{ start: number; end: number; slot: number }>> = {};
  for (const p of pieces) {
    if (!rowSlots[p.row]) rowSlots[p.row] = [];
    const existing = rowSlots[p.row];
    const pStart = p.colStart + p.leftFrac;
    const pEnd   = p.colEnd + 1 - p.rightFrac;
    // Tìm slot thấp nhất không bị overlap trong row này
    let assigned = 0;
    let found = false;
    while (!found) {
      // Hai bar tiếp giáp kiểu Agoda: bar A kết thúc ở cột N+0.5, bar B bắt đầu ở cột N+0.5
      // Bar A kết thúc tại cột N + 2/8, bar B bắt đầu tại cột N + 5/8
      // → không overlap (5/8 > 2/8) → dùng ngưỡng 0.3 để không tính là overlap
      const conflicts = existing.filter(e => e.slot === assigned &&
        pStart < e.end - 0.3 && pEnd > e.start + 0.3
      );
      if (conflicts.length === 0) found = true;
      else assigned++;
    }
    existing.push({ start: pStart, end: pEnd, slot: assigned });
    p.slot = assigned;
  }

  return pieces;
}

// ── Main component ────────────────────────────────────────────────

export default function Calendar({
  bookings, villaId, lockedDates = [],
  month, year, onMonthChange, onDayClick, readonly = false,
}: CalendarProps) {
  const today     = todayISO();
  const totalDays = daysInMonth(year, month);
  const startDay  = firstDayOfMonth(year, month);
  const monthPad  = String(month + 1).padStart(2, '0');
  const rowCount  = Math.ceil((startDay + totalDays) / 7);

  const clickMap = useMemo(
    () => buildClickMap(bookings, villaId, lockedDates),
    [bookings, villaId, lockedDates],
  );

  const pieces = useMemo(
    () => buildBarPieces(bookings, villaId, lockedDates, year, month, totalDays, startDay),
    [bookings, villaId, lockedDates, year, month, totalDays, startDay],
  );

  const handlePrev = useCallback(() => {
    const { year: y, month: m } = prevMonth(year, month);
    onMonthChange(y, m);
  }, [year, month, onMonthChange]);

  const handleNext = useCallback(() => {
    const { year: y, month: m } = nextMonth(year, month);
    onMonthChange(y, m);
  }, [year, month, onMonthChange]);

  const handleDayClick = useCallback((ds: string) => {
    if (readonly || ds < today) return;
    const entry = clickMap[ds];
    if (!entry) { onDayClick?.(ds, null); return; }
    // Checkout day → nửa phải trống → tạo mới
    if (entry.isCheckout) { onDayClick?.(ds, null); return; }
    onDayClick?.(ds, entry.seg);
  }, [readonly, today, clickMap, onDayClick]);

  // ── Render bar pieces ────────────────────────────────────────────
  const renderBars = () => pieces.map(p => {
    const { key, row, colStart, colEnd, leftFrac, rightFrac, isFirst, isLast, seg } = p;
    const c = col(seg.status);

    // left  = (colStart + leftFrac)  / 7 * 100%
    // right = (7 - colEnd - 1 + rightFrac) / 7 * 100%  →  (6 - colEnd + rightFrac) / 7 * 100%
    const leftPct  = ((colStart + leftFrac)      / 7) * 100;
    const rightPct = ((6 - colEnd + rightFrac)   / 7) * 100;
    const topPx    = row * CELL_H + BAR_T + p.slot * (BAR_H + BAR_GAP);

    const label = p.seg.saleLabel ?? p.seg.fullName ?? p.seg.customer;

    return (
      <div
        key={key}
        style={{
          position:     'absolute',
          top:          topPx,
          height:       BAR_H,
          left:         `${leftPct}%`,
          right:        `${rightPct}%`,
          background:   c.bar,
          backgroundImage: 'repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0px,rgba(255,255,255,.07) 3px,transparent 3px,transparent 9px)',
          borderRadius: `${isFirst ? BAR_R : 0}px ${isLast ? BAR_R : 0}px ${isLast ? BAR_R : 0}px ${isFirst ? BAR_R : 0}px`,
          zIndex:       10,
          pointerEvents:'none',
          overflow:     'hidden',
          display:      'flex',
          alignItems:   'center',
          minWidth:     0,
        }}
      >
        {/* Tên khách: chỉ ở piece đầu tiên */}
        {isFirst && label && (
          <span style={{
            paddingLeft:  6,
            paddingRight: isLast ? 56 : 4,
            fontSize:     '0.64rem',
            fontWeight:   700,
            color:        '#fff',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            flex:         1,
            lineHeight:   1.15,
          }}>
            {label}
            {seg.phone && (
              <span style={{ opacity: .85, fontWeight: 400, marginLeft: 3 }}>
                · {seg.phone}
              </span>
            )}
          </span>
        )}

        {/* Total + tick: CHỈ ở piece cuối cùng, căn phải */}
        {isLast && seg.total > 0 && (
          <span style={{
            position:    'absolute',
            right:       5,
            display:     'flex',
            alignItems:  'center',
            gap:         3,
            flexShrink:  0,
          }}>
            <span style={{
              fontSize:   '0.59rem',
              fontWeight: 700,
              color:      '#fff',
              whiteSpace: 'nowrap',
            }}>
              {new Intl.NumberFormat('vi-VN', {
                notation:             'compact',
                maximumFractionDigits: 0,
              }).format(seg.total)}đ
            </span>
            {seg.status === 'confirmed' && (
              <span style={{
                width:          15, height: 15,
                borderRadius:   '50%',
                background:     '#2e7d52',
                border:         '1.5px solid rgba(255,255,255,.9)',
                display:        'inline-flex',
                alignItems:     'center',
                justifyContent: 'center',
                flexShrink:     0,
              }}>
                <svg width="7" height="7" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 3" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            )}
          </span>
        )}
      </div>
    );
  });

  // ── Render background tints (nền nhẹ đằng sau bar) ───────────────
  const renderBgTints = () => pieces
    .filter(p => p.isFirst) // 1 tint per booking (across all rows)
    .flatMap(p => {
      // Render tint cho mỗi piece của booking này
      const allPieces = pieces.filter(q => q.seg.bkId === p.seg.bkId);
      return allPieces.map(q => {
        const c = col(q.seg.status);
        const leftPct  = ((q.colStart + q.leftFrac)  / 7) * 100;
        const rightPct = ((6 - q.colEnd + q.rightFrac) / 7) * 100;
        return (
          <div key={`tint-${q.key}`} style={{
            position:      'absolute',
            top:           q.row * CELL_H + BAR_T + q.slot * (BAR_H + BAR_GAP) - 2,
            height:        BAR_H + 4,
            left:          `${leftPct}%`,
            right:         `${rightPct}%`,
            background:    c.bg,
            zIndex:        1,
            pointerEvents: 'none',
          }} />
        );
      });
    });

  return (
    <div className="cal-wrap">
      {/* ── Header ── */}
      <div className="cal-head">
        <button className="cal-nav" onClick={handlePrev}>‹</button>
        <span className="cal-title">{formatMonthYear(year, month)}</span>
        <button className="cal-nav" onClick={handleNext}>›</button>
      </div>

      {/* ── Day names ── */}
      <div className="cal-dow">
        {CONFIG.DAY_NAMES.map(d => <div key={d} className="cal-dow-cell">{d}</div>)}
      </div>

      {/* ── Grid: cells + absolute bars ── */}
      <div
        className="cal-grid"
        style={{ height: rowCount * CELL_H, position: 'relative' }}
      >
        {/* Background tints (z:1) */}
        {renderBgTints()}

        {/* Day cells (z:5) — transparent background, số ngày on top */}
        <div className="cal-cells">
          {Array.from({ length: startDay }).map((_, i) => (
            <div key={`e${i}`} className="cal-cell cal-cell-empty" />
          ))}
          {Array.from({ length: totalDays }).map((_, i) => {
            const day = i + 1;
            const ds  = `${year}-${monthPad}-${String(day).padStart(2,'0')}`;
            const isPast    = ds < today;
            const isToday   = ds === today;
            const entry     = clickMap[ds];
            const clickable = !readonly && !isPast && (!entry || entry.isCheckout);
            return (
              <div
                key={ds}
                className={[
                  'cal-cell',
                  isPast   ? 'cal-cell-past'  : '',
                  !clickable && entry && !entry.isCheckout && entry.seg.status !== 'locked' ? 'cal-cell-busy' : '',
                  !clickable && entry && !entry.isCheckout && entry.seg.status === 'locked' ? 'cal-cell-locked' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleDayClick(ds)}
                style={{ cursor: clickable || (entry && !entry.isCheckout) ? 'pointer' : 'default' }}
              >
                <span className={`cal-dn${isToday ? ' cal-dn-today' : ''}`}>{day}</span>
              </div>
            );
          })}
        </div>

        {/* Bar overlays (z:10) — on top of everything */}
        {renderBars()}
      </div>

      {/* ── Legend ── */}
      <div className="cal-legend">
        {[
          { label: 'Đã đặt',    bg: C.confirmed.bg, border: C.confirmed.bar },
          { label: 'Đang giữ',  bg: C.hold.bg,      border: C.hold.bar },
          { label: 'Ngày khóa', bg: C.locked.bg,    border: C.locked.bar },
        ].map(({ label, bg, border }) => (
          <span key={label} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: bg, border: `1.5px solid ${border}` }} />
            {label}
          </span>
        ))}
      </div>

      <style>{`
        .cal-wrap {
          background:    var(--white);
          border-radius: var(--radius-lg);
          border:        1px solid rgba(180,212,195,.3);
          overflow:      hidden;
          user-select:   none;
        }
        .cal-head {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         14px 16px;
          border-bottom:   1px solid var(--sage-pale);
          background:      var(--parchment);
        }
        .cal-title {
          font-family: var(--font-display);
          font-size:   1rem;
          color:       var(--forest-deep);
          font-weight: 600;
        }
        .cal-nav {
          background:      none;
          border:          1.5px solid var(--stone);
          border-radius:   var(--radius-sm);
          width: 32px; height: 32px;
          font-size:       1.2rem;
          cursor:          pointer;
          color:           var(--ink);
          display:         flex;
          align-items:     center;
          justify-content: center;
          transition:      background .12s, border-color .12s;
        }
        .cal-nav:hover { background: var(--sage-pale); border-color: var(--sage); }

        .cal-dow {
          display:               grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-bottom:         1px solid var(--sage-pale);
        }
        .cal-dow-cell {
          text-align:     center;
          font-size:      0.68rem;
          font-weight:    700;
          color:          var(--ink-muted);
          padding:        6px 0;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* Grid: position relative, chiều cao cố định = rowCount * CELL_H */
        .cal-grid {
          background: var(--white);
          overflow:   hidden;
        }

        /* Cell layer */
        .cal-cells {
          position:              absolute;
          inset:                 0;
          display:               grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          grid-auto-rows:        ${CELL_H}px;
          z-index:               5;
        }

        .cal-cell {
          position:        relative;
          display:         flex;
          flex-direction:  column;
          align-items:     center;
          justify-content: flex-start;
          padding-top:     5px;
          border:          1px solid rgba(180,212,195,.15);
          background:      transparent;
          transition:      background .1s;
          overflow:        visible;
        }
        /* Chỉ hover trên ô trống — không hover ô có booking/khóa */
        .cal-cell:hover:not(.cal-cell-past):not(.cal-cell-busy):not(.cal-cell-empty):not(.cal-cell-locked) {
          background: rgba(180,212,195,.12);
        }
        .cal-cell-empty { pointer-events: none; border-color: transparent; }
        .cal-cell-past  { opacity: .45; pointer-events: none; }
        .cal-cell-busy  { cursor: default; }

        .cal-dn {
          font-size:     0.78rem;
          font-weight:   600;
          color:         var(--ink);
          line-height:   22px;
          min-width:     22px;
          text-align:    center;
          border-radius: 50%;
          position:      relative;
          z-index:       8;        /* trên bar */
          background:    transparent;
        }
        .cal-dn-today {
          background: var(--forest);
          color:      var(--white);
          width:  22px; height: 22px;
          display:        flex;
          align-items:    center;
          justify-content:center;
        }

        .cal-legend {
          display:    flex;
          gap:        16px;
          padding:    10px 16px;
          border-top: 1px solid var(--sage-pale);
          background: var(--parchment);
          flex-wrap:  wrap;
        }
        .cal-legend-item {
          display:     flex;
          align-items: center;
          gap:         6px;
          font-size:   0.75rem;
          color:       var(--ink-muted);
        }
        .cal-legend-dot {
          width: 12px; height: 12px;
          border-radius: 3px;
          flex-shrink:   0;
        }

        @media (max-width: 600px) {
          .cal-dn { font-size: 0.68rem; }
        }
      `}</style>
    </div>
  );
}
