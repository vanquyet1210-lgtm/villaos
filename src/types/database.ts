// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — types/database.ts                             ║
// ║  TypeScript types khớp 1:1 với Supabase schema              ║
// ║  FIX: Thêm owner_id vào BookingRow + Booking (schema_patch) ║
// ╚══════════════════════════════════════════════════════════════╝

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
  owner_id:        string;          // ← THÊM (schema_patch PATCH 1)
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
  ownerId:       string;            // ← THÊM (schema_patch PATCH 1)
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

// ── Audit log row ─────────────────────────────────────────────────

export interface AuditLogRow {
  id:          string;
  actor_id:    string;
  actor_name:  string;
  actor_role:  UserRole;
  action:      string;
  entity_type: string;
  entity_id:   string;
  entity_name: string | null;
  old_data:    Record<string, unknown> | null;
  new_data:    Record<string, unknown> | null;
  owner_id:    string | null;
  ip_address:  string | null;
  user_agent:  string | null;
  created_at:  string;
}

// ── Supabase Database type ────────────────────────────────────────

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      audit_logs: {
        Row:           AuditLogRow;
        Insert:        Omit<AuditLogRow, 'id' | 'created_at'>;
        Update:        Partial<Omit<AuditLogRow, 'id' | 'created_at'>>;
        Relationships: [];
      };
      profiles: {
        Row:           ProfileRow;
        Insert:        Omit<ProfileRow, 'joined_at' | 'updated_at'>;
        Update:        Partial<Omit<ProfileRow, 'id'>>;
        Relationships: [];
      };
      villas: {
        Row:           VillaRow;
        Insert:        Omit<VillaRow, 'id' | 'created_at' | 'updated_at'>;
        Update:        Partial<Omit<VillaRow, 'id' | 'owner_id' | 'created_at'>>;
        Relationships: [];
      };
      bookings: {
        Row:           BookingRow;
        Insert:        Omit<BookingRow, 'id' | 'owner_id' | 'created_at' | 'updated_at'>; // owner_id set by trigger
        Update:        Partial<Omit<BookingRow, 'id' | 'villa_id' | 'owner_id' | 'created_by' | 'created_at'>>;
        Relationships: [];
      };
      sale_villa_access: {
        Row:           SaleVillaAccessRow;
        Insert:        Omit<SaleVillaAccessRow, 'granted_at'>;
        Update:        Partial<Omit<SaleVillaAccessRow, 'sale_id' | 'villa_id'>>;
        Relationships: [];
      };
    };
    Views: Record<string, { Row: Record<string, unknown>; Relationships: [] }>;
    Functions: {
      insert_audit_log: {
        Args: {
          p_actor_id:    string;
          p_actor_role:  string;
          p_actor_name:  string;
          p_action:      string;
          p_entity_type: string;
          p_entity_id:   string;
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

// ── Row → App mappers ─────────────────────────────────────────────

export function mapProfile(row: ProfileRow): Profile {
  return {
    id:       row.id,
    name:     row.name,
    role:     row.role,
    brand:    row.brand ?? '',
    joinedAt: row.joined_at,
  };
}

export function mapVilla(row: VillaRow): Villa {
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

export function mapBooking(row: BookingRow): Booking {
  return {
    id:            row.id,
    villaId:       row.villa_id,
    ownerId:       row.owner_id,   // ← THÊM
    createdBy:     row.created_by,
    createdByRole: row.created_by_role,
    customer:      row.customer,
    email:         row.email ?? '',
    phone:         row.phone ?? '',
    checkin:       row.checkin,
    checkout:      row.checkout,
    status:        row.status,
    total:         row.total,
    note:          row.note ?? '',
    holdExpiresAt: row.hold_expires_at,
    createdAt:     row.created_at,
  };
}
