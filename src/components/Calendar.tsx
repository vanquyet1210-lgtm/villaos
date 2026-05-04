'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/Calendar.tsx                       ║
// ║  Port từ calendar.js — Agoda-style calendar engine          ║
// ║  Pure React, không dùng external calendar lib               ║
// ╚══════════════════════════════════════════════════════════════╝

import { useMemo, useCallback } from 'react';
import {
  addDays, dateRange,
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
  customer?:      string;   // tên rút gọn khách
  fullName?:      string;
  saleLabel?:     string;   // "Tên Sale • 0974950440" — hiển thị trên bar
  status?:        string;
  bkId?:          string;
  rightCustomer?: string;
  rightSaleLabel?:string;
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

// ── Color helpers — theo spec màu sắc chuẩn ───────────────────────
// Confirmed: nền #fde8e8 · bar #e57373
// Hold:      nền #fef6e4 · bar #f0b429
// Locked:    nền #dde8e3 · bar #7aaba3

function bgOf(status?: string): string {
  if (status === 'hold')   return '#fef6e4';
  if (status === 'locked') return '#dde8e3';
  return '#fde8e8'; // confirmed
}

function barOf(status?: string): string {
  if (status === 'hold')   return '#f0b429';
  if (status === 'locked') return '#7aaba3';
  return '#e57373'; // confirmed
}

function textOf(status?: string): string {
  if (status === 'hold')   return '#b8860b';
  if (status === 'locked') return '#4a7a72';
  return '#c0392b'; // confirmed
}

// ── Build DayMap ──────────────────────────────────────────────────

function buildDayMap(
  bookings:    Booking[],
  villaId:     string,
  lockedDates: string[],
): DayMap {
  const map: DayMap = {};

  // 1. Booking segments
  // Lọc bỏ hold đã hết hạn (không hiển thị trên lịch, coi như trống)
  const now = Date.now();
  const relevant = bookings.filter(b => {
    if (b.villaId !== villaId) return false;
    if (b.status === 'cancelled') return false;
    // Hold hết hạn → ẩn khỏi lịch (tự động coi như trống)
    if (b.status === 'hold' && b.holdExpiresAt) {
      const expires = new Date(b.holdExpiresAt).getTime();
      if (expires < now) return false;
    }
    return true;
  });

  for (const b of relevant) {
    // ── Sanitize to date-only (fix UTC timezone shift from Supabase timestamptz) ──
    const ci = b.checkin.split('T')[0];
    const co = b.checkout.split('T')[0];
    const { customer, status, id: bkId, createdByRole, createdByName, createdByPhone } = b;
    const shortName = customer ? customer.split(' ').pop() ?? customer : '';
    // Bar label: nếu sale tạo → hiển thị tên sale + SĐT sale thay vì tên khách
    const saleLabel = createdByRole === 'sale' && createdByName
      ? `${createdByName}${createdByPhone ? ' • ' + createdByPhone : ''}`
      : undefined;
    const info = { customer: shortName, fullName: customer, saleLabel, status, bkId };

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
  // lockedDates = mảng các đêm bị khóa (YYYY-MM-DD).
  // Gom thành các đoạn liên tiếp để hiển thị đúng:
  //   - Đầu đoạn: locked-checkin (nửa phải xanh)
  //   - Giữa đoạn: locked-middle (full xanh)  
  //   - Cuối đoạn checkout: locked-checkout (nửa trái xanh)
  if (lockedDates.length) {
    const lockInfo = { customer: '🔒', status: 'locked', isLock: true };
    const sorted = [...lockedDates].sort();

    // Gom thành đoạn liên tiếp
    const segments: { start: string; end: string }[] = [];
    let segStart = sorted[0];
    let segEnd   = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
      const expected = addDays(segEnd, 1);
      if (sorted[i] === expected) {
        segEnd = sorted[i]; // kéo dài đoạn
      } else {
        segments.push({ start: segStart, end: segEnd });
        segStart = sorted[i];
        segEnd   = sorted[i];
      }
    }
    segments.push({ start: segStart, end: segEnd });

    // Render từng đoạn
    for (const { start, end } of segments) {
      const checkoutDay = addDays(end, 1);
      if (start === end) {
        // 1 đêm: chỉ checkin + checkout
        applyLock(map, start,       'locked-checkin',  lockInfo);
        applyLock(map, checkoutDay, 'locked-checkout', lockInfo);
      } else {
        // Nhiều đêm liên tiếp
        applyLock(map, start, 'locked-checkin', lockInfo);
        // Các ngày giữa: start+1 .. end (toàn bộ ngày nằm trong đoạn lock)
        for (const ds of dateRange(addDays(start, 1), checkoutDay)) {
          applyLock(map, ds, 'locked-middle', lockInfo);
        }
        applyLock(map, checkoutDay, 'locked-checkout', lockInfo);
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

  if (!isBooking) {
    // Không có booking — ghi đè lock cũ
    map[ds] = { ...lockInfo, type: lockType };
    return;
  }

  // Booking tồn tại — split tại điểm giao
  const isCheckout = existing.type === 'checkout';
  const isCheckin  = existing.type === 'checkin';

  if ((lockType === 'locked-checkin' || lockType === 'locked-middle') && isCheckout) {
    // Lock overlap với ngày checkout booking → trái=booking checkout (1/3), phải=lock (2/3)
    map[ds] = {
      ...existing, type: 'locked-split-right',
      leftStatus:   existing.status,
      leftCustomer: existing.customer,
      isLock:       true,
    };
  } else if ((lockType === 'locked-checkout' || lockType === 'locked-middle') && isCheckin) {
    // Lock overlap với ngày checkin booking → trái=lock (1/3), phải=booking (2/3)
    map[ds] = {
      ...existing, type: 'locked-split-left',
      rightCustomer: existing.customer,
      rightStatus:   existing.status,
      leftStatus:    'locked',
      isLock:        true,
    };
  }
  // Mọi trường hợp khác (middle, checkout+checkin...) → giữ nguyên booking
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

  // Segment-specific rendering — Agoda bar style
  // Bar: dải màu nằm ở giữa ô (inset 4px 0), kéo liền mạch qua các ngày
  // Tên khách: hiển thị trên bar tại ô checkin (z-index cao hơn bar)
  // Màu nền ô theo trạng thái, màu bar đậm hơn để tạo độ tương phản
  const renderSegment = () => {
    if (!info) return null;

    const { type, customer, status, rightCustomer, rightStatus,
            leftStatus, saleLabel, rightSaleLabel } = info;
    // Bar hiển thị: ưu tiên saleLabel (tên sale + SĐT), fallback sang tên khách
    const barLabel        = saleLabel ?? customer;
    const rightBarLabel   = rightSaleLabel ?? rightCustomer;
    const bg     = bgOf(status);
    const bar    = barOf(status);
    const txt    = textOf(status);

    // Bar height: dải nằm giữa ô, cao 20px
    const BAR_TOP    = '24px';
    const BAR_HEIGHT = '26px';

    // Helper: render bar strip + optional name label
    const Strip = ({
      left = '0', right = '0', color = bar,
      roundLeft = false, roundRight = false,
      label, labelColor = '#fff',
    }: {
      left?: string; right?: string; color?: string;
      roundLeft?: boolean; roundRight?: boolean;
      label?: string; labelColor?: string;
    }) => (
      <>
        {/* Nền ô */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: color === bar ? bg : bgOf(leftStatus ?? status),
          pointerEvents: 'none',
        }} />
        {/* Bar strip */}
        <div style={{
          position: 'absolute',
          top: BAR_TOP, height: BAR_HEIGHT,
          left, right,
          background: color,
          borderRadius: `${roundLeft ? '10px' : '0'} ${roundRight ? '10px' : '0'} ${roundRight ? '10px' : '0'} ${roundLeft ? '10px' : '0'}`,
          zIndex: 2,
          pointerEvents: 'none',
        }} />
        {/* Tên khách trên bar */}
        {label && (
          <span style={{
            position: 'absolute',
            top: BAR_TOP, height: BAR_HEIGHT,
            left: '4px', right: '2px',
            zIndex: 3,
            fontSize: '0.62rem', fontWeight: 700,
            color: labelColor,
            display: 'flex', alignItems: 'center',
            overflow: 'hidden', whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            {label}
          </span>
        )}
      </>
    );

    switch (type) {

      // Checkin: nền phủ 2/3 phải, bar từ 1/3 → right
      // (khách đến buổi chiều → 2/3 ô có màu)
      case 'checkin':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(to right, transparent 33.3%, ${bg} 33.3%)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '33.3%', right: '0',
              background: bar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '10px 0 0 10px',
              zIndex: 2, pointerEvents: 'none',
            }} />
            {barLabel && (
              <span style={{
                position: 'absolute',
                top: BAR_TOP, height: BAR_HEIGHT,
                left: 'calc(33.3% + 5px)', right: '3px',
                zIndex: 3,
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
                overflow: 'hidden',
                pointerEvents: 'none',
                lineHeight: 1.2,
              }}>
                <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {info.fullName ?? barLabel}
                </span>
                {saleLabel && (
                  <span style={{ fontSize: '0.56rem', color: 'rgba(255,255,255,.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {saleLabel}
                  </span>
                )}
              </span>
            )}
          </>
        );

      // Middle: nền full, bar full width (liền mạch với ô kề)
      case 'middle':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: bg, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '0',
              background: bar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              zIndex: 2, pointerEvents: 'none',
            }} />
          </>
        );

      // Checkout: nền 1/3 trái, bar từ left → 1/3
      // (khách trả phòng buổi sáng → chỉ 1/3 ô có màu)
      case 'checkout':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(to left, transparent 66.7%, ${bg} 66.7%)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '66.7%',
              background: bar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '0 10px 10px 0',
              zIndex: 2, pointerEvents: 'none',
            } />
          </>
        );

      // checkout+checkin: split — trái checkout 1/3, phải checkin 2/3
      case 'checkout+checkin': {
        const lBar = barOf(leftStatus);
        const rBg  = bgOf(rightStatus);
        const rBar = barOf(rightStatus);
        return (
          <>
            {/* Nền split: checkout 1/3 | checkin 2/3 */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(to right, ${bgOf(leftStatus)} 33.3%, ${rBg} 33.3%)`,
              pointerEvents: 'none',
            }} />
            {/* Bar trái checkout → 1/3 */}
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '66.7%',
              background: lBar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '0 10px 10px 0',
              zIndex: 2, pointerEvents: 'none',
            }} />
            {/* Bar phải checkin → 2/3 */}
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '33.3%', right: '0',
              background: rBar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '10px 0 0 10px',
              zIndex: 2, pointerEvents: 'none',
            }} />
            {rightBarLabel && (
              <span style={{
                position: 'absolute',
                top: BAR_TOP, height: BAR_HEIGHT,
                left: 'calc(33.3% + 4px)', right: '2px',
                zIndex: 3, fontSize: '0.62rem', fontWeight: 700,
                color: '#fff', display: 'flex', alignItems: 'center',
                overflow: 'hidden', whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {rightBarLabel}
              </span>
            )}
          </>
        );
      }

      // Locked checkin: nền xanh mint nửa phải, bar xanh từ giữa
      case 'locked-checkin':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'linear-gradient(to right, transparent 33.3%, #dde8e3 33.3%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '33.3%', right: '0',
              background: '#7aaba3',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '10px 0 0 10px',
              zIndex: 2, pointerEvents: 'none',
            } />
            <span style={
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: 'calc(33.3% + 4px)', right: '2px',
              zIndex: 3, fontSize: '0.6rem',
              color: '#fff', display: 'flex', alignItems: 'center',
              pointerEvents: 'none',
            }}>🔒</span>
          </>
        );

      case 'locked-middle':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: '#dde8e3', pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '0',
              background: '#7aaba3',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              zIndex: 2, pointerEvents: 'none',
            } />
          </>
        );

      case 'locked-checkout':
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: 'linear-gradient(to left, transparent 66.7%, #dde8e3 66.7%)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '66.7%',
              background: '#7aaba3',
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '0 10px 10px 0',
              zIndex: 2, pointerEvents: 'none',
            } />
          </>
        );

      // locked-split-left: trái=lock, phải=booking checkin
      case 'locked-split-left': {
        const rBar = barOf(rightStatus);
        const rBg  = bgOf(rightStatus);
        const rc   = info.rightCustomer ?? customer;
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(to right, #dde8e3 33.3%, ${rBg} 33.3%)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '66.7%',
              background: '#7aaba3',
              borderRadius: '0 10px 10px 0',
              zIndex: 2, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '33.3%', right: '0',
              background: rBar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '10px 0 0 10px',
              zIndex: 2, pointerEvents: 'none',
            }} />
            {rc && (
              <span style={{
                position: 'absolute',
                top: BAR_TOP, height: BAR_HEIGHT,
                left: 'calc(33.3% + 4px)', right: '2px',
                zIndex: 3, fontSize: '0.62rem', fontWeight: 700,
                color: '#fff', display: 'flex', alignItems: 'center',
                overflow: 'hidden', whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {rc}
              </span>
            )}
          </>
        );
      }

      // locked-split-right: trái=booking checkout, phải=lock
      case 'locked-split-right': {
        const lBar = barOf(leftStatus);
        const lBg  = bgOf(leftStatus);
        return (
          <>
            <div style={{
              position: 'absolute', inset: 0, zIndex: 1,
              background: `linear-gradient(to right, ${lBg} 33.3%, #dde8e3 33.3%)`,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '0', right: '66.7%',
              background: lBar,
              backgroundImage: 'repeating-linear-gradient(135deg, rgba(255,255,255,.08) 0px, rgba(255,255,255,.08) 3px, transparent 3px, transparent 9px)',
              borderRadius: '0 10px 10px 0',
              zIndex: 2, pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute',
              top: BAR_TOP, height: BAR_HEIGHT,
              left: '33.3%', right: '0',
              background: '#7aaba3',
              borderRadius: '10px 0 0 10px',
              zIndex: 2, pointerEvents: 'none',
            }} />
          </>
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
          <span className="cal-legend-dot" style={{ background: '#fde8e8', border: '1.5px solid #e57373' }} />
          Confirmed
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#fef6e4', border: '1.5px solid #f0b429' }} />
          Hold
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: '#dde8e3', border: '1.5px solid #7aaba3' }} />
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
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap:                   0;
          padding:               6px 2px;
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
          min-height:     68px;
          border-radius:  6px;
          overflow:       visible;
          display:        flex;
          flex-direction: column;
          align-items:    center;
          justify-content: flex-start;
          padding-top:    6px;
          transition:     opacity .1s, background .1s;
          border:         1px solid rgba(180,212,195,.18);
          margin:         1px;
          min-width:      0; /* prevent bar overflow on mobile */
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
