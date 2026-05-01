'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/Toast.tsx                          ║
// ║  Thay thế Toast từ ui.js — dùng React context + portal     ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  createContext, useContext, useState, useCallback,
  useEffect, ReactNode, useId,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id:      string;
  type:    ToastType;
  title:   string;
  msg?:    string;
  duration: number;
}

interface ToastContextValue {
  show: (type: ToastType, title: string, msg?: string, duration?: number) => void;
}

// ── Context ───────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// ── Provider ──────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((
    type:     ToastType,
    title:    string,
    msg?:     string,
    duration: number = 3500,
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts(prev => [...prev.slice(-4), { id, type, title, msg, duration }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="region" aria-label="Thông báo">
        {toasts.map(t => (
          <ToastItem key={t.id} item={t} onRemove={remove} />
        ))}
      </div>

      <style>{`
        .toast-container {
          position:       fixed;
          bottom:         24px;
          right:          24px;
          z-index:        9999;
          display:        flex;
          flex-direction: column;
          gap:            8px;
          max-width:      360px;
          width:          calc(100vw - 48px);
        }

        .toast-item {
          display:       flex;
          align-items:   flex-start;
          gap:           10px;
          padding:       12px 14px;
          background:    var(--white);
          border-radius: var(--radius-md);
          box-shadow:    var(--shadow-lg);
          border-left:   4px solid;
          animation:     toastIn .2s ease;
          cursor:        pointer;
        }

        .toast-item.success { border-color: var(--sage); }
        .toast-item.error   { border-color: var(--red); }
        .toast-item.warning { border-color: var(--amber); }
        .toast-item.info    { border-color: var(--stone); }

        .toast-icon { font-size: 1.1rem; flex-shrink: 0; margin-top: 1px; }

        .toast-body { flex: 1; min-width: 0; }

        .toast-title {
          font-size:   0.875rem;
          font-weight: 700;
          color:       var(--ink);
          line-height: 1.3;
        }

        .toast-msg {
          font-size:  0.8rem;
          color:      var(--ink-light);
          margin-top: 2px;
          line-height: 1.4;
        }

        .toast-close {
          background:  none;
          border:      none;
          cursor:      pointer;
          color:       var(--ink-muted);
          font-size:   1rem;
          padding:     0;
          line-height: 1;
          flex-shrink: 0;
        }

        .toast-close:hover { color: var(--ink); }

        @keyframes toastIn {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

// ── Single Toast Item ─────────────────────────────────────────────

const ICONS: Record<ToastType, string> = {
  success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️',
};

function ToastItem({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onRemove]);

  return (
    <div
      className={`toast-item ${item.type}`}
      onClick={() => onRemove(item.id)}
      role="alert"
    >
      <span className="toast-icon">{ICONS[item.type]}</span>
      <div className="toast-body">
        <div className="toast-title">{item.title}</div>
        {item.msg && <div className="toast-msg">{item.msg}</div>}
      </div>
      <button className="toast-close" aria-label="Đóng">×</button>
    </div>
  );
}
