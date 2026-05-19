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

  // Chuyển villa ID sang number nếu hợp lệ, giữ nguyên undefined nếu không
  const toNumId = (id: unknown): number | undefined => {
    const n = Number(id);
    return !isNaN(n) && n > 0 ? n : undefined;
  };

  const effectiveVillaId = villaParam
    ? toNumId(villaParam)
    : toNumId(villas[0]?.id);

  const report = await getMonthlyReport(year, month, effectiveVillaId);

  return (
    <ReportShell
      villas={villas.map(v => ({ id: toNumId(v.id) ?? v.id as unknown as number, name: v.name, emoji: v.emoji }))}
      initialVillaId={effectiveVillaId ?? null}   // sync với data
      initialYear={year}
      initialMonth={month}
      initialReport={report}
    />
  );
}
