// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — lib/services/auth.service.ts               ║
// ╚══════════════════════════════════════════════════════════════╝

'use server';

import { redirect }                   from 'next/navigation';
import { revalidatePath }             from 'next/cache';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { logAudit }                   from './audit.service';
import type { UserRole }              from '@/types/database';

export interface LoginInput    { email: string; password: string; }
export interface RegisterInput { email: string; password: string; name: string; role: Extract<UserRole, 'owner' | 'sale' | 'customer'>; brand?: string; }
export interface AuthResult    { success: boolean; error?: string; code?: string; }

// ── LOGIN ─────────────────────────────────────────────────────────

export async function loginAction(input: LoginInput): Promise<AuthResult> {
  const sb = await createSupabaseServerClient();

  const { data, error } = await sb.auth.signInWithPassword({
    email:    input.email.toLowerCase().trim(),
    password: input.password,
  });

  if (error) {
    return {
      success: false,
      code:    error.code,
      error:   error.code === 'invalid_credentials'
        ? 'Email hoặc mật khẩu không đúng.'
        : error.code === 'email_not_confirmed'
        ? 'Email chưa được xác nhận. Kiểm tra hộp thư.'
        : 'Đăng nhập thất bại. Thử lại sau.',
    };
  }

  const user = data.user;
  const { data: _profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
  const profile = _profile as any;

  if (profile) {
    await logAudit({
      actorId:    profile.id,
      actorRole:  profile.role,
      actorName:  profile.name,
      action:     'user.login',
      entityType: 'user',
      entityId:   profile.id,
      entityName: profile.name,
      ownerId:    profile.role === 'owner' ? profile.id : undefined,
    });
  }

  revalidatePath('/', 'layout');
  return { success: true, code: profile?.role ?? 'customer' };
}


// ── REGISTER ──────────────────────────────────────────────────────

export async function registerAction(input: RegisterInput): Promise<AuthResult> {
  const sb = await createSupabaseServerClient();

  const { data, error } = await sb.auth.signUp({
    email:    input.email.toLowerCase().trim(),
    password: input.password,
    options: {
      data: {
        name:  input.name.trim(),
        role:  input.role,
        brand: input.brand?.trim() ?? '',
      },
    },
  });

  if (error) {
    return {
      success: false,
      code:    error.code,
      error:   error.code === 'user_already_exists'
        ? 'Email này đã được đăng ký.'
        : 'Đăng ký thất bại. Thử lại sau.',
    };
  }

  if (!data.user) return { success: false, error: 'Không tạo được tài khoản.' };

  await logAudit({
    actorId:    data.user.id,
    actorRole:  input.role,
    actorName:  input.name,
    action:     'user.registered',
    entityType: 'user',
    entityId:   data.user.id,
    entityName: input.name,
    newData:    { email: input.email, role: input.role },
  });

  return { success: true, code: input.role };
}


// ── LOGOUT ────────────────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const sb = await createSupabaseServerClient();

  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    const { data: _profile } = await sb.from('profiles').select('*').eq('id', user.id).single();
    const profile = _profile as any;
    if (profile) {
      await logAudit({
        actorId:    profile.id,
        actorRole:  profile.role,
        actorName:  profile.name,
        action:     'user.logout',
        entityType: 'user',
        entityId:   profile.id,
        ownerId:    profile.role === 'owner' ? profile.id : undefined,
      });
    }
  }

  await sb.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/auth/login');
}


// ── ADMIN CREATE USER ─────────────────────────────────────────────

export interface AdminCreateUserInput {
  email: string; password: string; name: string; role: UserRole; brand?: string;
}

export async function adminCreateUserAction(
  input: AdminCreateUserInput
): Promise<AuthResult & { userId?: string }> {
  const sb = await createSupabaseServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { success: false, error: 'Chưa đăng nhập.' };

  const { data: _caller } = await sb.from('profiles').select('*').eq('id', user.id).single();
  const caller = _caller as any;
  if (caller?.role !== 'admin') return { success: false, error: 'Chỉ Admin mới có quyền tạo tài khoản.' };

  const adminSb = createSupabaseAdminClient();
  const { data, error } = await adminSb.auth.admin.createUser({
    email:         input.email.toLowerCase().trim(),
    password:      input.password,
    email_confirm: true,
    user_metadata: { name: input.name.trim(), role: input.role, brand: input.brand?.trim() ?? '' },
  });

  if (error) return { success: false, error: error.message.includes('already') ? 'Email đã tồn tại.' : error.message };

  await logAudit({
    actorId:    caller.id,
    actorRole:  caller.role,
    actorName:  caller.name,
    action:     'user.created_by_admin',
    entityType: 'user',
    entityId:   data.user.id,
    entityName: input.name,
    newData:    { email: input.email, role: input.role },
  });

  return { success: true, userId: data.user.id };
}


// ── CHANGE PASSWORD ───────────────────────────────────────────────

export async function changePasswordAction(newPassword: string): Promise<AuthResult> {
  const sb = await createSupabaseServerClient();
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) return { success: false, error: 'Đổi mật khẩu thất bại.' };
  return { success: true };
}

export async function forgotPasswordAction(email: string): Promise<AuthResult> {
  const sb = await createSupabaseServerClient();
  await sb.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/auth/reset-password`,
  });
  return { success: true };
}
