// VillaOS v7 — app/owner/report/page.tsx
import { getServerSession }  from '@/lib/supabase/server';
import { getVillas }         from '@/lib/services/villa.service';
import { redirect }          from 'next/navigation';
import { getMonthlyReport }  from '@/lib/services/report.service';
import ReportShell           from './ReportShell';

export const dynamic = 'force-dynamic';

export default async function OwnerReportPage({
  searchParams,
}: { searchParams: Promise<{ villa?: string; year?: string; month?: string }> }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');

  const { villa: villaParam, year: yearStr, month: monthStr } = await searchParams;
  const { data: _villas } = await getVillas();
  const villas = _villas ?? [];

  const now   = new Date();
  const year  = yearStr  ? parseInt(yearStr)  : now.getFullYear();
  const month = monthStr ? parseInt(monthStr) : now.getMonth() + 1;

  // Bug 1 fix: nếu URL không có ?villa=, dùng villa đầu tiên thay vì undefined
  // Tránh lệch giữa dropdown (villas[0]) và data (villaId=undefined → "Tất cả")
  const effectiveVillaId = villaParam ?? villas[0]?.id ?? undefined;

  const report = await getMonthlyReport(year, month, effectiveVillaId);

  return (
    <ReportShell
      villas={villas.map(v => ({ id: v.id, name: v.name, emoji: v.emoji }))}
      initialVillaId={effectiveVillaId ?? null}   // sync với data
      initialYear={year}
      initialMonth={month}
      initialReport={report}
    />
  );
}
