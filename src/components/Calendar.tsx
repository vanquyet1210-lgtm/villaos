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
  fmtMoney,
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
  role?:           'owner' | 'sale' | 'customer' | 'admin';
  readonly?:       boolean;
  hotline?:        string;
  highlightEmpty?: boolean;
  onToggleEmpty?:  (val: boolean) => void;
}

// ── Colors — luxury navy / gold / slate ──────────────────────────

const C = {
  confirmed: { bg: 'rgba(28,43,74,.08)',   bar: '#1C2B4A' },  // Navy — đã đặt
  hold:      { bg: 'rgba(201,168,76,.12)', bar: '#C9A84C' },  // Gold — đang giữ
  locked:    { bg: 'rgba(120,47,64,.10)',  bar: '#78303F' },  // Burgundy wine — ngày khóa
};
const col = (s?: string) => s === 'hold' ? C.hold : s === 'locked' ? C.locked : C.confirmed;

// ── Constants ─────────────────────────────────────────────────────

const CELL_H   = 53;   // px — height của 1 ô ngày (thấp hơn)
const BAR_T    = 26;   // px từ top ô đến top bar (giữ nguyên)
const BAR_H    = 16;   // px chiều cao bar
const BAR_GAP  = 3;    // px khoảng cách giữa 2 bar chồng nhau
const BAR_R    = 6;    // px border-radius đầu/cuối bar

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

  // ── PASS 1: Bookings ──────────────────────────────────────────
  // Chỉ mark các ngày từ checkin đến checkout-1 (middle nights)
  // checkout day KHÔNG mark ở đây → để trống cho booking mới có thể checkin
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

    // Mark checkin day — ghi đè kể cả locked
    map[ci] = { seg, isCheckout: false };

    // Mark middle days (fully occupied)
    let d = addDays(ci, 1);
    while (d < co) {
      map[d] = { seg, isCheckout: false };
      d = addDays(d, 1);
    }

    // Checkout day KHÔNG mark vào clickMap
    // → ngày đó hoàn toàn tự do, click sẽ mở create modal
    // Bar nửa trái chỉ là visual, không block action
  }

  // ── PASS 2: Locked dates ──────────────────────────────────────
  // Locked dates CHỈ mark ngày nếu ngày đó CHƯA có booking
  // → không ghi đè booking lên locked
  if (lockedDates.length) {
    const sorted = [...lockedDates].map(d => d.split('T')[0]).sort();
    let start = sorted[0], end = sorted[0];
    const flush = () => {
      const co = addDays(end, 1); // checkout ngày của lock = end+1
      const seg: BarSegment = {
        bkId: `lock-${start}`, status: 'locked',
        customer: '🔒', fullName: 'Ngày khóa',
        total: 0, checkin: start, checkout: co, type: 'locked',
      };
      // Chỉ mark các đêm bị khóa (start..end)
      // co = end+1 là ngày tự do → KHÔNG mark (tránh nhầm với booking checkin cùng ngày)
      let d = start;
      while (d <= end) {
        // Locked ghi đè booking checkout, nhưng KHÔNG ghi đè booking checkin/middle
        const existing = map[d];
        if (!existing || existing.isCheckout) {
          map[d] = { seg, isCheckout: false };
        }
        d = addDays(d, 1);
      }
      // KHÔNG mark map[co] — ngày co hoàn toàn tự do
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

      // leftFrac: 0.35 nếu là ô checkin thật
      const leftFrac = isFirstSeg && visStart === ci ? 0.30 : 0;
      // rightFrac: checkout half
      // - booking: kết thúc tại 30% từ trái → rightFrac = 0.70
      // - locked:  kết thúc tại 25% từ trái → rightFrac = 0.75
      const isCheckoutCell = isLastSeg && visEnd === co;
      const rightFrac = isCheckoutCell
        ? 0.75 // tất cả đều kết thúc tại 25% (1 - 0.75)
        : 0;

      // Guard: nếu cùng 1 ô mà leftFrac + rightFrac >= 1 → bar âm → bỏ qua
      // Trường hợp này xảy ra khi ci === co (1 ô vừa checkin vừa checkout)
      // → render như 1 ô full không có half
      const effectiveLeft  = leftFrac;
      const effectiveRight = (colStart === colEnd && leftFrac + rightFrac >= 1) ? 0 : rightFrac;

      pieces.push({
        key:      `${keyPrefix}-${pieceIdx}`,
        row, colStart, colEnd,
        leftFrac:  effectiveLeft,
        rightFrac: effectiveRight,
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
      // Locked bar: từ nửa phải start đến HẾT end (không sang ngày end+1)
      // Dùng co = addDays(end, 1) nhưng rightFrac sẽ = 0 (full right)
      // Trick: set checkout = addDays(end,1) nhưng addPieces sẽ clamp đúng
      // Thực ra: locked bar KHÔNG có checkout-half → checkin=start, checkout=end+1
      // nhưng addPieces phải biết không vẽ half cho ngày end+1
      // Fix đơn giản: checkout = end (ngày cuối bị khóa), rightFrac=0 (kéo full)
      const co = addDays(end, 1); // bar kết thúc tại 25% ngày end+1
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
      // Bar A kết thúc tại cột N+0.25, bar B bắt đầu tại cột N+0.30
      // → khoảng trống 0.05 → dùng ngưỡng 0.1 để không tính là overlap
      const conflicts = existing.filter(e => e.slot === assigned &&
        pStart < e.end - 0.1 && pEnd > e.start + 0.1
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
  hotline, role, highlightEmpty = false, onToggleEmpty,
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

    const isSaleView = role === 'sale';
    const label = p.seg.saleLabel ?? p.seg.fullName ?? p.seg.customer;
    // full pill radius
    const rL = isFirst ? BAR_H / 2 : 0;
    const rR = isLast  ? BAR_H / 2 : 0;

    // luxury gradient per status
    const gradMap: Record<string, string> = {
      confirmed: 'linear-gradient(90deg, #1C2B4A 0%, #2E4270 100%)',
      hold:      'linear-gradient(90deg, #B8922A 0%, #D4AA55 100%)',
      locked:    'linear-gradient(90deg, #78303F 0%, #9B4455 100%)',
    };
    const barGrad = gradMap[seg.status] ?? gradMap.confirmed;

    return (
      <div
        key={key}
        style={{
          position:       'absolute',
          top:            topPx,
          height:         BAR_H,
          left:           `${leftPct}%`,
          right:          `${rightPct}%`,
          background:     barGrad,
          borderRadius:   `${rL}px ${rR}px ${rR}px ${rL}px`,
          zIndex:         10,
          pointerEvents:  'none',
          overflow:       'hidden',
          display:        'flex',
          alignItems:     'center',
          justifyContent: isSaleView ? 'center' : 'flex-start',
          minWidth:       0,
          opacity:        highlightEmpty ? 0.2 : 1,
          filter:         highlightEmpty ? 'grayscale(50%)' : 'none',
          transition:     'opacity .25s, filter .25s',
          boxShadow:      '0 1px 4px rgba(0,0,0,.18)',
        }}
      >
        {/* SALE VIEW: dấu chấm trắng nhỏ tinh tế */}
        {isSaleView && isFirst && (
          <span style={{
            width:        5, height: 5,
            borderRadius: '50%',
            background:   'rgba(255,255,255,0.85)',
            flexShrink:   0,
          }} />
        )}

        {/* OWNER/ADMIN VIEW: tên khách + số điện thoại */}
        {!isSaleView && isFirst && label && (
          <span style={{
            paddingLeft:  8,
            paddingRight: isLast ? 60 : 4,
            fontSize:     '0.62rem',
            fontWeight:   500,
            color:        'rgba(255,255,255,.92)',
            whiteSpace:   'nowrap',
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            flex:         1,
            lineHeight:   1.15,
            letterSpacing:'0.01em',
          }}>
            {label}
            {seg.phone && (
              <span style={{ opacity:.7, fontWeight:400, marginLeft:3 }}>
                · {seg.phone}
              </span>
            )}
          </span>
        )}

        {/* OWNER/ADMIN VIEW: total ở cuối bar */}
        {!isSaleView && isLast && seg.total > 0 && (
          <span style={{
            position:   'absolute', right: 6,
            display:    'flex', alignItems: 'center', gap: 3, flexShrink: 0,
          }}>
            <span style={{ fontSize:'0.58rem', fontWeight:600, color:'rgba(255,255,255,.9)', whiteSpace:'nowrap', letterSpacing:'0.02em' }}>
              {seg.total.toLocaleString('vi-VN')}đ
            </span>
            {seg.status === 'confirmed' && (
              <span style={{
                width:13, height:13, borderRadius:'50%',
                background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,.5)',
                display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0,
              }}>
                <svg width="6" height="6" viewBox="0 0 10 10" fill="none">
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
            top:           q.row * CELL_H + BAR_T + q.slot * (BAR_H + BAR_GAP),
            height:        BAR_H,
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
        <button className="cal-nav" onClick={handlePrev} aria-label="Tháng trước">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M7 1L1 7l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <span className="cal-title">{formatMonthYear(year, month)}</span>
        <button className="cal-nav" onClick={handleNext} aria-label="Tháng sau">
          <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
            <path d="M1 1l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
            const isEmpty   = !isPast && (!entry || entry.isCheckout);
            const dimCell   = highlightEmpty && !isEmpty;
            const glowCell  = highlightEmpty && isEmpty && !isPast;
            return (
              <div
                key={ds}
                className={[
                  'cal-cell',
                  isPast   ? 'cal-cell-past'  : '',
                  entry && !entry.isCheckout && entry.seg.status !== 'locked' ? 'cal-cell-busy' : '',
                  entry && !entry.isCheckout && entry.seg.status === 'locked' ? 'cal-cell-locked' : '',
                  entry && entry.isCheckout   ? 'cal-cell-checkout' : '',
                ].filter(Boolean).join(' ')}
                onClick={() => handleDayClick(ds)}
                style={{
                  cursor:     clickable || (entry && !entry.isCheckout) ? 'pointer' : 'default',
                  opacity:    dimCell ? 0.22 : 1,
                  background: glowCell ? 'rgba(201,168,76,.10)' : undefined,
                  boxShadow:  glowCell ? 'inset 0 0 0 1.5px rgba(201,168,76,.50)' : undefined,
                  transition: 'opacity .2s, background .2s, box-shadow .2s',
                  filter:     dimCell ? 'grayscale(60%)' : 'none',
                }}
              >
                <span className={[
                  'cal-dn',
                  isToday  ? 'cal-dn-today' : '',
                  glowCell ? 'cal-dn-empty' : '',
                ].filter(Boolean).join(' ')}>{day}</span>
              </div>
            );
          })}
        </div>

        {/* Bar overlays (z:10) — on top of everything */}
        {renderBars()}
      </div>

      {/* ── Legend + Hotline ── */}
      <div className="cal-legend">
        {/* Góc trái: pill toggle Ngày trống (chỉ sale) */}
        {role === 'sale' && onToggleEmpty && (
          <button
            className={`cal-empty-pill${highlightEmpty ? ' cal-empty-pill--on' : ''}`}
            onClick={() => onToggleEmpty(!highlightEmpty)}
          >
            <span>Ngày trống</span>
            <span className={`cal-toggle-mini${highlightEmpty ? ' cal-toggle-mini--on' : ''}`}>
              <span className="cal-toggle-mini-knob" />
            </span>
          </button>
        )}
        {/* Spacer */}
        <span style={{ flex: 1 }} />
        {/* Góc phải: legend màu */}
        {[
          { label: 'Đã đặt',    color: C.confirmed.bar },
          { label: 'Đang giữ',  color: C.hold.bar },
          { label: 'Ngày khóa', color: C.locked.bar },
        ].map(({ label, color }) => (
          <span key={label} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>

      <style>{`
        /* ── Luxury Calendar ── */
        .cal-wrap {
          background:    #FAFAF8;
          border-radius: 16px;
          border:        1px solid rgba(28,43,74,.10);
          box-shadow:    0 4px 24px rgba(28,43,74,.07);
          overflow:      hidden;
          user-select:   none;
        }

        /* Header */
        .cal-head {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         16px 20px;
          border-bottom:   1px solid rgba(28,43,74,.07);
          background:      #FAFAF8;
        }
        .cal-title {
          font-family: Georgia, 'Times New Roman', serif;
          font-size:   1.05rem;
          font-style:  italic;
          font-weight: 400;
          color:       #1C2B4A;
          letter-spacing: 0.02em;
        }
        .cal-nav {
          background:      transparent;
          border:          1px solid rgba(28,43,74,.18);
          border-radius:   50%;
          width:  30px; height: 30px;
          cursor:          pointer;
          color:           #1C2B4A;
          display:         flex;
          align-items:     center;
          justify-content: center;
          transition:      background .15s, border-color .15s;
          flex-shrink:     0;
        }
        .cal-nav:hover {
          background:    rgba(28,43,74,.06);
          border-color:  rgba(28,43,74,.35);
        }

        /* Day names */
        .cal-dow {
          display:               grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          border-bottom:         1px solid rgba(28,43,74,.06);
          background:            #F5F4F0;
        }
        .cal-dow-cell {
          text-align:     center;
          font-size:      0.6rem;
          font-weight:    600;
          color:          #8A8F9A;
          padding:        7px 0;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        /* Grid */
        .cal-grid { background: #FAFAF8; overflow: hidden; }
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
          padding-top:     4px;
          border-right:    1px solid rgba(28,43,74,.05);
          border-bottom:   1px solid rgba(28,43,74,.05);
          background:      transparent;
          transition:      background .12s;
          overflow:        visible;
        }
        .cal-cell:hover:not(.cal-cell-past):not(.cal-cell-busy):not(.cal-cell-empty):not(.cal-cell-locked):not(.cal-cell-checkout) {
          background: rgba(201,168,76,.06);
        }
        .cal-cell-empty  { pointer-events: none; border-color: transparent; }
        .cal-cell-past   { opacity: .35; pointer-events: none; }
        .cal-cell-busy   { cursor: default; }

        /* Day number — keep size, lighter weight */
        .cal-dn {
          font-size:     0.78rem;
          font-weight:   300;
          color:         #1C2B4A;
          line-height:   22px;
          min-width:     22px;
          text-align:    center;
          border-radius: 50%;
          position:      relative;
          z-index:       8;
          background:    transparent;
          letter-spacing: 0.01em;
        }
        .cal-dn-today {
          background: #C9A84C;
          color:      #fff;
          width:  22px; height: 22px;
          display:         flex;
          align-items:     center;
          justify-content: center;
          font-weight:     500;
        }
        .cal-dn-empty {
          color:       #C9A84C;
          font-weight: 500;
        }

        /* Legend */
        .cal-legend {
          display:     flex;
          align-items: center;
          gap:         10px;
          padding:     10px 16px;
          border-top:  1px solid rgba(28,43,74,.07);
          background:  #F5F4F0;
          flex-wrap:   nowrap;
          overflow:    hidden;
        }
        .cal-legend-item {
          display:        flex;
          align-items:    center;
          gap:            5px;
          font-size:      0.62rem;
          color:          #8A8F9A;
          white-space:    nowrap;
          flex-shrink:    0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .cal-legend-dot {
          width:         7px; height: 7px;
          border-radius: 50%;
          flex-shrink:   0;
        }

        /* Pill toggle Ngày trống */
        .cal-empty-pill {
          display:        flex;
          align-items:    center;
          gap:            7px;
          background:     rgba(28,43,74,.06);
          border:         1px solid rgba(28,43,74,.12);
          border-radius:  20px;
          padding:        3px 10px;
          cursor:         pointer;
          font-size:      0.62rem;
          font-weight:    500;
          color:          #8A8F9A;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          transition:     color .15s, border-color .15s;
          white-space:    nowrap;
          flex-shrink:    0;
          user-select:    none;
          height:         24px;
        }
        .cal-empty-pill--on {
          color:        #1C2B4A;
          border-color: rgba(201,168,76,.5);
          background:   rgba(201,168,76,.08);
        }
        .cal-empty-pill:hover { background: rgba(28,43,74,.1); }

        /* Toggle mini knob */
        .cal-toggle-mini {
          position:      relative;
          display:       inline-flex;
          align-items:   center;
          width:         26px; height: 14px;
          border-radius: 7px;
          background:    rgba(0,0,0,.15);
          transition:    background .2s;
          flex-shrink:   0;
        }
        .cal-toggle-mini--on { background: #C9A84C; }
        .cal-toggle-mini-knob {
          position:      absolute;
          left:          2px;
          width:         10px; height: 10px;
          border-radius: 50%;
          background:    white;
          box-shadow:    0 1px 3px rgba(0,0,0,.2);
          transition:    left .18s;
        }
        .cal-toggle-mini--on .cal-toggle-mini-knob { left: 14px; }

        @media (max-width: 600px) {
          .cal-dn { font-size: 0.72rem; }
          .cal-title { font-size: 0.95rem; }
        }
      `}</style>
    </div>
  );
}
