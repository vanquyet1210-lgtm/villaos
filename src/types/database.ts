// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — types/database.ts                             ║
// ║  PHẦN 1: App types + mappers (viết tay, KHÔNG xóa)          ║
// ║  PHẦN 2: Supabase generated types (gen bằng CLI)            ║
// ║                                                             ║
// ║  ⚠️  Khi chạy `supabase gen types` lại:                     ║
// ║     - Chỉ thay PHẦN 2 (từ dòng "export type Json" trở đi)  ║
// ║     - Giữ nguyên PHẦN 1                                     ║
// ╚══════════════════════════════════════════════════════════════╝

// ══════════════════════════════════════════════════════════════════
// PHẦN 1: APP TYPES + MAPPERS — KHÔNG XÓA KHI GEN LẠI
// ══════════════════════════════════════════════════════════════════

export type UserRole      = 'admin' | 'owner' | 'sale' | 'customer';
export type VillaStatus   = 'active' | 'inactive';
export type BookingStatus = 'confirmed' | 'hold' | 'cancelled';

// ── Raw DB rows (snake_case — khớp với Postgres) ──────────────────

export interface ProfileRow {
  id:         string;
  name:       string;
  role:       UserRole;
  brand:      string | null;
  joined_at:  string;
  updated_at: string;
}

export interface VillaRow {
  id:           string;
  owner_id:     string;
  name:         string;
  province:     string;
  district:     string;
  ward:         string | null;
  street:       string | null;
  bedrooms:     number;
  adults:       number;
  children:     number;
  price:        number;
  amenities:    string[];
  description:  string | null;
  images:       string[];
  emoji:        string;
  locked_dates: string[];
  status:       VillaStatus;
  created_at:   string;
  updated_at:   string;
}

export interface BookingRow {
  id:              string;
  villa_id:        string;
  owner_id:        string;
  created_by:      string;
  created_by_role: UserRole;
  customer:        string;
  email:           string | null;
  phone:           string | null;
  checkin:         string;
  checkout:        string;
  status:          BookingStatus;
  total:           number;
  note:            string | null;
  hold_expires_at: string | null;
  created_at:      string;
  updated_at:      string;
}

export interface SaleVillaAccessRow {
  sale_id:    string;
  villa_id:   string;
  granted_by: string;
  granted_at: string;
}

// ── App-level types (camelCase — dùng trong components) ───────────

export interface Profile {
  id:        string;
  name:      string;
  role:      UserRole;
  brand:     string;
  joinedAt:  string;
}

export interface Villa {
  id:          string;
  ownerId:     string;
  name:        string;
  province:    string;
  district:    string;
  ward:        string;
  street:      string;
  bedrooms:    number;
  adults:      number;
  children:    number;
  price:       number;
  amenities:   string[];
  description: string;
  images:      string[];
  emoji:       string;
  lockedDates: string[];
  status:      VillaStatus;
  createdAt:   string;
}

export interface Booking {
  id:            string;
  villaId:       string;
  ownerId:       string;
  createdBy:     string;
  createdByRole: UserRole;
  customer:      string;
  email:         string;
  phone:         string;
  checkin:       string;
  checkout:      string;
  status:        BookingStatus;
  total:         number;
  note:          string;
  holdExpiresAt: string | null;
  createdAt:     string;
}

// ── Row → App mappers ─────────────────────────────────────────────

export function mapProfile(row: any): Profile {
  return {
    id:       row.id,
    name:     row.name,
    role:     row.role,
    brand:    row.brand ?? '',
    joinedAt: row.joined_at,
  };
}

export function mapVilla(row: any): Villa {
  return {
    id:          row.id,
    ownerId:     row.owner_id,
    name:        row.name,
    province:    row.province,
    district:    row.district,
    ward:        row.ward ?? '',
    street:      row.street ?? '',
    bedrooms:    row.bedrooms,
    adults:      row.adults,
    children:    row.children,
    price:       row.price,
    amenities:   row.amenities,
    description: row.description ?? '',
    images:      row.images,
    emoji:       row.emoji,
    lockedDates: row.locked_dates,
    status:      row.status,
    createdAt:   row.created_at,
  };
}

// Sanitize date string từ Supabase về YYYY-MM-DD.
//
// Từ v7.2: new dates được lưu 'YYYY-MM-DDT12:00:00.000Z' (noon UTC)
// → getUTCDate() luôn cho đúng ngày.
//
// Legacy data bị timezone bug: stored as 'YYYY-MM-DDT00:00:00Z' (midnight UTC)
// Với Vietnam UTC+7: '2026-05-03' stored → '2026-05-02T17:00:00+00:00'
// UTC parse → day=2 SAI. Fix: nếu UTC hour ≥ 17, là midnight Vietnam → +1 ngày.
function sanitizeDate(raw: string): string {
  if (!raw) return raw;
  if (raw.length === 10) return raw; // pure DATE 'YYYY-MM-DD'
  
  const d = new Date(raw);
  let utcDay = d.getUTCDate();
  const utcHour = d.getUTCHours();
  const utcMonth = d.getUTCMonth();
  const utcYear = d.getUTCFullYear();
  
  // Legacy: T17:00:00-T23:59:59 UTC = midnight→early morning Vietnam (UTC+7)
  // Thực chất là ngày hôm SAU theo Vietnam time → +1 ngày UTC
  if (utcHour >= 17) {
    const next = new Date(Date.UTC(utcYear, utcMonth, utcDay + 1));
    return next.toISOString().slice(0, 10);
  }
  
  const y = String(utcYear);
  const m = String(utcMonth + 1).padStart(2, '0');
  const day = String(utcDay).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function mapBooking(row: any): Booking {
  return {
    id:            row.id,
    villaId:       row.villa_id,
    ownerId:       row.owner_id,
    createdBy:     row.created_by,
    createdByRole: row.created_by_role,
    customer:      row.customer,
    email:         row.email ?? '',
    phone:         row.phone ?? '',
    checkin:       sanitizeDate(row.checkin),
    checkout:      sanitizeDate(row.checkout),
    status:        row.status,
    total:         row.total,
    note:          row.note ?? '',
    holdExpiresAt: row.hold_expires_at,
    createdAt:     row.created_at,
  };
}

// ══════════════════════════════════════════════════════════════════
// PHẦN 2: SUPABASE GENERATED TYPES
// Thay thế phần này khi chạy lại: supabase gen types typescript ...
// ══════════════════════════════════════════════════════════════════

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action:      string;
          actor_id:    string | null;
          actor_name:  string | null;
          actor_role:  string | null;
          created_at:  string;
          entity_id:   string;
          entity_name: string | null;
          entity_type: string;
          id:          string;
          ip_address:  string | null;
          new_data:    Json | null;
          old_data:    Json | null;
          owner_id:    string | null;
          user_agent:  string | null;
        };
        Insert: {
          action:       string;
          actor_id?:    string | null;
          actor_name?:  string | null;
          actor_role?:  string | null;
          created_at?:  string;
          entity_id:    string;
          entity_name?: string | null;
          entity_type:  string;
          id?:          string;
          ip_address?:  string | null;
          new_data?:    Json | null;
          old_data?:    Json | null;
          owner_id?:    string | null;
          user_agent?:  string | null;
        };
        Update: Partial<Database['public']['Tables']['audit_logs']['Insert']>;
      };
      bookings: {
        Row:    BookingRow;
        Insert: Omit<BookingRow, 'id' | 'owner_id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<BookingRow, 'id' | 'villa_id' | 'owner_id' | 'created_by' | 'created_at'>>;
      };
      profiles: {
        Row:    ProfileRow;
        Insert: Omit<ProfileRow, 'joined_at' | 'updated_at'>;
        Update: Partial<Omit<ProfileRow, 'id'>>;
      };
      sale_villa_access: {
        Row:    SaleVillaAccessRow;
        Insert: Omit<SaleVillaAccessRow, 'granted_at'>;
        Update: never;
      };
      villas: {
        Row:    VillaRow;
        Insert: Omit<VillaRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VillaRow, 'id' | 'owner_id' | 'created_at'>>;
      };
    };
    Views:          Record<string, never>;
    Functions: {
      insert_audit_log: {
        Args: {
          p_actor_id:     string;
          p_actor_role:   string;
          p_actor_name:   string;
          p_action:       string;
          p_entity_type:  string;
          p_entity_id:    string;
          p_entity_name?: string | null;
          p_old_data?:    string | null;
          p_new_data?:    string | null;
          p_owner_id?:    string | null;
          p_ip_address?:  string | null;
          p_user_agent?:  string | null;
        };
        Returns: void;
      };
    };
    CompositeTypes: Record<string, never>;
    Enums: {
      user_role:      UserRole;
      villa_status:   VillaStatus;
      booking_status: BookingStatus;
    };
  };
}
