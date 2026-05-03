// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — lib/validators.ts                             ║
// ║  Port từ validators.js                                      ║
// ║  - Bỏ hoàn toàn dependency vào localStorage                ║
// ║  - Conflict check thật = Server Action _checkConflict()     ║
// ║  - Validators ở đây chỉ làm client-side UX (early return)  ║
// ║  - Zero DOM, zero side effects, 100% pure functions         ║
// ╚══════════════════════════════════════════════════════════════╝

import { CONFIG }        from './config';
import { datesOverlap, isValidEmail, isValidPhone, todayISO } from './utils';

// ── Error type ────────────────────────────────────────────────────

export interface ValidationError {
  field:  string;   // tên field để highlight input
  code:   string;   // machine-readable key để assert trong tests
  msg:    string;   // chuỗi hiển thị cho người dùng
}

function _err(field: string, code: string, msg: string): ValidationError {
  return { field, code, msg };
}

export type ValidationResult = ValidationError[];


// ══════════════════════════════════════════════════════════════════
// BOOKING VALIDATOR
// Dùng cho: Calendar date picker, form booking (UX only)
// Conflict check thật → booking.service.ts _checkConflict()
// ══════════════════════════════════════════════════════════════════

export interface BookingValidateInput {
  villaId:   string;
  checkin:   string;          // 'YYYY-MM-DD'
  checkout:  string;          // 'YYYY-MM-DD'
  customer?: string;
  phone?:    string;
  excludeId?: string;         // bkId cần bỏ qua khi edit
}

export interface BookingRef {
  id:       string;
  villaId:  string;
  checkin:  string;
  checkout: string;
  status:   string;
}

export interface VillaRef {
  id:          string;
  lockedDates?: string[];
}

/**
 * Validate booking data phía client (UX early return).
 *
 * @param data         Input từ form
 * @param bookings     Danh sách bookings hiện có (để check overlap client-side)
 * @param villas       Danh sách villas (để check lockedDates)
 * @param role         Role của người tạo booking
 */
export function validateBooking(
  data:     BookingValidateInput,
  bookings: BookingRef[]  = [],
  villas:   VillaRef[]    = [],
  role:     string        = 'sale',
): ValidationResult {
  const errors: ValidationError[] = [];
  const { villaId, checkin, checkout, customer, phone, excludeId } = data;
  const today = todayISO();

  // 1 — Tên khách (sale/owner cần, customer không cần nhập)
  if (role !== 'customer' && !customer?.trim()) {
    errors.push(_err('customer', 'CUSTOMER_REQUIRED', 'Vui lòng nhập tên khách hàng.'));
  }

  // 2 — SĐT (chỉ sale cần)
  if (role === 'sale' && !phone?.trim()) {
    errors.push(_err('phone', 'PHONE_REQUIRED', 'Vui lòng nhập số điện thoại.'));
  }

  if (role === 'sale' && phone?.trim() && !isValidPhone(phone)) {
    errors.push(_err('phone', 'PHONE_INVALID', 'Số điện thoại không hợp lệ (10-11 số, bắt đầu bằng 0).'));
  }

  // 3 — Ngày bắt buộc
  if (!checkin || !checkout) {
    errors.push(_err('dates', 'DATES_REQUIRED', 'Vui lòng chọn ngày check-in và check-out.'));
    return errors; // không thể check tiếp
  }

  // 4 — Thứ tự ngày
  if (checkout <= checkin) {
    errors.push(_err('checkout', 'CHECKOUT_BEFORE_CHECKIN', 'Check-out phải sau check-in ít nhất 1 ngày.'));
  }

  // 5 — Không đặt quá khứ
  if (checkin < today) {
    errors.push(_err('checkin', 'CHECKIN_IN_PAST', 'Ngày check-in không thể ở quá khứ.'));
  }

  if (errors.length) return errors; // dừng sớm nếu ngày không hợp lệ

  // 6 — Ngày bị khóa bởi chủ villa
  // lockedDates là các đêm bị khóa (half-open: [checkin, checkout))
  // → chỉ block nếu đêm mới overlap với đêm đã lock, KHÔNG block ngày checkout của lock
  const villa = villas.find(v => v.id === villaId);
  if (villa?.lockedDates?.length) {
    const lockedSet = new Set(villa.lockedDates);
    // Dùng Date.UTC để tránh timezone shift trong browser (Vietnam UTC+7)
    // Các đêm của booking mới: [checkin, checkout) — không bao gồm ngày checkout
    const [cy, cm, cd] = checkin.slice(0,10).split('-').map(Number);
    const [ey, em, ed] = checkout.slice(0,10).split('-').map(Number);
    let ms = Date.UTC(cy, cm - 1, cd);
    const endMs = Date.UTC(ey, em - 1, ed);
    while (ms < endMs) {
      const dt = new Date(ms);
      const ds = [
        dt.getUTCFullYear(),
        String(dt.getUTCMonth() + 1).padStart(2, '0'),
        String(dt.getUTCDate()).padStart(2, '0'),
      ].join('-');
      if (lockedSet.has(ds)) {
        const [y, m, day] = ds.split('-');
        errors.push(_err('dates', 'DATE_LOCKED',
          `Ngày ${day}/${m}/${y} đã bị chủ nhà khóa. Vui lòng chọn ngày khác.`));
        break;
      }
      ms += 86_400_000;
    }
  }

  // 7 — Conflict check client-side (chỉ để UX warning sớm)
  //     ⚠️ Conflict check THẬT là PostgreSQL EXCLUDE constraint
  //     trong DB + _checkConflict() trong booking.service.ts
  //     Logic: [ci1, co1) ∩ [ci2, co2) — half-open, checkout day KHÔNG conflict với checkin mới cùng ngày
  const conflict = bookings.find(b =>
    b.villaId !== villaId       ? false :
    b.status  === 'cancelled'   ? false :
    excludeId && b.id === excludeId ? false :
    datesOverlap(checkin, checkout, b.checkin, b.checkout)
  );

  if (conflict) {
    const [cy, cm, cd] = conflict.checkin.split('-');
    const [oy, om, od] = conflict.checkout.split('-');
    errors.push(_err('dates', 'BOOKING_CONFLICT',
      `Villa đã có lịch (${cd}/${cm}/${cy} → ${od}/${om}/${oy}). Vui lòng chọn ngày khác.`));
  }

  return errors;
}


// ══════════════════════════════════════════════════════════════════
// VILLA VALIDATOR
// Dùng cho: form thêm/sửa villa (owner)
// ══════════════════════════════════════════════════════════════════

export interface VillaValidateInput {
  name:      string;
  province:  string;
  district:  string;
  price:     number | string;
  bedrooms:  number | string;
  adults:    number | string;
}

export function validateVilla(data: VillaValidateInput): ValidationResult {
  const errors: ValidationError[] = [];
  const { name, province, district, price, bedrooms, adults } = data;

  if (!name?.trim()) {
    errors.push(_err('name', 'NAME_REQUIRED', 'Tên villa không được để trống.'));
  } else if (name.trim().length < 3) {
    errors.push(_err('name', 'NAME_TOO_SHORT', 'Tên villa cần ít nhất 3 ký tự.'));
  }

  if (!province) {
    errors.push(_err('province', 'PROVINCE_REQUIRED', 'Vui lòng chọn tỉnh/thành phố.'));
  }

  if (!district) {
    errors.push(_err('district', 'DISTRICT_REQUIRED', 'Vui lòng chọn quận/huyện.'));
  }

  const p = Number(price);
  if (!price || isNaN(p) || p <= 0) {
    errors.push(_err('price', 'PRICE_INVALID', 'Giá thuê phải là số dương (VNĐ/đêm).'));
  } else if (p < 100_000) {
    errors.push(_err('price', 'PRICE_TOO_LOW', 'Giá tối thiểu 100,000 VNĐ/đêm.'));
  }

  const b = Number(bedrooms);
  if (!bedrooms || isNaN(b) || b < 1 || b > 50) {
    errors.push(_err('bedrooms', 'BEDROOMS_INVALID', 'Số phòng ngủ phải từ 1 đến 50.'));
  }

  const a = Number(adults);
  if (!adults || isNaN(a) || a < 1 || a > 200) {
    errors.push(_err('adults', 'ADULTS_INVALID', 'Sức chứa người lớn phải từ 1 đến 200.'));
  }

  return errors;
}


// ══════════════════════════════════════════════════════════════════
// AUTH VALIDATOR
// Dùng cho: register form (client-side check trước khi gọi Server Action)
// ══════════════════════════════════════════════════════════════════

export interface RegisterValidateInput {
  name:      string;
  email:     string;
  password:  string;
  password2: string;
  role?:     string;
}

export function validateRegister(data: RegisterValidateInput): ValidationResult {
  const errors: ValidationError[] = [];
  const { name, email, password, password2, role } = data;

  if (!name?.trim()) {
    errors.push(_err('name', 'NAME_REQUIRED', 'Vui lòng nhập họ tên.'));
  }

  if (!isValidEmail(email)) {
    errors.push(_err('email', 'EMAIL_INVALID', 'Email không hợp lệ.'));
  }

  if (!role) {
    errors.push(_err('role', 'ROLE_REQUIRED', 'Vui lòng chọn vai trò.'));
  }

  if (!password || password.length < CONFIG.AUTH.MIN_PASSWORD_LENGTH) {
    errors.push(_err('password', 'PASSWORD_TOO_SHORT',
      `Mật khẩu cần ít nhất ${CONFIG.AUTH.MIN_PASSWORD_LENGTH} ký tự.`));
  }

  if (password !== password2) {
    errors.push(_err('password2', 'PASSWORDS_MISMATCH', 'Mật khẩu xác nhận không khớp.'));
  }

  return errors;
}

export interface LoginValidateInput {
  email:    string;
  password: string;
}

export function validateLogin(data: LoginValidateInput): ValidationResult {
  const errors: ValidationError[] = [];

  if (!isValidEmail(data.email)) {
    errors.push(_err('email', 'EMAIL_INVALID', 'Email không hợp lệ.'));
  }

  if (!data.password) {
    errors.push(_err('password', 'PASSWORD_REQUIRED', 'Vui lòng nhập mật khẩu.'));
  }

  return errors;
}


// ══════════════════════════════════════════════════════════════════
// HELPER UTILITIES
// ══════════════════════════════════════════════════════════════════

/**
 * Lấy lỗi đầu tiên theo field name.
 */
export function getFieldError(
  errors: ValidationResult,
  field:  string,
): string | undefined {
  return errors.find(e => e.field === field)?.msg;
}

/**
 * Check xem field có lỗi không.
 */
export function hasFieldError(errors: ValidationResult, field: string): boolean {
  return errors.some(e => e.field === field);
}

/**
 * Chuyển array errors thành map { field → msg } để dùng trong form.
 */
export function errorsToMap(errors: ValidationResult): Record<string, string> {
  return errors.reduce((acc, e) => {
    if (!acc[e.field]) acc[e.field] = e.msg; // giữ lỗi đầu tiên mỗi field
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Lấy msg lỗi đầu tiên (dùng để hiện toast).
 */
export function firstErrorMsg(errors: ValidationResult): string | null {
  return errors[0]?.msg ?? null;
}
