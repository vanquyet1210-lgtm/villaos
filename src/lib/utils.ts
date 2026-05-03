// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — lib/utils.ts                                  ║
// ║  Port từ utils.js — pure functions, zero DOM, zero side fx  ║
// ║  Dùng được cả server-side (Server Actions) và client-side   ║
// ╚══════════════════════════════════════════════════════════════╝

import { CONFIG } from './config';

// ══════════════════════════════════════════════════════════════════
// FORMATTING
// ══════════════════════════════════════════════════════════════════

/**
 * Định dạng tiền VNĐ dạng ngắn gọn.
 * @example fmtMoney(5000000) → "5 tr"
 * @example fmtMoney(500000)  → "500,000 VNĐ"
 */
export function fmtMoney(n: number): string {
  if (!n) return '0 VNĐ';
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val.toFixed(1).replace(/\.0$/, '') + ' tr';
  }
  return n.toLocaleString('vi-VN') + ' VNĐ';
}

/**
 * Định dạng ngày ISO → DD/MM/YYYY.
 * @example formatDate('2026-04-20') → "20/04/2026"
 */
export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

/**
 * Định dạng khoảng ngày: "20/04 → 23/04/2026"
 */
export function formatDateRange(checkin: string, checkout: string): string {
  if (!checkin || !checkout) return '—';
  const [cy, cm, cd] = checkin.split('-');
  const [, om, od]   = checkout.split('-');
  // Nếu cùng tháng: "20 → 23/04/2026", khác tháng: full
  if (cm === om) return `${cd} → ${od}/${om}/${cy}`;
  return `${formatDate(checkin)} → ${formatDate(checkout)}`;
}

/**
 * Tính số đêm giữa 2 ngày ISO.
 * @example calcNights('2026-04-20', '2026-04-23') → 3
 */
export function calcNights(checkin: string, checkout: string): number {
  // Dùng UTC noon để tránh timezone shift
  const ci = new Date(checkin.slice(0, 10)  + 'T12:00:00Z');
  const co = new Date(checkout.slice(0, 10) + 'T12:00:00Z');
  return Math.max(1, Math.round((co.getTime() - ci.getTime()) / 86_400_000));
}

/**
 * Tính tổng tiền = số đêm × giá mỗi đêm.
 */
export function calcTotal(checkin: string, checkout: string, pricePerNight: number): number {
  return calcNights(checkin, checkout) * pricePerNight;
}

/**
 * Lấy label tiện ích từ value.
 * @example amenityLabel('pool') → "🏊 Hồ bơi"
 */
export function amenityLabel(value: string): string {
  const preset = CONFIG.AMENITY_PRESETS.find(p => p.value === value);
  return preset ? preset.label : `✨ ${value}`;
}

/**
 * Lấy nhiều label tiện ích cùng lúc.
 */
export function amenityLabels(values: string[]): string[] {
  return values.map(amenityLabel);
}

/**
 * Random emoji villa.
 */
export function randomVillaEmoji(): string {
  const pool = CONFIG.VILLA_EMOJIS as readonly string[];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Escape HTML để tránh XSS khi dùng innerHTML (dùng trong dangerouslySetInnerHTML).
 */
export function escapeHtml(str: string): string {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

/**
 * Truncate string với ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}


// ══════════════════════════════════════════════════════════════════
// DATE HELPERS
// ══════════════════════════════════════════════════════════════════

/**
 * Ngày hôm nay dạng 'YYYY-MM-DD' (local timezone).
 */
export function todayISO(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * Cộng N ngày vào ngày ISO.
 * @example addDays('2026-04-20', 3) → '2026-04-23'
 */
export function addDays(iso: string, days: number): string {
  // Dùng UTC noon để tránh timezone shift trong browser (Vietnam UTC+7)
  // 'YYYY-MM-DD' + 'T12:00:00Z' → parse as UTC noon → setUTCDate an toàn
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Lấy mảng tất cả ngày ISO trong khoảng [start, end) — half-open.
 * @example dateRange('2026-04-20', '2026-04-23') → ['2026-04-20','2026-04-21','2026-04-22']
 */
export function dateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  // Dùng UTC noon để tránh timezone shift trong browser (Vietnam UTC+7)
  let d      = new Date(start.slice(0, 10) + 'T12:00:00Z');
  const endD = new Date(end.slice(0, 10)   + 'T12:00:00Z');
  while (d < endD) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Check 2 date range có overlap không (half-open intervals).
 * [ci1, co1) ∩ [ci2, co2) ≠ ∅  ↔  ci1 < co2 && co1 > ci2
 */
export function datesOverlap(
  ci1: string, co1: string,
  ci2: string, co2: string,
): boolean {
  return ci1 < co2 && co1 > ci2;
}

export interface DateSegment {
  start: string;
  last:  string;
}

/**
 * Gom mảng ngày ISO liên tiếp thành các đoạn [start, last].
 * @example groupConsecutiveDates(['2026-04-01','2026-04-02','2026-04-05'])
 *          → [{ start:'2026-04-01', last:'2026-04-02' }, { start:'2026-04-05', last:'2026-04-05' }]
 */
export function groupConsecutiveDates(sortedDates: string[]): DateSegment[] {
  if (!sortedDates.length) return [];
  const segments: DateSegment[] = [];
  let segStart = sortedDates[0];
  let segPrev  = sortedDates[0];

  for (let i = 1; i < sortedDates.length; i++) {
    if (sortedDates[i] === addDays(segPrev, 1)) {
      segPrev = sortedDates[i];
    } else {
      segments.push({ start: segStart, last: segPrev });
      segStart = sortedDates[i];
      segPrev  = sortedDates[i];
    }
  }
  segments.push({ start: segStart, last: segPrev });
  return segments;
}

/**
 * Số ngày trong tháng.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Ngày đầu tuần (0=CN) của tháng.
 */
export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Lùi 1 tháng.
 */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

/**
 * Tiến 1 tháng.
 */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

/**
 * Format tháng/năm: "Tháng 4, 2026"
 */
export function formatMonthYear(year: number, month: number): string {
  return `${CONFIG.MONTH_NAMES[month]}, ${year}`;
}


// ══════════════════════════════════════════════════════════════════
// VALIDATION HELPERS (pure, no side effects)
// ══════════════════════════════════════════════════════════════════

/**
 * Validate email đơn giản.
 */
export function isValidEmail(email: string): boolean {
  return typeof email === 'string' &&
    email.includes('@') &&
    email.length > 3 &&
    email.split('@')[1]?.includes('.');
}

/**
 * Validate số điện thoại VN (10-11 số, bắt đầu bằng 0).
 */
export function isValidPhone(phone: string): boolean {
  return /^0\d{9,10}$/.test(phone.replace(/\s/g, ''));
}


// ══════════════════════════════════════════════════════════════════
// BOOKING HELPERS
// ══════════════════════════════════════════════════════════════════

/**
 * Lấy tập hợp ngày bận của 1 villa từ mảng bookings.
 * Trả về { booked: Set<string>, hold: Set<string> }
 */
export function getBookedDateSets(
  bookings: Array<{
    villaId: string;
    checkin: string;
    checkout: string;
    status: string;
  }>,
  villaId: string,
): { booked: Set<string>; hold: Set<string> } {
  const booked = new Set<string>();
  const hold   = new Set<string>();

  bookings
    .filter(b => b.villaId === villaId && b.status !== 'cancelled')
    .forEach(b => {
      const range = dateRange(b.checkin, b.checkout);
      if (b.status === 'hold') range.forEach(d => hold.add(d));
      else                     range.forEach(d => booked.add(d));
    });

  return { booked, hold };
}

/**
 * Tạo ID tạm (chỉ dùng client-side khi chưa có UUID từ DB).
 */
export function genTempId(prefix = 'tmp'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}


// ══════════════════════════════════════════════════════════════════
// CLASS NAME HELPER (thay thế clsx/cn khi không muốn thêm dep)
// ══════════════════════════════════════════════════════════════════

/**
 * Gộp class names, bỏ falsy values.
 * @example cn('btn', isActive && 'btn-active', undefined) → 'btn btn-active'
 */
export function cn(...classes: (string | boolean | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
