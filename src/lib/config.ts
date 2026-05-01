// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — lib/config.ts                                 ║
// ║  Port từ config.js — thêm TypeScript types đầy đủ          ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Types ─────────────────────────────────────────────────────────

export interface AmenityPreset {
  value: string;
  label: string;
}

export interface AuthConfig {
  readonly MIN_PASSWORD_LENGTH: number;
  readonly LOGIN_DELAY_MS:      number;
  readonly REGISTER_DELAY_MS:   number;
}

export interface HoldConfig {
  readonly DURATION_MINUTES:  number;
  readonly TIMER_INTERVAL_MS: number;
}

export interface ImageConfig {
  readonly MAX_COUNT:    number;
  readonly MAX_PX:       number;
  readonly JPEG_QUALITY: number;
}

export interface ToastConfig {
  readonly DEFAULT_DUR_MS: number;
}

export interface AppConfig {
  readonly APP_NAME:       string;
  readonly APP_VERSION:    string;
  readonly AUTH:           AuthConfig;
  readonly HOLD:           HoldConfig;
  readonly IMAGE:          ImageConfig;
  readonly TOAST:          ToastConfig;
  readonly ROLES:          Record<string, string>;
  readonly STATUS:         Record<string, string>;
  readonly AMENITY_PRESETS: readonly AmenityPreset[];
  readonly VILLA_EMOJIS:   readonly string[];
  readonly MONTH_NAMES:    readonly string[];
  readonly DAY_NAMES:      readonly string[];
}

// ── Config Object ─────────────────────────────────────────────────

export const CONFIG = {
  APP_NAME:    'VillaOS',
  APP_VERSION: '7.1.0',

  AUTH: {
    MIN_PASSWORD_LENGTH: 6,
    LOGIN_DELAY_MS:      0,    // v7: không cần delay giả — Supabase xử lý
    REGISTER_DELAY_MS:   0,
  },

  HOLD: {
    DURATION_MINUTES:  30,
    TIMER_INTERVAL_MS: 1000,
  },

  IMAGE: {
    MAX_COUNT:    10,
    MAX_PX:       900,
    JPEG_QUALITY: 0.82,
  },

  TOAST: {
    DEFAULT_DUR_MS: 3500,
  },

  ROLES: {
    OWNER:    'owner',
    SALE:     'sale',
    CUSTOMER: 'customer',
    ADMIN:    'admin',
  },

  STATUS: {
    CONFIRMED: 'confirmed',
    HOLD:      'hold',
    CANCELLED: 'cancelled',
  },

  AMENITY_PRESETS: [
    { value: 'pool',     label: '🏊 Hồ bơi'     },
    { value: 'bbq',      label: '🍖 Bếp BBQ'     },
    { value: 'billiard', label: '🎱 Bàn bi-a'    },
    { value: 'karaoke',  label: '🎤 Karaoke'     },
    { value: 'garden',   label: '🌿 Sân vườn'    },
    { value: 'seaview',  label: '🌊 View biển'   },
    { value: 'gym',      label: '🏋️ Phòng gym'   },
    { value: 'cinema',   label: '🎬 Rạp phim'    },
    { value: 'jacuzzi',  label: '🛁 Jacuzzi'     },
    { value: 'parking',  label: '🚗 Bãi đỗ xe'   },
  ] as const,

  VILLA_EMOJIS: ['🏡', '🏖️', '🌿', '🌊', '🏝️', '⛱️'] as const,

  MONTH_NAMES: [
    'Tháng 1', 'Tháng 2', 'Tháng 3',  'Tháng 4',
    'Tháng 5', 'Tháng 6', 'Tháng 7',  'Tháng 8',
    'Tháng 9', 'Tháng 10','Tháng 11', 'Tháng 12',
  ] as const,

  DAY_NAMES: ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const,

  // ── Address data (Vietnam provinces/districts/wards) ─────────
  ADDRESS_DATA: {
    'Khánh Hòa': {
      'Nha Trang': ['Lộc Thọ','Vạn Thạnh','Vạn Yên','Phương Sài','Xương Huân','Tân Lập','Vĩnh Phước'],
      'Cam Ranh':  ['Cam Lâm','Cam Phú','Cam Tuyền','Thạnh Sơn'],
    },
    'Đà Nẵng': {
      'Ngũ Hành Sơn': ['Mỹ An','Mỹ Khê','Hòa Hải','Khuê Mỹ'],
      'Sơn Trà':      ['Nại Hiên Đông','Mân Thái','Thọ Quang','An Phú Đông'],
      'Liên Chiểu':   ['Hòa Minh','Hòa Khánh Bắc','Hòa Khánh Nam'],
      'Hải Châu':     ['Phước Mỹ','Bình Hiên','Thạc Gián','Hải Châu I','Hải Châu II'],
    },
    'Quảng Nam': {
      'Hội An': ['Minh An','Cẩm Phô','Cẩm Chính','Tân Thành'],
    },
    'Bình Thuận': {
      'Phan Thiết': ['Phú Hài','Tân Thành','Hàm Tiến','Hàm Thuận Bắc'],
      'Mũi Né':     ['Phan Sơn','Tiến Thành'],
    },
    'Bà Rịa - Vũng Tàu': {
      'Vũng Tàu': ['Bãi Sau','Bãi Trước','Thắng Tam','Phú Mỹ'],
    },
    'Phú Quốc': {
      'Phú Quốc (TP)': ['An Thới','Cửa Cạn','Dương Đông','Gành Dầu'],
    },
  } as Record<string, Record<string, string[]>>,

} as const satisfies Partial<AppConfig> & { ADDRESS_DATA: Record<string, Record<string, string[]>> };

// ── Convenience exports ───────────────────────────────────────────

export type AmenityValue = typeof CONFIG.AMENITY_PRESETS[number]['value'];
export type VillaEmoji   = typeof CONFIG.VILLA_EMOJIS[number];
export type MonthName    = typeof CONFIG.MONTH_NAMES[number];
export type DayName      = typeof CONFIG.DAY_NAMES[number];
