'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/AmenityManager.tsx                 ║
// ║  Port từ amenity.js — controlled React component            ║
// ║  Không dùng global state, không dùng DOM mutation           ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState, useRef, KeyboardEvent } from 'react';
import { CONFIG } from '@/lib/config';
import { amenityLabel } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────

interface AmenityManagerProps {
  /** Danh sách tiện ích hiện tại */
  value:     string[];
  /** Callback khi danh sách thay đổi */
  onChange:  (amenities: string[]) => void;
  /** Disable toàn bộ (dùng khi form đang submit) */
  disabled?: boolean;
}

// ── Component ─────────────────────────────────────────────────────

export default function AmenityManager({
  value,
  onChange,
  disabled = false,
}: AmenityManagerProps) {
  const [customInput, setCustomInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Handlers ───────────────────────────────────────────────────

  function addPreset(presetValue: string) {
    if (disabled || value.includes(presetValue)) return;
    onChange([...value, presetValue]);
  }

  function remove(amenity: string) {
    if (disabled) return;
    onChange(value.filter(a => a !== amenity));
  }

  function addCustom() {
    const trimmed = customInput.trim();
    if (!trimmed || disabled) return;
    if (!value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setCustomInput('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); addCustom(); }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="amenity-manager">
      {/* Current amenity tags */}
      {value.length > 0 && (
        <div className="amenity-tags-wrap">
          {value.map(a => (
            <span key={a} className="amenity-tag">
              {amenityLabel(a)}
              {!disabled && (
                <button
                  type="button"
                  className="amenity-tag-remove"
                  onClick={() => remove(a)}
                  aria-label={`Xóa ${amenityLabel(a)}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Preset buttons */}
      <div className="amenity-presets">
        {CONFIG.AMENITY_PRESETS.map(p => {
          const used = value.includes(p.value);
          return (
            <button
              key={p.value}
              type="button"
              className={`amenity-preset-btn${used ? ' used' : ''}`}
              onClick={() => addPreset(p.value)}
              disabled={disabled || used}
              aria-pressed={used}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Custom input */}
      {!disabled && (
        <div className="amenity-custom-wrap">
          <input
            ref={inputRef}
            type="text"
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tiện ích khác... (Enter để thêm)"
            className="amenity-custom-input"
            maxLength={40}
          />
          <button
            type="button"
            onClick={addCustom}
            className="amenity-custom-btn"
            disabled={!customInput.trim()}
          >
            + Thêm
          </button>
        </div>
      )}

      {value.length === 0 && (
        <p className="amenity-empty">Chưa có tiện ích nào — chọn từ danh sách hoặc thêm tùy chỉnh</p>
      )}

      <style>{`
        .amenity-manager {
          display:        flex;
          flex-direction: column;
          gap:            12px;
        }

        .amenity-tags-wrap {
          display:   flex;
          flex-wrap: wrap;
          gap:       6px;
        }

        .amenity-presets {
          display:   flex;
          flex-wrap: wrap;
          gap:       6px;
        }

        .amenity-custom-wrap {
          display: flex;
          gap:     8px;
        }

        .amenity-custom-input {
          flex:          1;
          padding:       8px 12px;
          border:        1.5px solid var(--stone);
          border-radius: var(--radius-md);
          font-family:   var(--font-body);
          font-size:     0.875rem;
          color:         var(--ink);
          background:    var(--white);
          outline:       none;
          transition:    border-color .15s, box-shadow .15s;
        }

        .amenity-custom-input:focus {
          border-color: var(--sage);
          box-shadow:   0 0 0 3px rgba(122,171,143,.2);
        }

        .amenity-custom-btn {
          padding:       8px 14px;
          background:    var(--forest);
          color:         var(--white);
          border:        none;
          border-radius: var(--radius-md);
          font-family:   var(--font-body);
          font-size:     0.85rem;
          font-weight:   600;
          cursor:        pointer;
          white-space:   nowrap;
          transition:    background .15s;
        }

        .amenity-custom-btn:hover:not(:disabled) { background: var(--forest-mid); }
        .amenity-custom-btn:disabled { opacity: .45; cursor: not-allowed; }

        .amenity-empty {
          font-size:  0.82rem;
          color:      var(--ink-muted);
          font-style: italic;
        }
      `}</style>
    </div>
  );
}
