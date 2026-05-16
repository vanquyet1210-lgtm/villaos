'use client';

type Props = {
  report: any;
  currentVillaId: string | null;
  onSaveSharedEntry: (categoryId: any, amount: any, note: any) => Promise<void>;
  onSaveAllocPct: (pct: any) => Promise<void>;
};

export default function ReportView({ report }: Props) {
  const effectiveTotalExp = report?.totalExpense ?? 0;
  const effectiveNetProfit = report?.netProfit ?? 0;

  return (
    <div>
      <h2>Report View</h2>

      <div>
        <p>Total Expense: {effectiveTotalExp}</p>
        <p>Net Profit: {effectiveNetProfit}</p>
      </div>
    </div>
  );
}
