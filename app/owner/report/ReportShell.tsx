'use client';
// VillaOS v7 — app/owner/report/ReportShell.tsx

import { useState, useTransition } from 'react';
import type { MonthlyReport }      from '@/types/report';
import { getMonthlyReport, upsertReportEntry } from '@/lib/services/report.service';
import ReportView    from './ReportView';
import EntryForm     from './EntryForm';
import CategorySetup from './CategorySetup';

interface Props {
  villas:         { id: string; name: string; emoji: string }[];
  initialVillaId: string | null;
  initialYear:    number;
  initialMonth:   number;
  initialReport:  MonthlyReport | null;
}

const MONTH_NAMES = [
  'Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
  'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12',
];

export default function ReportShell({
  villas, initialVillaId, initialYear, initialMonth, initialReport,
}: Props) {
  const [tab,     setTab]     = useState<'report' | 'entry' | 'setup'>('report');
  const [year,    setYear]    = useState(initialYear);
  const [month,   setMonth]   = useState(initialMonth);
  const [villaId, setVillaId] = useState(initialVillaId);
  const [report,  setReport]  = useState(initialReport);
  const [isPending, start]    = useTransition();

  const loadReport = (y: number, m: number, vid: string | null) => {
    start(async () => {
      const r = await getMonthlyReport(y, m, vid ?? undefined);
      setReport(r);
    });
  };

  const changeMonth = (d: number) => {
    let m = month + d;
    let y = year;
    if (m > 12) { m = 1;  y++; }
    if (m < 1)  { m = 12; y--; }
    setYear(y);
    setMonth(m);
    loadReport(y, m, villaId);
  };

  return (
    <div className="report-shell">
      {/* ── Topbar ── */}
      <div className="report-topbar">
        <div className="report-topbar-left">
          {villas.length > 1 && (
            <select
              className="report-villa-select"
              value={villaId ?? ''}
              onChange={e => {
                const v = e.target.value || null;
                setVillaId(v);
                loadReport(year, month, v);
              }}
            >
              <option value="">Tất cả villa</option>
              {villas.map(v => (
                <option key={v.id} value={v.id}>{v.emoji} {v.name}</option>
              ))}
            </select>
          )}

          <div className="report-month-nav">
            <button onClick={() => changeMonth(-1)}>‹</button>
            <span>{MONTH_NAMES[month - 1]}, {year}</span>
            <button onClick={() => changeMonth(1)}>›</button>
          </div>
        </div>

        <div className="report-tabs">
          {(['report', 'entry', 'setup'] as const).map(t => (
            <button
              key={t}
              className={`report-tab${tab === t ? ' active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'report' ? '📊 Báo cáo' : t === 'entry' ? '✏️ Nhập liệu' : '⚙️ Danh mục'}
            </button>
          ))}
        </div>
      </div>

      {isPending && <div className="report-loading">Đang tải...</div>}

      {/* ── Content ── */}

      {/* Report tab */}
      {tab === 'report' && report && !isPending && (
        <ReportView report={report} />
      )}
      {tab === 'report' && !report && !isPending && (
        <div className="report-empty">Chưa có dữ liệu tháng này.</div>
      )}

      {/* Entry tab */}
      {tab === 'entry' && report && !isPending && (
        <EntryForm
          report={report}
          onSave={async entries => {
            await Promise.all(
              entries.map(e =>
                upsertReportEntry(e.categoryId, villaId, year, month, e.amount, e.note),
              ),
            );
            loadReport(year, month, villaId);
            setTab('report');
          }}
        />
      )}
      {/* Priority 1 fix: empty state when no report on entry tab */}
      {tab === 'entry' && !report && !isPending && (
        <div className="report-empty">
          <p>Chưa có dữ liệu tháng này.</p>
          <button
            className="report-empty-btn"
            onClick={() => loadReport(year, month, villaId)}
          >
            Tạo báo cáo tháng {MONTH_NAMES[month - 1]}
          </button>
        </div>
      )}

      {/* Setup tab */}
      {tab === 'setup' && (
        <CategorySetup
          onDone={() => {
            setTab('report');
            loadReport(year, month, villaId);
          }}
        />
      )}

      <style>{`
        .report-shell { max-width:860px; margin:0 auto; }
        .report-topbar {
          display:flex; align-items:center; justify-content:space-between;
          flex-wrap:wrap; gap:10px;
          padding-bottom:16px;
          border-bottom:0.5px solid rgba(28,43,74,.08);
          margin-bottom:20px;
        }
        .report-topbar-left { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .report-villa-select {
          padding:6px 12px;
          border:1px solid rgba(28,43,74,.14);
          border-radius:99px;
          background:var(--white,#fff);
          font-size:.85rem; color:#1C2B4A; cursor:pointer;
        }
        .report-month-nav {
          display:flex; align-items:center;
          background:rgba(28,43,74,.05);
          border-radius:var(--radius-sm,6px); overflow:hidden;
        }
        .report-month-nav button {
          border:none; background:none;
          width:28px; height:28px; font-size:1rem;
          cursor:pointer; color:#1C2B4A; transition:background .12s;
        }
        .report-month-nav button:hover { background:rgba(201,168,76,.15); }
        .report-month-nav span {
          font-size:.85rem; font-family:Georgia,serif; font-style:italic;
          color:#1C2B4A; padding:0 8px; min-width:120px; text-align:center;
        }
        .report-tabs {
          display:flex; gap:4px;
          background:rgba(28,43,74,.05);
          border-radius:var(--radius-sm,6px); padding:3px;
        }
        .report-tab {
          padding:6px 14px; border:none; border-radius:5px;
          background:transparent; font-size:.8rem;
          cursor:pointer; color:#8A8F9A; transition:background .12s, color .12s;
          white-space:nowrap;
        }
        .report-tab.active {
          background:var(--white,#fff); color:#1C2B4A;
          font-weight:500; box-shadow:0 1px 4px rgba(28,43,74,.08);
        }
        .report-loading { text-align:center; padding:24px; color:#8A8F9A; font-size:.85rem; }
        .report-empty {
          text-align:center; padding:48px; color:#8A8F9A; font-size:.9rem;
          display:flex; flex-direction:column; align-items:center; gap:14px;
        }
        .report-empty-btn {
          padding:9px 24px; border-radius:99px;
          background:#1C2B4A; color:#fff;
          border:none; font-size:.85rem; cursor:pointer;
          transition:opacity .15s;
        }
        .report-empty-btn:hover { opacity:.85; }

        @media (max-width:600px) {
          .report-topbar { flex-direction:column; align-items:flex-start; }
          .report-tabs   { width:100%; }
          .report-tab    { flex:1; text-align:center; }
        }
      `}</style>
    </div>
  );
}
