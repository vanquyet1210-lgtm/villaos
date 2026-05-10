// VillaOS v7 — app/owner/dashboard/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import { calcNights, todayISO } from '@/lib/utils';
import type { Villa }        from '@/types/database';
import DashboardAccordion    from './DashboardAccordion';

export const dynamic = 'force-dynamic';

export default async function OwnerDashboardPage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data: _villas } = await getVillas();
  const villas: Villa[] = _villas ?? [];

  const { data: _all } = await sb
    .from('bookings')
    .select('*')
    .neq('status', 'cancelled')
    .order('checkin', { ascending: false });
  const allBookings: any[] = _all ?? [];

  const { data: _history } = await sb
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  const historyBookings: any[] = _history ?? [];

  const { data: _kyc } = await sb
    .from('kyc_submissions')
    .select('status, created_at')
    .eq('owner_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const today     = todayISO();
  const thisMonth = today.slice(0, 7);
  const lastMonth = (() => {
    const d = new Date(today);
    d.setDate(1); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 7);
  })();
  const thisYear  = today.slice(0, 4);

  const confirmedB = allBookings.filter(b => b.status === 'confirmed');
  const in14 = new Date(today);
  in14.setDate(in14.getDate() + 14);
  const in14Str = in14.toISOString().slice(0, 10);
  const tomorrow = (() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  })();

  // ── Check-in sắp tới ──────────────────────────────────────────
  const upcoming = confirmedB
    .filter(b => b.checkin >= today && b.checkin <= in14Str)
    .sort((a: any, b: any) => a.checkin.localeCompare(b.checkin))
    .map((b: any) => {
      const v = villas.find(x => x.id === b.villa_id);
      return {
        id:         b.id,
        customer:   b.customer ?? '—',
        phone:      b.phone ?? '',
        villaName:  v?.name ?? '',
        villaEmoji: v?.emoji ?? '🏡',
        checkin:    b.checkin,
        checkout:   b.checkout,
        nights:     calcNights(b.checkin, b.checkout),
        total:      b.total ?? 0,
        isToday:    b.checkin === today,
        isTomorrow: b.checkin === tomorrow,
      };
    });

  // ── Lịch sử hold & booking ────────────────────────────────────
  const holdHistory = historyBookings.slice(0, 20).map((b: any) => {
    const v = villas.find(x => x.id === b.villa_id);
    return {
      id:           b.id,
      customer:     b.customer ?? '—',
      phone:        b.phone ?? '',
      villaName:    v?.name ?? '',
      status:       b.status,
      checkin:      b.checkin,
      checkout:     b.checkout,
      total:        b.total ?? 0,
      createdAt:    b.created_at,
      holdExpiresAt: b.hold_expires_at,
    };
  });

  // ── Doanh thu ─────────────────────────────────────────────────
  const revThisMonth = confirmedB
    .filter((b: any) => b.checkin.startsWith(thisMonth))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const revLastMonth = confirmedB
    .filter((b: any) => b.checkin.startsWith(lastMonth))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const revThisYear = confirmedB
    .filter((b: any) => b.checkin.startsWith(thisYear))
    .reduce((s: number, b: any) => s + (b.total ?? 0), 0);

  const byVilla = villas.map(v => ({
    name:      v.name,
    emoji:     v.emoji,
    thisMonth: confirmedB
      .filter((b: any) => b.villa_id === v.id && b.checkin.startsWith(thisMonth))
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0),
    total: confirmedB
      .filter((b: any) => b.villa_id === v.id)
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0),
  })).sort((a, b) => b.thisMonth - a.thisMonth);

  const monthly: { label: string; value: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(1); d.setMonth(d.getMonth() - i);
    const key   = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString('vi-VN', { month: 'short' });
    const value = confirmedB
      .filter((b: any) => b.checkin.startsWith(key))
      .reduce((s: number, b: any) => s + (b.total ?? 0), 0);
    monthly.push({ label, value });
  }

  return (
    <>
      <div className="page-header">
        <h1>Tổng quan 👑</h1>
      </div>
      <div style={{
        height: '0.5px',
        background: 'linear-gradient(90deg,rgba(201,168,76,.6) 0%,rgba(201,168,76,.08) 100%)',
        marginBottom: '20px',
      }} />

      <DashboardAccordion
        upcoming={upcoming}
        holdHistory={holdHistory}
        revenue={{ thisMonth: revThisMonth, lastMonth: revLastMonth, thisYear: revThisYear, byVilla, monthly }}
        kyc={{ status: _kyc?.status ?? 'none', submittedAt: _kyc?.created_at }}
      />
    </>
  );
}
