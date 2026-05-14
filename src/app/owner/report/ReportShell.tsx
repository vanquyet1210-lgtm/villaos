'use client';
// VillaOS v7 — app/owner/report/ReportShell.tsx

import { useState, useTransition } from 'react';
import type { MonthlyReport }      from '@/types/report';
import { getMonthlyReport, upsertReportEntry } from '@/lib/services/report.service';
import ReportView    from './ReportView';
import EntryForm, { type SaveEntry } from './EntryForm';
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
  const [formKey,   setFormKey] = useState(0);

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
        <ReportView
          report={report}
          onSaveSharedEntry={async (categoryId, amount, note) => {
            await upsertReportEntry(categoryId, null, year, month, amount, note);
            loadReport(year, month, villaId);
          }}
          onSaveAllocPct={async (_pct) => {
            // wire to your allocPct persistence layer here
            loadReport(year, month, villaId);
          }}
        />
      )}
      {tab === 'report' && !report && !isPending && (
        <div className="report-empty">Chưa có dữ liệu tháng này.</div>
      )}

      {/* Entry tab */}
      {tab === 'entry' && report && !isPending && (
        <EntryForm
          key={formKey}
          report={report}
          onSave={async (entries: SaveEntry[]) => {
            await Promise.all(
              entries.map(e =>
                upsertReportEntry(
                  e.categoryId,
                  e.isShared ? null : villaId,
                  year, month, e.amount, e.note,
                ),
              ),
            );
            loadReport(year, month, villaId);
            setTab('report');
          }}
          onCopyPrevMonth={() => {
            const pm = month === 1 ? 12 : month - 1;
            const py = month === 1 ? year - 1 : year;
            loadReport(py, pm, villaId);
            setFormKey(k => k + 1);
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
        /* ── Design tokens (shared with EntryForm) ── */
        .report-shell {
          --rev-text:    #0A6B44;
          --rev-bg:      #EBF7F2;
          --shared-text: #1A3A6B;
          --shared-bg:   #EAF0FB;
          --muted:       #6B7280;
          --border:      rgba(0,0,0,.09);
          --surface:     #fff;
          --surface-dim: #F8F9FA;

          max-width: 900px;
          margin: 0 auto;
          font-family: 'Be Vietnam Pro', 'Inter', system-ui, sans-serif;
        }

        /* ── Topbar ── */
        .report-topbar {
          display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 10px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 20px;
        }
        .report-topbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

        /* Villa selector */
        .report-villa-select {
          padding: 7px 14px;
          border: 1px solid rgba(26,58,107,.2);
          border-radius: 99px;
          background: var(--surface);
          font-size: .83rem; font-family: inherit;
          color: var(--shared-text); cursor: pointer;
          transition: border-color .15s;
        }
        .report-villa-select:focus { outline: none; border-color: var(--shared-text); }

        /* Month nav */
        .report-month-nav {
          display: flex; align-items: center;
          background: var(--surface-dim);
          border: 1px solid var(--border);
          border-radius: 8px; overflow: hidden;
        }
        .report-month-nav button {
          border: none; background: none;
          width: 30px; height: 30px; font-size: 1rem;
          cursor: pointer; color: var(--shared-text);
          transition: background .12s; flex-shrink: 0;
        }
        .report-month-nav button:hover { background: rgba(10,107,68,.1); }
        .report-month-nav span {
          font-size: .84rem; font-weight: 500;
          color: #1A202C; padding: 0 10px;
          min-width: 130px; text-align: center;
          border-left: 1px solid var(--border);
          border-right: 1px solid var(--border);
        }

        /* Tabs */
        .report-tabs {
          display: flex; gap: 3px;
          background: var(--surface-dim);
          border: 1px solid var(--border);
          border-radius: 9px; padding: 3px;
        }
        .report-tab {
          padding: 6px 16px; border: none; border-radius: 7px;
          background: transparent; font-size: .8rem; font-family: inherit;
          cursor: pointer; color: var(--muted);
          transition: background .12s, color .12s;
          white-space: nowrap;
        }
        .report-tab.active {
          background: var(--surface); color: #1A202C;
          font-weight: 600; box-shadow: 0 1px 4px rgba(0,0,0,.09);
        }
        .report-tab:hover:not(.active) { color: #1A202C; background: rgba(0,0,0,.03); }

        /* States */
        .report-loading {
          text-align: center; padding: 28px;
          color: var(--muted); font-size: .84rem;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .report-empty {
          text-align: center; padding: 52px 24px; color: var(--muted); font-size: .88rem;
          display: flex; flex-direction: column; align-items: center; gap: 14px;
        }
        .report-empty-btn {
          padding: 10px 26px; border-radius: 99px;
          background: var(--rev-text); color: #fff;
          border: none; font-size: .84rem; font-family: inherit;
          font-weight: 600; cursor: pointer; transition: opacity .15s;
        }
        .report-empty-btn:hover { opacity: .88; }

        @media (max-width: 600px) {
          .report-topbar { flex-direction: column; align-items: flex-start; }
          .report-tabs   { width: 100%; }
          .report-tab    { flex: 1; text-align: center; }
        }
      `}</style>
    </div>
  );
}
