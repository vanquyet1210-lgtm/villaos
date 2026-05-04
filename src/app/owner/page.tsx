// VillaOS v7 — app/owner/page.tsx — Trang chủ chủ nhà mobile
import { getServerSession }  from '@/lib/supabase/server';
import { redirect }          from 'next/navigation';
import { getVillas }         from '@/lib/services/villa.service';
import { calcNights, todayISO } from '@/lib/utils';
import OwnerHomeClient       from './OwnerHomeClient';

export const dynamic = 'force-dynamic';

export default async function OwnerHomePage() {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;

  const sb = await (await import('@/lib/supabase/server')).createSupabaseServerClient();
  const { data: _villas } = await getVillas();
  const villas = _villas ?? [];

  const { data: _bookings } = await sb
    .from('bookings').select('*').neq('status', 'cancelled')
    .order('checkin', { ascending: true });
  const allBookings: any[] = _bookings ?? [];

  const today = todayISO();
  const confirmedB = allBookings.filter((b: any) => b.status === 'confirmed');
  const holdB      = allBookings.filter((b: any) => b.status === 'hold');

  const villaStats = villas.map((v, i) => {
    const vConf  = confirmedB.filter((b: any) => b.villa_id === v.id);
    const vHolds = holdB.filter((b: any) => b.villa_id === v.id);
    const isOcc  = vConf.some((b: any) => b.checkin <= today && b.checkout > today);
    return {
      id: v.id, name: v.name, emoji: v.emoji, bedrooms: v.bedrooms,
      price: v.price, status: v.status,
      code: `VL${String(i+1).padStart(3,'0')}`,
      confirmed: vConf.length, holds: vHolds.length,
      free: Math.max(0, 30 - vConf.length - vHolds.length),
      occupied: isOcc,
    };
  });

  const holdRequests = holdB.map((b: any) => {
    const villa = villas.find(v => v.id === b.villa_id);
    return {
      id: b.id, customer: b.customer, phone: b.phone ?? '',
      checkin: b.checkin, checkout: b.checkout,
      nights: calcNights(b.checkin, b.checkout),
      villaName: villa?.name ?? '—', villaId: b.villa_id,
      saleName: b.customer, total: b.total,
    };
  });

  return (
    <OwnerHomeClient
      villas={villaStats}
      allBookings={allBookings}
      holdRequests={holdRequests}
      profileName={profile.name}
    />
  );
}
