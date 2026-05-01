'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7.1 — components/AuditLogViewer.tsx               ║
// ║  Hiển thị audit log cho Owner/Admin                         ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useEffect, useTransition } from 'react';
import { getAuditLogs }  from '@/lib/services/audit.service';
import type { AuditLog, AuditAction } from '@/lib/services/audit.service';

// ── Action labels (human-readable) ───────────────────────────────

const ACTION_LABELS: Record<AuditAction, { label: string; emoji: string; color: string }> = {
  'booking.created':      { label: 'Tạo booking',       emoji: '📅', color: '#16a34a' },
  'booking.confirmed':    { label: 'Xác nhận booking',  emoji: '✅', color: '#16a34a' },
  'booking.cancelled':    { label: 'Hủy booking',       emoji: '❌', color: '#dc2626' },
  'booking.updated':      { label: 'Sửa booking',       emoji: '✏️', color: '#d97706' },
  'booking.hold_created': { label: 'Tạo hold',          emoji: '⏳', color: '#d97706' },
  'booking.hold_expired': { label: 'Hold hết hạn',      emoji: '⌛', color: '#6b7280' },
  'villa.created':        { label: 'Thêm villa',        emoji: '🏡', color: '#16a34a' },
  'villa.updated':        { label: 'Sửa villa',         emoji: '✏️', color: '#d97706' },
  'villa.deleted':        { label: 'Xóa villa',         emoji: '🗑️', color: '#dc2626' },
  'villa.date_locked':    { label: 'Khóa ngày',         emoji: '🔒', color: '#7c3aed' },
  'villa.date_unlocked':  { label: 'Mở khóa ngày',     emoji: '🔓', color: '#7c3aed' },
  'user.login':           { label: 'Đăng nhập',         emoji: '🔑', color: '#6b7280' },
  'user.logout':          { label: 'Đăng xuất',         emoji: '👋', color: '#6b7280' },
  'user.registered':      { label: 'Đăng ký',           emoji: '👤', color: '#16a34a' },
  'user.created_by_admin':{ label: 'Admin tạo tài khoản',emoji: '⚡', color: '#7c3aed' },
  'user.deleted':         { label: 'Xóa tài khoản',    emoji: '🗑️', color: '#dc2626' },
  'sale.access_granted':  { label: 'Cấp quyền Sale',   emoji: '🔓', color: '#16a34a' },
  'sale.access_revoked':  { label: 'Thu quyền Sale',   emoji: '🔒', color: '#dc2626' },
};

// ── Component ─────────────────────────────────────────────────────

interface AuditLogViewerProps {
  entityId?:   string;  // Xem log của 1 booking/villa cụ thể
  entityType?: string;
  maxItems?:   number;
}

export default function AuditLogViewer({
  entityId,
  entityType,
  maxItems = 50,
}: AuditLogViewerProps) {
  const [logs,      setLogs]      = useState<AuditLog[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLoading(true);
    startTransition(async () => {
      const { data } = await getAuditLogs({ entityId, entityType, limit: maxItems });
      setLogs(data ?? []);
      setLoading(false);
    });
  }, [entityId, entityType, maxItems]);

  if (loading) return <div className="audit-loading">Đang tải lịch sử...</div>;
  if (!logs.length) return <div className="audit-empty">Chưa có hoạt động nào.</div>;

  return (
    <div className="audit-log-viewer">
      <h3 className="audit-title">📋 Lịch sử hoạt động</h3>

      <div className="audit-list">
        {logs.map(log => {
          const meta = ACTION_LABELS[log.action] ?? { label: log.action, emoji: '📝', color: '#6b7280' };
          const isExpanded = expanded === log.id;
          const hasChanges = log.oldData || log.newData;

          return (
            <div key={log.id} className="audit-item">
              {/* Main row */}
              <div className="audit-item-main">
                <span className="audit-emoji">{meta.emoji}</span>

                <div className="audit-item-body">
                  <div className="audit-item-header">
                    <span className="audit-action" style={{ color: meta.color }}>
                      {meta.label}
                    </span>
                    {log.entityName && (
                      <span className="audit-entity">— {log.entityName}</span>
                    )}
                  </div>

                  <div className="audit-item-meta">
                    <span className="audit-actor">
                      {roleEmoji(log.actorRole)} {log.actorName}
                    </span>
                    <span className="audit-time">
                      {formatAuditTime(log.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Expand button nếu có diff */}
                {hasChanges && (
                  <button
                    className="audit-expand-btn"
                    onClick={() => setExpanded(isExpanded ? null : log.id)}
                    title="Xem chi tiết thay đổi"
                  >
                    {isExpanded ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {/* Expanded diff view */}
              {isExpanded && hasChanges && (
                <div className="audit-diff">
                  {log.oldData && (
                    <div className="audit-diff-section old">
                      <span className="audit-diff-label">Trước</span>
                      <pre>{JSON.stringify(log.oldData, null, 2)}</pre>
                    </div>
                  )}
                  {log.newData && (
                    <div className="audit-diff-section new">
                      <span className="audit-diff-label">Sau</span>
                      <pre>{JSON.stringify(log.newData, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function roleEmoji(role: string): string {
  return role === 'admin' ? '⚡' : role === 'owner' ? '👑' : role === 'sale' ? '🏷️' : '👥';
}

function formatAuditTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1)   return 'Vừa xong';
  if (mins < 60)  return `${mins} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7)   return `${days} ngày trước`;

  return d.toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
