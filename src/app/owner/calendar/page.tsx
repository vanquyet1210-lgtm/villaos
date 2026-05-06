// VillaOS v7 — app/owner/calendar/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { getVillas }        from '@/lib/services/villa.service';
import { redirect }         from 'next/navigation';
import CalendarShell        from './CalendarShell';


export const dynamic = 'force-dynamic';

export default async function OwnerCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ villa?: string }>;
}) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { villa: selectedVillaId } = await searchParams;
  const { data: _villas } = await getVillas();
  const villas = _villas ?? [];
  const firstVillaId = selectedVillaId ?? villas[0]?.id;
  // Dùng service_role key để bypass RLS — thấy TẤT CẢ booking
  let initialBookings: any[] = [];
  if (firstVillaId) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && supabaseUrl) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/bookings?villa_id=eq.${firstVillaId}&status=neq.cancelled&select=*&order=checkin.asc`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: 'no-store' }
      );
      if (res.ok) {
        const rows = await res.json();
        const now = new Date();
        initialBookings = rows
          .filter((r: any) => !(r.status === 'hold' && r.hold_expires_at && new Date(r.hold_expires_at) < now))
          .map((r: any) => ({
            id: r.id, villaId: r.villa_id, ownerId: r.owner_id,
            createdBy: r.created_by, createdByRole: r.created_by_role,
            createdByName: r.created_by_name, createdByPhone: r.created_by_phone,
            customer: r.customer, email: r.email ?? '', phone: r.phone ?? '',
            checkin: r.checkin, checkout: r.checkout,
            status: r.status, total: r.total ?? 0,
            note: r.note ?? '', holdExpiresAt: r.hold_expires_at,
            createdAt: r.created_at,
          }));
      }
    }
  }

  if (villas.length === 0) {
    return (
      <>
        <div className="page-header"><h1>📅 Lịch đặt phòng</h1></div>
        <div className="card" style={{textAlign:'center', padding:'48px 24px'}}>
          <span style={{fontSize:56, display:'block', marginBottom:16}}>📭</span>
          <h3>Chưa có villa nào</h3>
          <p style={{marginTop:8}}>Thêm villa trước để quản lý lịch</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <h1>📅 Lịch đặt phòng</h1>
        <p>Quản lý booking, hold và ngày khóa</p>
      </div>
      <CalendarShell
        villas={villas}
        initialVillaId={selectedVillaId ?? villas[0].id}
        userRole={session.profile.role}
        initialBookings={initialBookings}
      />
    </>
  );
}
