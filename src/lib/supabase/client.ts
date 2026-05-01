// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — lib/supabase/client.ts                        ║
// ║  Browser-side Supabase client (singleton)                   ║
// ╚══════════════════════════════════════════════════════════════╝

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

// Singleton — tránh tạo nhiều instance trong React
let _client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseBrowserClient() {
  if (_client) return _client;

  _client = createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return _client;
}

// Shorthand alias
export const supabase = getSupabaseBrowserClient;
