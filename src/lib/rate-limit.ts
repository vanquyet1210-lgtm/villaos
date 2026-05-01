// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/rate-limit.ts                           ║
// ║  Rate limiting cho login, register, booking                 ║
// ║  Dev: in-memory Map (đủ cho single instance)                ║
// ║  Production: Upstash Redis (persist across instances/edge)  ║
// ╚══════════════════════════════════════════════════════════════╝

// ── Rate limit rules ──────────────────────────────────────────────

export const RATE_LIMITS = {
  // Auth endpoints — dễ bị brute-force nhất
  LOGIN: {
    limit:      5,    // 5 lần
    windowMs:   15 * 60 * 1000,  // trong 15 phút
    message:    'Quá nhiều lần thử đăng nhập. Thử lại sau 15 phút.',
  },
  REGISTER: {
    limit:      3,    // 3 lần
    windowMs:   60 * 60 * 1000,  // trong 1 giờ
    message:    'Quá nhiều lần đăng ký từ IP này. Thử lại sau 1 giờ.',
  },
  // Booking — tránh spam giữ chỗ
  BOOKING: {
    limit:      10,   // 10 lần
    windowMs:   60 * 60 * 1000,  // trong 1 giờ
    message:    'Quá nhiều booking. Thử lại sau 1 giờ.',
  },
  // Forgot password — tránh email bombing
  FORGOT_PASSWORD: {
    limit:      3,
    windowMs:   60 * 60 * 1000,
    message:    'Vui lòng đợi trước khi gửi lại email.',
  },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  success:   boolean;
  remaining: number;
  resetAt:   Date;
  message?:  string;
}

// ══════════════════════════════════════════════════════════════════
// IN-MEMORY IMPLEMENTATION (Dev / Single Instance)
// ══════════════════════════════════════════════════════════════════
// ⚠️ Dùng cho development. Production: switch sang Upstash Redis.

interface RateLimitEntry {
  count:   number;
  resetAt: number;  // timestamp ms
}

// Singleton map — persist across requests trong cùng 1 process
const _store = new Map<string, RateLimitEntry>();

// Cleanup expired entries mỗi 5 phút (tránh memory leak)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of _store.entries()) {
      if (entry.resetAt < now) _store.delete(key);
    }
  }, 5 * 60 * 1000);
}

function checkInMemory(
  identifier: string,
  rule: typeof RATE_LIMITS[RateLimitKey]
): RateLimitResult {
  const now    = Date.now();
  const key    = identifier;
  const entry  = _store.get(key);

  if (!entry || entry.resetAt < now) {
    // Lần đầu hoặc window đã hết
    _store.set(key, { count: 1, resetAt: now + rule.windowMs });
    return {
      success:   true,
      remaining: rule.limit - 1,
      resetAt:   new Date(now + rule.windowMs),
    };
  }

  if (entry.count >= rule.limit) {
    return {
      success:   false,
      remaining: 0,
      resetAt:   new Date(entry.resetAt),
      message:   rule.message,
    };
  }

  entry.count++;
  _store.set(key, entry);
  return {
    success:   true,
    remaining: rule.limit - entry.count,
    resetAt:   new Date(entry.resetAt),
  };
}


// ══════════════════════════════════════════════════════════════════
// UPSTASH REDIS IMPLEMENTATION (Production)
// Uncomment khi có UPSTASH_REDIS_REST_URL + TOKEN trong .env
// npm install @upstash/ratelimit @upstash/redis
// ══════════════════════════════════════════════════════════════════

/*
import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const _limiters = {
  LOGIN:            new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5,  '15 m') }),
  REGISTER:         new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '1 h') }),
  BOOKING:          new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1 h') }),
  FORGOT_PASSWORD:  new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(3,  '1 h') }),
};

async function checkUpstash(
  identifier: string,
  key: RateLimitKey
): Promise<RateLimitResult> {
  const { success, remaining, reset } = await _limiters[key].limit(identifier);
  return {
    success,
    remaining,
    resetAt: new Date(reset),
    message: success ? undefined : RATE_LIMITS[key].message,
  };
}
*/


// ══════════════════════════════════════════════════════════════════
// PUBLIC API
// ══════════════════════════════════════════════════════════════════

/**
 * Check rate limit.
 * @param key       Rule key (LOGIN, REGISTER, BOOKING, ...)
 * @param ip        IP address của request
 * @param userId    User ID (optional — kết hợp với IP để key chính xác hơn)
 */
export async function rateLimit(
  key:     RateLimitKey,
  ip:      string,
  userId?: string,
): Promise<RateLimitResult> {
  // Identifier = rule:ip hoặc rule:userId (nếu đã login)
  const identifier = `${key}:${userId ?? ip}`;
  const rule = RATE_LIMITS[key];

  // Production: uncomment Upstash, comment in-memory
  // return checkUpstash(identifier, key);
  return checkInMemory(identifier, rule);
}


// ── Helper: Set response headers chuẩn RateLimit RFC ─────────────

export function setRateLimitHeaders(
  headers: Headers,
  result:  RateLimitResult,
  key:     RateLimitKey,
) {
  headers.set('X-RateLimit-Limit',     String(RATE_LIMITS[key].limit));
  headers.set('X-RateLimit-Remaining', String(result.remaining));
  headers.set('X-RateLimit-Reset',     String(Math.floor(result.resetAt.getTime() / 1000)));
  if (!result.success) {
    headers.set('Retry-After', String(Math.ceil((result.resetAt.getTime() - Date.now()) / 1000)));
  }
}
