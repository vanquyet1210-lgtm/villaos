'use client';
// VillaOS v7 — app/owner/report/CategorySetup.tsx

import { useState, useEffect } from 'react';
import { getOrInitCategories, upsertCategory, deactivateCategory } from '@/lib/services/report.service';
import type { ReportCategory } from '@/types/report';

interface Props { onDone: () => void; }

const ICON_LIST = ['💰','💵','🏡','🅰️','🔵','✨','⚡','💧','🧹','📶','🏷️','👤','🏢','🏦','🚗','🍽️','🌿','🔧'];
const COLOR_LIST = [
  '#178a5e','#3266ad','#d65a1e','#7f77dd','#854F0B',
  '#185FA5','#5A6978','#6B7280','#374151','#A32D2D',
  '#C9A84C','#1C2B4A','#78303F','#2E7D32',
];

type TabType = 'revenue' | 'expense';

export default function CategorySetup({ onDone }: Props) {
  const [cats,    setCats]    = useState<ReportCategory[]>([]);
  const [tab,     setTab]     = useState<TabType>('revenue');
  const [editing, setEditing] = useState<Partial<ReportCategory> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');

  useEffect(() => {
    getOrInitCategories().then(c => { setCats(c); setLoading(false); });
  }, []);

  const filtered = cats.filter(c => c.type === tab).sort((a,b) => a.sortOrder - b.sortOrder);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setMsg('Vui lòng nhập tên danh mục'); return; }
    setSaving(true);
    const res = await upsertCategory({
      id:          editing.id,
      name:        editing.name!,
      type:        editing.type ?? tab,
      groupName:   editing.groupName ?? undefined,
      icon:        editing.icon ?? '💰',
      color:       editing.color ?? '#178a5e',
      isAuto:      editing.isAuto ?? false,
      fixedAmount: editing.fixedAmount ?? 0,
    });
    if (res.error) { setMsg(res.error); }
    else {
      const updated = await getOrInitCategories();
      setCats(updated); setEditing(null); setMsg('');
    }
    setSaving(false);
  };

  const handleDeactivate = async (id: string) => {
    if (!confirm('Ẩn danh mục này khỏi báo cáo?')) return;
    await deactivateCategory(id);
    setCats(prev => prev.filter(c => c.id !== id));
  };

  if (loading) return <div style={{ padding:'24px', textAlign:'center', color:'#8A8F9A' }}>Đang tải...</div>;

  return (
    <div className="cat-setup">
      {/* Tab */}
      <div className="cat-tabs">
        <button className={`cat-tab${tab==='revenue'?' active':''}`} onClick={()=>setTab('revenue')}>💚 Doanh thu</button>
        <button className={`cat-tab${tab==='expense'?' active':''}`} onClick={()=>setTab('expense')}>🔴 Chi phí</button>
      </div>

      {/* List */}
      <div className="cat-list">
        {filtered.map(c => (
          <div key={c.id} className="cat-row">
            <div className="cat-row-left">
              <span className="cat-drag">⠿</span>
              <span className="cat-dot" style={{ background: c.color }} />
              <span className="cat-icon">{c.icon}</span>
              <div>
                <div className="cat-name">{c.name}</div>
                <div className="cat-meta">
                  {c.groupName && <span className="cat-group">{c.groupName}</span>}
                  {c.isAuto && <span className="cat-badge cat-badge--auto">tự động</span>}
                  {c.fixedAmount > 0 && <span className="cat-badge cat-badge--fixed">cố định</span>}
                  {!c.isAuto && !c.fixedAmount && <span className="cat-badge cat-badge--manual">thủ công</span>}
                </div>
              </div>
            </div>
            <div className="cat-row-right">
              <button className="cat-btn" onClick={() => setEditing({ ...c })}>Sửa</button>
              {!c.isAuto && (
                <button className="cat-btn cat-btn--danger" onClick={() => handleDeactivate(c.id)}>Ẩn</button>
              )}
            </div>
          </div>
        ))}

        {/* Add button */}
        <button className="cat-add-btn" onClick={() => setEditing({ type: tab, icon:'💰', color:'#178a5e', isAuto:false, fixedAmount:0 })}>
          + Thêm danh mục {tab === 'revenue' ? 'doanh thu' : 'chi phí'}
        </button>
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="cat-modal-overlay" onClick={() => setEditing(null)}>
          <div className="cat-modal" onClick={e => e.stopPropagation()}>
            <div className="cat-modal-header">
              <span>{editing.id ? 'Chỉnh sửa' : 'Thêm mới'} danh mục</span>
              <button onClick={() => setEditing(null)}>×</button>
            </div>

            <div className="cat-modal-body">
              {/* Name */}
              <div className="cat-field">
                <label>Tên danh mục *</label>
                <input
                  value={editing.name ?? ''}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Doanh thu spa, Tiền gas..."
                />
              </div>

              {/* Group */}
              <div className="cat-field">
                <label>Nhóm</label>
                <input
                  value={editing.groupName ?? ''}
                  onChange={e => setEditing(p => ({ ...p, groupName: e.target.value }))}
                  placeholder="VD: Vận hành, Nhân sự, Cố định..."
                />
              </div>

              {/* Icon picker */}
              <div className="cat-field">
                <label>Icon</label>
                <div className="cat-icon-grid">
                  {ICON_LIST.map(ic => (
                    <button
                      key={ic}
                      className={`cat-icon-btn${editing.icon===ic?' selected':''}`}
                      onClick={() => setEditing(p => ({ ...p, icon: ic }))}
                    >{ic}</button>
                  ))}
                </div>
              </div>

              {/* Color picker */}
              <div className="cat-field">
                <label>Màu</label>
                <div className="cat-color-grid">
                  {COLOR_LIST.map(cl => (
                    <button
                      key={cl}
                      className={`cat-color-btn${editing.color===cl?' selected':''}`}
                      style={{ background: cl }}
                      onClick={() => setEditing(p => ({ ...p, color: cl }))}
                    />
                  ))}
                </div>
              </div>

              {/* Fixed amount */}
              <div className="cat-field">
                <label>Số tiền cố định (lặp mỗi tháng)</label>
                <div className="cat-input-wrap">
                  <input
                    type="number" min="0"
                    value={editing.fixedAmount || ''}
                    onChange={e => setEditing(p => ({ ...p, fixedAmount: parseInt(e.target.value)||0 }))}
                    placeholder="0 — để trống nếu không cố định"
                  />
                  <span>đ</span>
                </div>
                <div className="cat-field-hint">Điền số này nếu chi phí lặp đều mỗi tháng (vd: tiền thuê, trả ngân hàng)</div>
              </div>

              {msg && <div className="cat-error">{msg}</div>}
            </div>

            <div className="cat-modal-footer">
              <button className="cat-cancel-btn" onClick={() => setEditing(null)}>Hủy</button>
              <button className="cat-save-btn" disabled={saving} onClick={handleSave}>
                {saving ? 'Đang lưu...' : 'Lưu danh mục'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Done button */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
        <button className="cat-done-btn" onClick={onDone}>✓ Hoàn thành</button>
      </div>

      <style>{`
        .cat-setup { display:flex; flex-direction:column; gap:12px; }
        .cat-tabs {
          display:flex; gap:4px;
          background:rgba(28,43,74,.05); border-radius:8px; padding:3px;
          width:fit-content;
        }
        .cat-tab {
          padding:7px 16px; border:none; border-radius:6px;
          background:transparent; font-size:.83rem;
          cursor:pointer; color:#8A8F9A; transition:all .12s;
        }
        .cat-tab.active {
          background:var(--white,#fff); color:#1C2B4A;
          font-weight:500; box-shadow:0 1px 4px rgba(28,43,74,.1);
        }
        .cat-list {
          background:var(--white,#fff); border:1px solid rgba(28,43,74,.08);
          border-radius:14px; overflow:hidden;
        }
        .cat-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:10px 14px; border-bottom:0.5px solid rgba(28,43,74,.05);
        }
        .cat-row:last-of-type { border-bottom:none; }
        .cat-row-left  { display:flex; align-items:center; gap:8px; flex:1; }
        .cat-row-right { display:flex; gap:6px; }
        .cat-drag   { color:#C9A84C; font-size:1rem; cursor:grab; }
        .cat-dot    { width:8px;height:8px;border-radius:50%;flex-shrink:0; }
        .cat-icon   { font-size:1rem; }
        .cat-name   { font-size:.85rem; font-weight:500; color:#1C2B4A; }
        .cat-meta   { display:flex; gap:4px; margin-top:2px; }
        .cat-group  { font-size:.65rem; color:#8A8F9A; }
        .cat-badge  { font-size:.6rem; padding:1px 6px; border-radius:4px; }
        .cat-badge--auto   { background:rgba(23,138,94,.1);color:#178a5e; }
        .cat-badge--manual { background:rgba(133,79,11,.1);color:#854F0B; }
        .cat-badge--fixed  { background:rgba(24,95,165,.1);color:#185FA5; }
        .cat-btn {
          font-size:.75rem; padding:4px 10px;
          border:1px solid rgba(28,43,74,.12); border-radius:6px;
          background:none; color:#1C2B4A; cursor:pointer; transition:background .12s;
        }
        .cat-btn:hover { background:rgba(28,43,74,.06); }
        .cat-btn--danger { color:#78303F; border-color:rgba(120,48,63,.15); }
        .cat-btn--danger:hover { background:rgba(120,48,63,.06); }
        .cat-add-btn {
          width:100%; padding:12px; border:none; border-top:0.5px solid rgba(28,43,74,.06);
          background:none; font-size:.83rem; color:#8A8F9A;
          cursor:pointer; text-align:center; transition:background .12s;
        }
        .cat-add-btn:hover { background:rgba(201,168,76,.06); color:#1C2B4A; }

        /* Modal */
        .cat-modal-overlay {
          position:fixed; inset:0; z-index:900;
          background:rgba(28,43,74,.45); backdrop-filter:blur(4px);
          display:flex; align-items:center; justify-content:center; padding:16px;
        }
        .cat-modal {
          background:#FAFAF8; border-radius:20px;
          width:100%; max-width:440px; max-height:90vh; overflow-y:auto;
          box-shadow:0 16px 48px rgba(28,43,74,.18);
        }
        .cat-modal-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:16px 20px 12px; border-bottom:0.5px solid rgba(28,43,74,.08);
          font-family:Georgia,serif; font-style:italic; font-size:1rem; color:#1C2B4A;
        }
        .cat-modal-header button {
          border:none; background:none; font-size:1.5rem; color:#8A8F9A; cursor:pointer;
        }
        .cat-modal-body { padding:16px 20px; display:flex; flex-direction:column; gap:14px; }
        .cat-modal-footer {
          display:flex; justify-content:flex-end; gap:8px;
          padding:12px 20px 16px; border-top:0.5px solid rgba(28,43,74,.08);
        }
        .cat-field { display:flex; flex-direction:column; gap:5px; }
        .cat-field label { font-size:.72rem; font-weight:600; color:#8A8F9A; text-transform:uppercase; letter-spacing:.04em; }
        .cat-field input {
          padding:8px 12px; border:1px solid rgba(28,43,74,.14); border-radius:8px;
          background:var(--white,#fff); font-size:.88rem; color:#1C2B4A; outline:none;
        }
        .cat-field input:focus { border-color:#C9A84C; box-shadow:0 0 0 3px rgba(201,168,76,.12); }
        .cat-field-hint { font-size:.68rem; color:#8A8F9A; }
        .cat-input-wrap { display:flex; align-items:center; gap:6px; }
        .cat-input-wrap input { flex:1; }
        .cat-input-wrap span { font-size:.75rem; color:#8A8F9A; }
        .cat-icon-grid { display:flex; flex-wrap:wrap; gap:4px; }
        .cat-icon-btn {
          width:34px; height:34px; border-radius:8px;
          border:1.5px solid transparent; background:rgba(28,43,74,.04);
          font-size:1.1rem; cursor:pointer; transition:all .1s;
        }
        .cat-icon-btn.selected { border-color:#C9A84C; background:rgba(201,168,76,.1); }
        .cat-color-grid { display:flex; flex-wrap:wrap; gap:6px; }
        .cat-color-btn {
          width:24px; height:24px; border-radius:50%; border:2px solid transparent; cursor:pointer;
        }
        .cat-color-btn.selected { border-color:#1C2B4A; transform:scale(1.15); }
        .cat-error { font-size:.8rem; color:#78303F; padding:8px 12px; background:rgba(120,48,63,.06); border-radius:8px; }
        .cat-cancel-btn {
          padding:9px 20px; border-radius:99px; border:1px solid rgba(28,43,74,.14);
          background:none; color:#8A8F9A; font-size:.85rem; cursor:pointer;
        }
        .cat-save-btn {
          padding:9px 24px; border-radius:99px; border:none;
          background:#1C2B4A; color:#fff; font-size:.85rem; font-weight:500; cursor:pointer;
          transition:opacity .15s;
        }
        .cat-save-btn:hover:not(:disabled) { opacity:.85; }
        .cat-save-btn:disabled { opacity:.6; cursor:not-allowed; }
        .cat-done-btn {
          padding:10px 24px; border-radius:99px;
          background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3);
          color:#8B6914; font-size:.88rem; font-weight:600; cursor:pointer;
          transition:background .15s;
        }
        .cat-done-btn:hover { background:rgba(201,168,76,.2); }
      `}</style>
    </div>
  );
}
