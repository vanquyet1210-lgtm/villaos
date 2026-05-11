'use client';
// VillaOS v7 — app/owner/report/EntryForm.tsx

import { useState } from 'react';
import type { MonthlyReport, ReportCategoryWithEntry } from '@/types/report';

interface Props {
  report: MonthlyReport;
  onSave: (entries: { categoryId: string; amount: number; note?: string }[]) => Promise<void>;
}

export default function EntryForm({ report, onSave }: Props) {
  // Chỉ hiện các khoản thủ công (isAuto = false)
  const manualRevenue  = report.revenue.filter(c => !c.isAuto);
  const manualExpenses = report.expenses.filter(c => !c.isAuto);

  const initAmounts = () => {
    const m: Record<string, number> = {};
    [...manualRevenue, ...manualExpenses].forEach(c => { m[c.id] = c.amount; });
    return m;
  };
  const [amounts,  setAmounts]  = useState<Record<string, number>>(initAmounts);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);

  const setAmt = (id: string, val: string) => {
    setAmounts(prev => ({ ...prev, [id]: parseInt(val.replace(/\D/g,'')) || 0 }));
  };

  const handleSave = async () => {
    setSaving(true);
    const entries = Object.entries(amounts).map(([categoryId, amount]) => ({ categoryId, amount }));
    await onSave(entries);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const autoItems = [...report.revenue, ...report.expenses].filter(c => c.isAuto);

  return (
    <div className="entry-form">
      {/* Info banner */}
      <div className="entry-info">
        <span>⚡</span>
        <span>
          <strong>{autoItems.length} khoản tự động</strong> đã được điền từ hệ thống.
          Chỉ cần nhập <strong>{manualRevenue.length + manualExpenses.length} khoản thủ công</strong> bên dưới.
        </span>
      </div>

      {/* Auto items preview */}
      {autoItems.length > 0 && (
        <div className="entry-section entry-section--auto">
          <div className="entry-section-title">✅ Tự động (chỉ đọc)</div>
          {autoItems.map(c => (
            <div key={c.id} className="entry-row entry-row--auto">
              <span className="entry-row-name">{c.icon} {c.name}</span>
              <span className="entry-row-amount-fixed">{fmtShort(c.amount)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Manual revenue */}
      {manualRevenue.length > 0 && (
        <div className="entry-section">
          <div className="entry-section-title">💚 Doanh thu — nhập tay</div>
          {manualRevenue.map(c => (
            <div key={c.id} className="entry-row">
              <label className="entry-row-name" htmlFor={`amt-${c.id}`}>{c.icon} {c.name}</label>
              <div className="entry-input-wrap">
                <input
                  id={`amt-${c.id}`}
                  type="number"
                  min="0"
                  value={amounts[c.id] || ''}
                  onChange={e => setAmt(c.id, e.target.value)}
                  placeholder="0"
                />
                <span className="entry-unit">đ</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Manual expenses */}
      {manualExpenses.length > 0 && (
        <div className="entry-section">
          <div className="entry-section-title">🔴 Chi phí — nhập tay</div>
          {manualExpenses.map(c => (
            <div key={c.id} className="entry-row">
              <label className="entry-row-name" htmlFor={`amt-${c.id}`}>{c.icon} {c.name}</label>
              <div className="entry-input-wrap">
                <input
                  id={`amt-${c.id}`}
                  type="number"
                  min="0"
                  value={amounts[c.id] || ''}
                  onChange={e => setAmt(c.id, e.target.value)}
                  placeholder="0"
                />
                <span className="entry-unit">đ</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary preview */}
      <div className="entry-summary">
        <div className="entry-summary-row">
          <span>Doanh thu dự kiến</span>
          <span className="entry-summary-val entry-summary-val--rev">
            {fmtShort(
              report.revenue.reduce((s, c) => s + (c.isAuto ? c.amount : (amounts[c.id] ?? 0)), 0)
            )}
          </span>
        </div>
        <div className="entry-summary-row">
          <span>Chi phí dự kiến</span>
          <span className="entry-summary-val entry-summary-val--exp">
            {fmtShort(
              report.expenses.reduce((s, c) => s + (c.isAuto ? c.amount : (amounts[c.id] ?? 0)), 0)
            )}
          </span>
        </div>
        <div className="entry-summary-row entry-summary-row--profit">
          <span>Lợi nhuận ước tính</span>
          <span className="entry-summary-val">
            {fmtShort(
              report.revenue.reduce((s,c) => s+(c.isAuto?c.amount:(amounts[c.id]??0)),0) -
              report.expenses.reduce((s,c) => s+(c.isAuto?c.amount:(amounts[c.id]??0)),0)
            )}
          </span>
        </div>
      </div>

      {/* Save button */}
      <div className="entry-actions">
        <button className="entry-save-btn" disabled={saving} onClick={handleSave}>
          {saving ? 'Đang lưu...' : saved ? '✅ Đã lưu!' : '💾 Lưu số liệu'}
        </button>
      </div>

      <style>{`
        .entry-form { display:flex; flex-direction:column; gap:12px; }
        .entry-info {
          display:     flex; align-items:flex-start; gap:10px;
          background:  rgba(28,43,74,.04); border:1px solid rgba(28,43,74,.08);
          border-radius:12px; padding:12px 14px;
          font-size:.83rem; color:#4A5568; line-height:1.55;
        }
        .entry-section {
          background:    var(--white,#fff);
          border:        1px solid rgba(28,43,74,.08);
          border-radius: 14px; overflow:hidden;
        }
        .entry-section--auto { opacity:.7; }
        .entry-section-title {
          font-size:.72rem; font-weight:600; color:#C9A84C;
          letter-spacing:.08em; text-transform:uppercase;
          padding:10px 16px 6px;
          border-bottom:0.5px solid rgba(28,43,74,.06);
        }
        .entry-row {
          display:         flex;
          align-items:     center;
          justify-content: space-between;
          padding:         10px 16px;
          border-bottom:   0.5px solid rgba(28,43,74,.04);
          gap:             12px;
        }
        .entry-row:last-child { border-bottom:none; }
        .entry-row-name { font-size:.85rem; color:#1C2B4A; flex:1; }
        .entry-input-wrap {
          display:     flex;
          align-items: center;
          gap:         4px;
          background:  rgba(28,43,74,.04);
          border:      1px solid rgba(28,43,74,.1);
          border-radius:8px; padding:4px 8px;
        }
        .entry-input-wrap input {
          border:none; background:transparent; font-size:.85rem;
          color:#1C2B4A; width:90px; text-align:right; outline:none;
        }
        .entry-unit { font-size:.72rem; color:#8A8F9A; }
        .entry-row--auto { opacity:.85; }
        .entry-row-amount-fixed {
          font-family:Georgia,serif; font-style:italic; font-size:.88rem; color:#1C2B4A;
        }
        .entry-summary {
          background:    rgba(28,43,74,.03);
          border:        1px solid rgba(28,43,74,.08);
          border-radius: 14px; padding:14px 16px;
          display:       flex; flex-direction:column; gap:8px;
        }
        .entry-summary-row {
          display:justify-content:space-between;
          display:flex; justify-content:space-between;
          font-size:.83rem; color:#4A5568;
        }
        .entry-summary-row--profit {
          font-weight:600; color:#1C2B4A;
          padding-top:8px; border-top:0.5px solid rgba(28,43,74,.08);
        }
        .entry-summary-val { font-family:Georgia,serif; font-style:italic; }
        .entry-summary-val--rev { color:#178a5e; }
        .entry-summary-val--exp { color:#A32D2D; }
        .entry-actions { display:flex; justify-content:flex-end; padding:4px 0; }
        .entry-save-btn {
          padding:10px 28px; border-radius:99px;
          background:#1C2B4A; color:#fff;
          border:none; font-size:.88rem; font-weight:500;
          cursor:pointer; transition:opacity .15s;
        }
        .entry-save-btn:hover:not(:disabled) { opacity:.85; }
        .entry-save-btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </div>
  );
}

function fmtShort(n: number) {
  if (!n) return '0đ';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1).replace(/\.0$/,'') + ' tr';
  return n.toLocaleString('vi-VN') + 'đ';
}
