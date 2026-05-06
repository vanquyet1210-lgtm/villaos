// VillaOS v7 — app/owner/calendar/page.tsx
import { getServerSession } from '@/lib/supabase/server';
import { getVillas }        from '@/lib/services/villa.service';
import { redirect }         from 'next/navigation';
import CalendarShell        from './CalendarShell';
import { getCachedVillaBookings } from '@/lib/cache/query-cache';

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
  const initialBookings = firstVillaId
    ? await getCachedVillaBookings(firstVillaId)
    : [];

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
