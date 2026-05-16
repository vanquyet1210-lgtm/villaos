'use client';

type Props = {
  report: any;
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
