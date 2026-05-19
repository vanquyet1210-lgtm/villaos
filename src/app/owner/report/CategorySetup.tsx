'use client';
// VillaOS v7 — app/owner/report/CategorySetup.tsx

import { useState, useEffect, useRef } from 'react';
import {
  getCategories,
  upsertCategory,
  deactivateCategory,
  updateCategorySortOrders,
  seedDefaultCategories,
  type Category,
  type CategoryScope,
} from '@/lib/services/report.service';

interface Props { onDone: () => void; }

const ICON_LIST = ['💰','💵','🏡','🅰️','🔵','✨','⚡','💧','🧹','📶','🏷️','👤','🏢','🏦','🚗','🍽️','🌿','🔧'];

type TabType = 'revenue' | 'expense';

// Màu dot theo scope
const SCOPE_COLOR: Record<CategoryScope, string> = {
  per_villa: '#C9A84C',
  shared:    '#185FA5',
};

export default function CategorySetup({ onDone }: Props) {
  const [cats,    setCats]    = useState<Category[]>([]);
  const [tab,     setTab]     = useState<TabType>('revenue');
  const [editing, setEditing] = useState<Partial<Category> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [msg,     setMsg]     = useState('');
  const [seeding, setSeeding] = useState(false);

  // drag state — id là number (khớp với Category.id)
  const dragId  = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  useEffect(() => {
    getCategories().then(c => { setCats(c); setLoading(false); });
  }, []);

  const filtered = cats
    .filter(c => c.type === tab)
    .sort((a, b) => a.sort_order - b.sort_order);

  // ── HTML5 drag-and-drop sort ─────────────────────────────
  const handleDragStart = (e: React.DragEvent, id: number) => {
    dragId.current = id;
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(id);
  };

  const handleDrop = async (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOver(null);
    const fromId = dragId.current;
    if (fromId == null || fromId === targetId) return;

    const reordered = [...filtered];
    const fromIdx   = reordered.findIndex(c => c.id === fromId);
    const toIdx     = reordered.findIndex(c => c.id === targetId);
    const [item]    = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, item);

    // sort_order khớp với service (snake_case)
    const newOrders = reordered.map((c, i) => ({ id: c.id, sort_order: i }));

    // Optimistic UI
    setCats(prev => {
      const otherTab = prev.filter(c => c.type !== tab);
      const updated  = reordered.map((c, i) => ({ ...c, sort_order: i }));
      return [...otherTab, ...updated];
    });

    await updateCategorySortOrders(newOrders);
    dragId.current = null;
  };

  const handleDragEnd = () => {
    setDragOver(null);
    dragId.current = null;
  };

  const handleSeed = async () => {
    if (!confirm('Tạo toàn bộ danh mục mặc định? Chỉ thực hiện khi chưa có danh mục nào.')) return;
    setSeeding(true);
    const { inserted, error } = await seedDefaultCategories();
    if (error) {
      setMsg(error);
    } else {
      const updated = await getCategories();
      setCats(updated);
      setMsg(`✓ Đã tạo ${inserted} danh mục mặc định`);
    }
    setSeeding(false);
  };

  // ── Save / deactivate ────────────────────────────────────
  const handleSave = async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { setMsg('Vui lòng nhập tên danh mục'); return; }
    setSaving(true);
    const res = await upsertCategory({
      id:    editing.id,
      name:  editing.name!,
      type:  editing.type ?? tab,
      scope: editing.scope ?? 'per_villa',
      icon:  editing.icon ?? '💰',
    });
    if (res.error) {
      setMsg(res.error);
    } else {
      const updated = await getCategories();
      setCats(updated);
      setEditing(null);
      setMsg('');
    }
    setSaving(false);
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Ẩn danh mục này khỏi báo cáo?')) return;
    await deactivateCategory(id);
    setCats(prev => prev.filter(c => c.id !== id));
  };

  if (loading) return (
    <div style={{ padding:'24px', textAlign:'center', color:'#8A8F9A' }}>Đang tải...</div>
  );

  return (
    <div className="cat-setup">
      {/* Tabs */}
      <div className="cat-tabs">
        <button className={`cat-tab${tab === 'revenue' ? ' active' : ''}`} onClick={() => setTab('revenue')}>💚 Doanh thu</button>
        <button className={`cat-tab${tab === 'expense' ? ' active' : ''}`} onClick={() => setTab('expense')}>🔴 Chi phí</button>
      </div>

      {/* List */}
      <div className="cat-list">
        {filtered.map(c => (
          <div
            key={c.id}
            className={`cat-row${dragOver === c.id ? ' cat-row--dragover' : ''}`}
            draggable
            onDragStart={e => handleDragStart(e, c.id)}
            onDragOver={e  => handleDragOver(e, c.id)}
            onDrop={e      => handleDrop(e, c.id)}
            onDragEnd={handleDragEnd}
          >
            <div className="cat-row-left">
              <span className="cat-drag" title="Kéo để sắp xếp">⠿</span>
              <span className="cat-dot" style={{ background: SCOPE_COLOR[c.scope] }} />
              <span className="cat-icon">{c.icon}</span>
              <div>
                <div className="cat-name">{c.name}</div>
                <div className="cat-meta">
                  {c.scope === 'shared'
                    ? <span className="cat-badge cat-badge--shared">dùng chung</span>
                    : <span className="cat-badge cat-badge--villa">riêng villa</span>
                  }
                </div>
              </div>
            </div>
            <div className="cat-row-right">
              <button className="cat-btn" onClick={() => setEditing({ ...c })}>Sửa</button>
              <button className="cat-btn cat-btn--danger" onClick={() => handleDeactivate(c.id)}>Ẩn</button>
            </div>
          </div>
        ))}

        <button
          className="cat-add-btn"
          onClick={() => setEditing({ type: tab, icon: '💰', scope: 'per_villa' })}
        >
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
              {/* Tên */}
              <div className="cat-field">
                <label>Tên danh mục *</label>
                <input
                  value={editing.name ?? ''}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  placeholder="VD: Doanh thu spa, Tiền gas..."
                />
              </div>

              {/* Scope — chỉ cho expense */}
              {(editing.type ?? tab) === 'expense' && (
                <div className="cat-field">
                  <label>Phạm vi chi phí</label>
                  <div className="cat-scope-row">
                    <button
                      className={`cat-scope-btn${(editing.scope ?? 'per_villa') === 'per_villa' ? ' selected' : ''}`}
                      onClick={() => setEditing(p => ({ ...p, scope: 'per_villa' as CategoryScope }))}
                    >
                      🏠 Riêng từng villa
                    </button>
                    <button
                      className={`cat-scope-btn${editing.scope === 'shared' ? ' selected' : ''}`}
                      onClick={() => setEditing(p => ({ ...p, scope: 'shared' as CategoryScope }))}
                    >
                      🤝 Dùng chung
                    </button>
                  </div>
                  <div className="cat-field-hint">
                    {editing.scope === 'shared'
                      ? 'Chi phí này sẽ được phân bổ theo % cho các villa.'
                      : 'Chi phí này nhập riêng cho từng villa.'}
                  </div>
                </div>
              )}

              {/* Icon */}
              <div className="cat-field">
                <label>Icon</label>
                <div className="cat-icon-grid">
                  {ICON_LIST.map(ic => (
                    <button
                      key={ic}
                      className={`cat-icon-btn${editing.icon === ic ? ' selected' : ''}`}
                      onClick={() => setEditing(p => ({ ...p, icon: ic }))}
                    >{ic}</button>
                  ))}
                </div>
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

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <button className="cat-seed-btn" disabled={seeding} onClick={handleSeed}>
            {seeding ? 'Đang tạo...' : '✦ Tạo danh mục mặc định'}
          </button>
          {msg && <span style={{ fontSize:'.78rem', color: msg.startsWith('✓') ? '#0A6B44' : '#78303F' }}>{msg}</span>}
        </div>
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
          cursor:grab; transition:background .1s, transform .1s;
          user-select:none;
        }
        .cat-row:last-of-type { border-bottom:none; }
        .cat-row:hover        { background:rgba(28,43,74,.02); }
        .cat-row--dragover    {
          background:rgba(201,168,76,.08);
          border-top:2px solid #C9A84C;
          transform:translateY(-1px);
        }
        .cat-row-left  { display:flex; align-items:center; gap:8px; flex:1; }
        .cat-row-right { display:flex; gap:6px; }
        .cat-drag   { color:#C9A84C; font-size:1rem; cursor:grab; }
        .cat-dot    { width:8px; height:8px; border-radius:50%; flex-shrink:0; }
        .cat-icon   { font-size:1rem; }
        .cat-name   { font-size:.85rem; font-weight:500; color:#1C2B4A; }
        .cat-meta   { display:flex; gap:4px; margin-top:2px; }
        .cat-badge  { font-size:.6rem; padding:1px 6px; border-radius:4px; }
        .cat-badge--shared { background:rgba(24,95,165,.1);   color:#185FA5; }
        .cat-badge--villa  { background:rgba(201,168,76,.12); color:#8B6914; }
        .cat-btn {
          font-size:.75rem; padding:4px 10px;
          border:1px solid rgba(28,43,74,.12); border-radius:6px;
          background:none; color:#1C2B4A; cursor:pointer; transition:background .12s;
        }
        .cat-btn:hover { background:rgba(28,43,74,.06); }
        .cat-btn--danger { color:#78303F; border-color:rgba(120,48,63,.15); }
        .cat-btn--danger:hover { background:rgba(120,48,63,.06); }
        .cat-add-btn {
          width:100%; padding:12px; border:none;
          border-top:0.5px solid rgba(28,43,74,.06);
          background:none; font-size:.83rem; color:#8A8F9A;
          cursor:pointer; text-align:center; transition:background .12s;
        }
        .cat-add-btn:hover { background:rgba(201,168,76,.06); color:#1C2B4A; }
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
        .cat-modal-header button { border:none; background:none; font-size:1.5rem; color:#8A8F9A; cursor:pointer; }
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
        .cat-scope-row { display:flex; gap:6px; }
        .cat-scope-btn {
          flex:1; padding:8px 10px; border-radius:8px; font-size:.78rem;
          border:1.5px solid rgba(28,43,74,.12); background:none;
          color:#8A8F9A; cursor:pointer; transition:all .12s; text-align:center;
        }
        .cat-scope-btn.selected {
          border-color:#C9A84C; background:rgba(201,168,76,.08);
          color:#1C2B4A; font-weight:500;
        }
        .cat-icon-grid  { display:flex; flex-wrap:wrap; gap:4px; }
        .cat-icon-btn {
          width:34px; height:34px; border-radius:8px;
          border:1.5px solid transparent; background:rgba(28,43,74,.04);
          font-size:1.1rem; cursor:pointer; transition:all .1s;
        }
        .cat-icon-btn.selected { border-color:#C9A84C; background:rgba(201,168,76,.1); }
        .cat-error {
          font-size:.8rem; color:#78303F;
          padding:8px 12px; background:rgba(120,48,63,.06); border-radius:8px;
        }
        .cat-cancel-btn {
          padding:9px 20px; border-radius:99px; border:1px solid rgba(28,43,74,.14);
          background:none; color:#8A8F9A; font-size:.85rem; cursor:pointer;
        }
        .cat-save-btn {
          padding:9px 24px; border-radius:99px; border:none;
          background:#1C2B4A; color:#fff; font-size:.85rem; font-weight:500;
          cursor:pointer; transition:opacity .15s;
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
        .cat-seed-btn {
          padding:10px 20px; border-radius:99px;
          background:rgba(24,95,165,.07); border:1px solid rgba(24,95,165,.2);
          color:#185FA5; font-size:.83rem; font-weight:500; cursor:pointer;
          transition:background .15s;
        }
        .cat-seed-btn:hover:not(:disabled) { background:rgba(24,95,165,.14); }
        .cat-seed-btn:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
