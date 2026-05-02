'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/Calendar.tsx                       ║
// ║  Port từ calendar.js — Agoda-style calendar engine          ║
// ║  Pure React, không dùng external calendar lib               ║
// ╚══════════════════════════════════════════════════════════════╝

import { useMemo, useCallback } from 'react';
import {
  addDays, dateRange, groupConsecutiveDates,
  prevMonth, nextMonth, formatMonthYear,
  daysInMonth, firstDayOfMonth, todayISO,
} from '@/lib/utils';
import { CONFIG } from '@/lib/config';
import type { Booking } from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────

type SegmentType =
  | 'checkin' | 'middle' | 'checkout' | 'checkout+checkin'
  | 'locked-checkin' | 'locked-middle' | 'locked-checkout'
  | 'locked-split-left' | 'locked-split-right';

interface DayInfo {
  type:           SegmentType;
  customer?:      string;
  fullName?:      string;
  status?:        string;
  bkId?:          string;
  rightCustomer?: string;
  rightStatus?:   string;
  rightBkId?:     string;
  leftStatus?:    string;
  leftCustomer?:  string;
  isLock?:        boolean;
}

type DayMap = Record<string, DayInfo>;

export interface CalendarProps {
  /** Bookings để render lên lịch */
  bookings:    Booking[];
  /** ID villa đang xem */
  villaId:     string;
  /** Ngày bị khóa (owner set) */
  lockedDates?: string[];
  /** Tháng đang hiển thị (0-indexed) */
  month:       number;
  /** Năm đang hiển thị */
  year:        number;
  /** Callback khi bấm prev/next tháng */
  onMonthChange: (year: number, month: number) => void;
  /** Callback khi click vào 1 ngày */
  onDayClick?:   (dateStr: string, info: DayInfo | null) => void;
  /** Role hiện tại — ảnh hưởng đến hiển thị */
  role?: 'owner' | 'sale' | 'customer' | 'admin';
  /** Có cho phép click hay không */
  readonly?: boolean;
}

// ── Color helpers ─────────────────────────────────────────────────

function bgOf(status?: string): string {
  if (status === 'hold')   return 'var(--amber-light)';
  if (status === 'locked') return '#dde8e3';
  return 'var(--red-light)';
}

function textOf(status?: string): string {
  if (status === 'hold')   return 'var(--amber)';
  if (status === 'locked') return 'var(--ink-light)';
  return 'var(--red)';
}

// ── Build DayMap ──────────────────────────────────────────────────

function buildDayMap(
  bookings:    Booking[],
  villaId:     string,
  lockedDates: string[],
): DayMap {
  const map: DayMap = {};

  // 1. Booking segments
  const relevant = bookings.filter(
    b => b.villaId === villaId && b.status !== 'cancelled'
  );

  for (const b of relevant) {
    // ── Sanitize to date-only (fix UTC timezone shift from Supabase timestamptz) ──
    const ci = b.checkin.split('T')[0];
    const co = b.checkout.split('T')[0];
    const { customer, status, id: bkId } = b;
    const shortName = customer ? customer.split(' ').pop() ?? customer : '';
    const info = { customer: shortName, fullName: customer, status, bkId };

    // checkin day → right half colored (guest arrives, morning is free)
    if (!map[ci]) {
      map[ci] = { ...info, type: 'checkin' };
    } else if (map[ci].type === 'checkout') {
      // same day: previous checkout + this checkin → split cell
      map[ci] = {
        type:          'checkout+checkin',
        customer:      map[ci].customer,
        fullName:      map[ci].fullName,
        status:        map[ci].status,
        bkId:          map[ci].bkId,
        rightCustomer: shortName,
        rightStatus:   status,
        rightBkId:     bkId,
        leftStatus:    map[ci].status,
        leftCustomer:  map[ci].customer,
      };
    }

    // middle days: ci+1 .. co-1 (fully occupied nights)
    // dateRange is half-open [start, end), so dateRange(ci+1, co) = ci+1..co-1 ✓
    const midRange = dateRange(addDays(ci, 1), co);
    for (const ds of midRange) {
      if (!map[ds]) map[ds] = { ...info, type: 'middle' };
    }

    // checkout day → left half colored (guest leaves morning, evening is free)
    // This day CAN be re-booked (new checkin on same day = checkout+checkin split)
    if (!map[co]) {
      map[co] = { ...info, type: 'checkout' };
    } else if (map[co].type === 'checkin') {
      // New booking checks in same day this one checks out → split
      map[co] = {
        type:          'checkout+checkin',
        customer:      map[co].customer,
        fullName:      map[co].fullName,
        status:        map[co].status,
        bkId:          map[co].bkId,
        rightCustomer: map[co].customer,
        rightStatus:   map[co].status,
        rightBkId:     map[co].bkId,
        leftStatus:    status,
        leftCustomer:  shortName,
      };
    }
  }

  // 2. Locked-date segments
  // lockedDates là mảng các ngày (đêm) bị khóa — mỗi phần tử là 1 đêm bị block.
  // Hiển thị giống booking: segment đầu = checkin-half, giữa = middle, cuối = checkout-half của ngày TIẾP THEO.
  if (lockedDates.length) {
    const sorted   = [...lockedDates].sort();
    const segments = groupConsecutiveDates(sorted);
    const lockInfo = { customer: '🔒', status: 'locked', isLock: true };

    for (const { start, last } of segments) {
      // Các ngày bị lock là đêm: start → last (inclusive nights)
      // → hiển thị: nửa phải ngày start (checkin), các ngày giữa (middle), nửa trái ngày (last+1) (checkout)
      const checkoutDs = addDays(last, 1); // ngày "trả phòng" = hôm sau ngày lock cuối

      if (start === last) {
        // Chỉ 1 đêm bị lock: nửa phải ngày start + nửa trái ngày start+1
        applyLock(map, start,      'locked-checkin',  lockInfo);
        applyLock(map, checkoutDs, 'locked-checkout', lockInfo);
      } else {
        // Nhiều đêm liên tiếp:
        applyLock(map, start, 'locked-checkin', lockInfo);
        // Các ngày giữa: start+1 → last (toàn bộ ngày, vì đêm đó bị lock)
        for (const ds of dateRange(addDays(start, 1), addDays(last, 1))) {
          applyLock(map, ds, 'locked-middle', lockInfo);
        }
        applyLock(map, checkoutDs, 'locked-checkout', lockInfo);
      }
    }
  }

  return map;
}

function applyLock(
  map:      DayMap,
  ds:       string,
  lockType: SegmentType,
  lockInfo: { customer: string; status: string; isLock: boolean },
) {
  if (!map[ds]) { map[ds] = { ...lockInfo, type: lockType }; return; }

  const existing = map[ds];
  const isBooking = ['checkin','checkout','middle','checkout+checkin'].includes(existing.type);

  if (isBooking) {
    if ((lockType === 'locked-checkout' || lockType === 'locked-middle') && existing.type === 'checkin') {
      map[ds] = {
        ...existing, type: 'locked-split-left',
        rightCustomer: existing.customer,
        rightStatus:   existing.status,
        leftStatus:    'locked',
      };
    } else if (lockType === 'locked-checkin' && existing.type === 'checkout') {
      map[ds] = {
        ...existing, type: 'locked-split-right',
        leftStatus:   existing.status,
        leftCustomer: existing.customer,
      };
    } else if (lockType === 'locked-checkout' && existing.type === 'middle') {
      map[ds] = {
        ...existing, type: 'locked-split-left',
        rightCustomer: existing.customer,
        rightStatus:   existing.status,
        leftStatus:    'locked',
      };
    }
  } else if (existing.isLock && lockType === 'locked-middle') {
    map[ds] = { ...lockInfo, type: 'locked-middle' };
  }
}

// ── Day Cell ──────────────────────────────────────────────────────

interface DayCellProps {
  day:      number;
  ds:       string;
  info:     DayInfo | undefined;
  today:    string;
  onClick?: (ds: string, info: DayInfo | null) => void;
  readonly: boolean;
}

function DayCell({ day, ds, info, today, onClick, readonly }: DayCellProps) {
  const isPast  = ds < today;
  const isToday = ds === today;

  const handleClick = () => {
    if (readonly || isPast) return;
    // Checkout day: click → tạo booking mới bắt đầu từ ngày đó (chiều trống)
    // locked-checkout: tương tự — nửa phải trống, có thể checkin
    if (info?.type === 'checkout' || info?.type === 'locked-checkout') {
      onClick?.(ds, null);
      return;
    }
    // checkout+checkin: đã có người checkin rồi, không cho tạo thêm
    onClick?.(ds, info ?? null);
  };

  // Base classes
  let cls = 'cal-day';
  if (isPast)    cls += ' cal-past';
  if (isToday)   cls += ' cal-today';
  if (!info && (isPast || readonly)) cls += ' cal-no-cursor';
  // Checkout day: nửa phải trống → vẫn có thể click để tạo booking mới
  const isClickable = !readonly && !isPast && (
    !info ||
    info.type === 'checkout' ||
    info.type === 'locked-checkout'
  );

  // Segment-specific rendering
  const renderSegment = () => {
    if (!info) return null;

    const { type, customer, status, rightCustomer, rightStatus,
            leftStatus, leftCustomer } = info;
    const bg  = bgOf(status);
    const txt = textOf(status);

    const segBr = (_t: string) => '0'; // bar liền mạch, không cần radius riêng

    switch (type) {

      case 'checkin':
        return (
          <>
            <div className="cal-bg" style={{
              background: `linear-gradient(to right, transparent 50%, ${bg} 50%)`,
              borderRadius: segBr('checkin'),
            }} />
            {customer && <span className="cal-name" style={{ color: txt }}>{customer}</span>}
          </>
        );

      case 'middle':
        return (
          <>
            <div className="cal-bg" style={{ background: bg, borderRadius: '0' }} />
            {customer && <span className="cal-name" style={{ color: txt }}>{customer}</span>}
          </>
        );

      case 'checkout':
        return (
          <div className="cal-bg" style={{
            background: `linear-gradient(to left, transparent 50%, ${bg} 50%)`,
            borderRadius: segBr('checkout'),
          }} />
        );

      case 'checkout+checkin': {
        const lBg  = bgOf(leftStatus);
        const rBg  = bgOf(rightStatus);
        const rTxt = textOf(rightStatus);
        return (
          <>
            <div className="cal-split">
              <div style={{ background: lBg, borderRadius: '6px 0 0 6px' }} />
              <div style={{ background: rBg, borderRadius: '0 6px 6px 0' }} />
            </div>
            {rightCustomer && (
              <span className="cal-name cal-name-right" style={{ color: rTxt }}>
                {rightCustomer}
              </span>
            )}
          </>
        );
      }

      case 'locked-checkin':
        return (
          <>
            <div className="cal-bg" style={{
              background: 'linear-gradient(to right, transparent 50%, #dde8e3 50%)',
              borderRadius: segBr('checkin'),
            }} />
            <span className="cal-name" style={{ color: 'var(--ink-light)', fontSize: '0.65rem' }}>🔒</span>
          </>
        );

      case 'locked-middle':
        return (
          <>
            <div className="cal-bg" style={{ background: '#dde8e3', borderRadius: '0' }} />
            <span className="cal-name" style={{ color: 'var(--ink-light)', fontSize: '0.65rem' }}>🔒</span>
          </>
        );

      case 'locked-checkout':
        return (
          <div className="cal-bg" style={{
            background: 'linear-gradient(to left, transparent 50%, #dde8e3 50%)',
            borderRadius: segBr('checkout'),
          }} />
        );

      case 'locked-split-left': {
        const rBg  = bgOf(rightStatus);
        const rTxt = textOf(rightStatus);
        const rc   = info.rightCustomer ?? customer;
        return (
          <>
            <div className="cal-split">
              <div style={{ background: '#dde8e3', borderRadius: '6px 0 0 6px' }} />
              <div style={{ background: rBg, borderRadius: '0 6px 6px 0' }} />
            </div>
            {rc && <span className="cal-name cal-name-right" style={{ color: rTxt }}>{rc}</span>}
          </>
        );
      }

      case 'locked-split-right': {
        const lBg = bgOf(leftStatus);
        return (
          <div className="cal-split">
            <div style={{ background: lBg, borderRadius: '6px 0 0 6px' }} />
            <div style={{ background: '#dde8e3', borderRadius: '0 6px 6px 0' }} />
          </div>
        );
      }

      default: return null;
    }
  };

  return (
    <div
      className={cls}
      onClick={handleClick}
      title={info?.fullName ?? undefined}
      style={{ cursor: isClickable ? 'pointer' : 'default' }}
    >
      {renderSegment()}
      <span className={`cal-dn${isToday ? ' cal-dn-today' : ''}`}>{day}</span>
    </div>
  );
}

// ── Main Calendar Component ───────────────────────────────────────

export default function Calendar({
  bookings,
  villaId,
  lockedDates = [],
  month,
  year,
  onMonthChange,
  onDayClick,
  readonly = false,
}: CalendarProps) {
  const today    = todayISO();
  const totalDays = daysInMonth(year, month);
  const startDay  = firstDayOfMonth(year, month);
  const monthPad  = String(month + 1).padStart(2, '0');

  const dayMap = useMemo(
    () => buildDayMap(bookings, villaId, lockedDates),
    [bookings, villaId, lockedDates],
  );

  const handlePrev = useCallback(() => {
    const { year: y, month: m } = prevMonth(year, month);
    onMonthChange(y, m);
  }, [year, month, onMonthChange]);

  const handleNext = useCallback(() => {
    const { year: y, month: m } = nextMonth(year, month);
    onMonthChange(y, m);
  }, [year, month, onMonthChange]);

  return (
    <div className="cal-wrapper">
      {/* Header */}
      <div className="cal-header">
        <button className="cal-nav-btn" onClick={handlePrev} aria-label="Tháng trước">
          ‹
        </button>
        <span className="cal-month-title">
          {formatMonthYear(year, month)}
        </span>
        <button className="cal-nav-btn" onClick={handleNext} aria-label="Tháng sau">
          ›
        </button>
      </div>

      {/* Day name headers */}
      <div className="cal-grid">
        {CONFIG.DAY_NAMES.map(dn => (
          <div key={dn} className="cal-hdr">{dn}</div>
        ))}

        {/* Empty cells before first day */}
        {Array.from({ length: startDay }).map((_, i) => (
          <div key={`empty-${i}`} className="cal-day cal-empty" />
        ))}

        {/* Day cells */}
        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const ds  = `${year}-${monthPad}-${String(day).padStart(2, '0')}`;
          return (
            <DayCell
              key={ds}
              day={day}
              ds={ds}
              info={dayMap[ds]}
              today={today}
              onClick={onDayClick}
              readonly={readonly}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: 'var(--red-light)', border: '1.5px solid var(--red)' }} />
          Đã đặt
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)' }} />
          Hold
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#dde8e3', border: '1.5px solid #a8c4b8' }} />
          Khóa
        </span>
      </div>

      <style>{`
        .cal-wrapper {
          background:    var(--white);
          border-radius: var(--radius-lg);
          border:        1px solid rgba(180,212,195,.3);
          overflow:      hidden;
          user-select:   none;
        }

        .cal-header {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         14px 16px;
          border-bottom:   1px solid var(--sage-pale);
          background:      var(--parchment);
        }

        .cal-month-title {
          font-family: var(--font-display);
          font-size:   1rem;
          color:       var(--forest-deep);
          font-weight: 600;
        }

        .cal-nav-btn {
          background:    none;
          border:        1.5px solid var(--stone);
          border-radius: var(--radius-sm);
          width:         32px;
          height:        32px;
          font-size:     1.2rem;
          line-height:   1;
          cursor:        pointer;
          color:         var(--ink);
          display:       flex;
          align-items:   center;
          justify-content: center;
          transition:    background .12s, border-color .12s;
        }

        .cal-nav-btn:hover {
          background:    var(--sage-pale);
          border-color:  var(--sage);
        }

        .cal-grid {
          display:               grid;
          grid-template-columns: repeat(7, 1fr);
          gap:                   0;
          padding:               10px 0;
          background:            var(--white);
        }

        .cal-hdr {
          text-align:     center;
          font-size:      0.68rem;
          font-weight:    700;
          color:          var(--ink-muted);
          padding:        6px 0;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .cal-day {
          position:       relative;
          min-height:     52px;
          border-radius:  0;
          overflow:       visible;
          display:        flex;
          flex-direction: column;
          align-items:    center;
          justify-content: flex-start;
          padding-top:    6px;
          transition:     opacity .1s;
        }

        .cal-day:hover:not(.cal-past):not(.cal-no-cursor) {
          background: rgba(180,212,195,.12);
        }

        .cal-day.cal-empty     { background: transparent; pointer-events: none; }
        .cal-day.cal-past      { opacity: .42; }
        .cal-day.cal-no-cursor { cursor: default !important; }

        .cal-bg {
          position:       absolute;
          inset:          4px 0;
          z-index:        1;
          pointer-events: none;
        }

        .cal-split {
          position:       absolute;
          inset:          4px 0;
          z-index:        1;
          display:        flex;
          pointer-events: none;
          overflow:       hidden;
        }

        .cal-split > div {
          flex: 1;
          height: 100%;
        }

        .cal-dn {
          font-size:   0.8rem;
          font-weight: 600;
          color:       var(--ink);
          position:    relative;
          z-index:     2;
          line-height: 22px;
          min-width:   22px;
          text-align:  center;
          border-radius: 50%;
        }

        .cal-dn-today {
          background: var(--forest);
          color:      var(--white);
          width:      22px;
          height:     22px;
          display:    flex;
          align-items: center;
          justify-content: center;
        }

        .cal-name {
          font-size:    0.65rem;
          font-weight:  600;
          position:     relative;
          z-index:      2;
          margin-top:   2px;
          max-width:    90%;
          overflow:     hidden;
          text-overflow: ellipsis;
          white-space:  nowrap;
        }

        .cal-name-right { align-self: flex-end; padding-right: 4px; }

        .cal-legend {
          display:     flex;
          gap:         16px;
          padding:     10px 16px;
          border-top:  1px solid var(--sage-pale);
          background:  var(--parchment);
        }

        .cal-legend-item {
          display:     flex;
          align-items: center;
          gap:         6px;
          font-size:   0.75rem;
          color:       var(--ink-muted);
        }

        .cal-legend-dot {
          width:         12px;
          height:        12px;
          border-radius: 3px;
          flex-shrink:   0;
        }
      `}</style>
    </div>
  );
}
