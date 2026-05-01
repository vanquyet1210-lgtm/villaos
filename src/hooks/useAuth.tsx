// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — hooks/useAuth.ts                              ║
// ║  Thay thế APP.user / APP.role                               ║
// ║  Role luôn đọc từ DB — không tin localStorage hay state    ║
// ╚══════════════════════════════════════════════════════════════╝

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter }                         from 'next/navigation';
import { getSupabaseBrowserClient }          from '@/lib/supabase/client';
import type { User }                         from '@supabase/supabase-js';
import type { Profile, UserRole }            from '@/types/database';

// ── Types ─────────────────────────────────────────────────────────

export interface AuthState {
  user:     User | null;
  profile:  Profile | null;
  role:     UserRole | null;
  loading:  boolean;
  isAdmin:  boolean;
  isOwner:  boolean;
  isSale:   boolean;
  isCustomer: boolean;
}

// ── Hook ──────────────────────────────────────────────────────────

export function useAuth(): AuthState {
  const [user,    setUser]    = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const sb = getSupabaseBrowserClient();

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const row = data as any;
    if (row) {
      setProfile({
        id:       row.id,
        name:     row.name,
        role:     row.role,
        brand:    row.brand ?? '',
        joinedAt: row.joined_at,
      });
    }
  }, [sb]);

  useEffect(() => {
    // Lấy session hiện tại
    sb.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        loadProfile(user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen auth state changes (login, logout, token refresh)
    const { data: { subscription } } = sb.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await loadProfile(currentUser.id);
        } else {
          setProfile(null);
        }

        // Token refresh → không cần làm gì thêm
        // SIGNED_OUT → middleware sẽ redirect, nhưng cũng xử lý ở đây
        if (event === 'SIGNED_OUT') {
          router.push('/auth/login');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [sb, loadProfile, router]);

  const role = profile?.role ?? null;

  return {
    user,
    profile,
    role,
    loading,
    isAdmin:    role === 'admin',
    isOwner:    role === 'owner',
    isSale:     role === 'sale',
    isCustomer: role === 'customer',
  };
}


// ── Role Guard Component (dùng trong JSX) ─────────────────────────

import type { ReactNode } from 'react';

interface RoleGuardProps {
  allow:    UserRole | UserRole[];
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Client-side role guard — CHỈ dùng để ẩn/hiện UI.
 * Bảo vệ thật sự là middleware.ts + RLS.
 *
 * Ví dụ:
 *   <RoleGuard allow={['owner', 'admin']}>
 *     <DeleteVillaButton />
 *   </RoleGuard>
 */
export function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const { role, loading } = useAuth();
  if (loading) return null;
  const allowed = Array.isArray(allow) ? allow : [allow];
  if (!role || !allowed.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
