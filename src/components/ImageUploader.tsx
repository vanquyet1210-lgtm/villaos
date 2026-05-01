'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/ImageUploader.tsx                  ║
// ║  Port từ image.js — upload, compress, drag-sort ảnh         ║
// ║  Không dùng external lib, pure React + Canvas API           ║
// ╚══════════════════════════════════════════════════════════════╝

import {
  useState, useRef, useCallback, DragEvent, ChangeEvent,
} from 'react';
import { CONFIG } from '@/lib/config';

// ── Types ─────────────────────────────────────────────────────────

interface ImageUploaderProps {
  /** Danh sách ảnh hiện tại (base64 hoặc URL) */
  value:     string[];
  /** Callback khi danh sách thay đổi */
  onChange:  (images: string[]) => void;
  disabled?: boolean;
}

// ── Image compress helper (dùng Canvas, giống image.js) ───────────

function compressImage(src: string): Promise<string> {
  const { MAX_PX, JPEG_QUALITY } = CONFIG.IMAGE;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width: w, height: h } = img;
      if (w > MAX_PX || h > MAX_PX) {
        if (w >= h) { h = Math.round(h * MAX_PX / w); w = MAX_PX; }
        else        { w = Math.round(w * MAX_PX / h); h = MAX_PX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.src = src;
  });
}

// ── Component ─────────────────────────────────────────────────────

export default function ImageUploader({
  value,
  onChange,
  disabled = false,
}: ImageUploaderProps) {
  const fileInputRef  = useRef<HTMLInputElement>(null);
  const dragSrcRef    = useRef<number | null>(null);
  const [dragging, setDragging]   = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const { MAX_COUNT } = CONFIG.IMAGE;
  const canAddMore    = value.length < MAX_COUNT && !disabled;

  // ── Upload handler ──────────────────────────────────────────────

  const handleFileChange = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    const remaining = MAX_COUNT - value.length;
    const toProcess = files
      .slice(0, remaining)
      .filter(f => f.type.startsWith('image/'));

    if (!toProcess.length) { e.target.value = ''; return; }

    setUploading(true);
    try {
      const compressed = await Promise.all(
        toProcess.map(file => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async ev => {
            try { resolve(await compressImage(ev.target!.result as string)); }
            catch(err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      onChange([...value, ...compressed]);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [value, onChange, MAX_COUNT]);

  // ── Remove ──────────────────────────────────────────────────────

  const removeImage = useCallback((idx: number) => {
    if (disabled) return;
    onChange(value.filter((_, i) => i !== idx));
  }, [value, onChange, disabled]);

  // ── Drag & sort ─────────────────────────────────────────────────

  const handleDragStart = (e: DragEvent<HTMLDivElement>, idx: number) => {
    dragSrcRef.current = idx;
    setDragging(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(idx);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    const srcIdx = dragSrcRef.current;
    if (srcIdx === null || srcIdx === targetIdx) { resetDrag(); return; }

    const next = [...value];
    const [moved] = next.splice(srcIdx, 1);
    next.splice(targetIdx, 0, moved);
    onChange(next);
    resetDrag();
  };

  const resetDrag = () => {
    dragSrcRef.current = null;
    setDragging(null);
    setDropTarget(null);
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="img-uploader">
      {/* Grid */}
      <div className="img-preview-grid">
        {value.map((src, i) => (
          <div
            key={`${src.slice(-20)}-${i}`}
            className={[
              'villa-img-thumb',
              i === 0         ? 'is-cover'    : '',
              dragging === i  ? 'is-dragging' : '',
              dropTarget === i && dragging !== i ? 'is-drop-target' : '',
            ].filter(Boolean).join(' ')}
            draggable={!disabled}
            onDragStart={e => handleDragStart(e, i)}
            onDragOver={e  => handleDragOver(e, i)}
            onDrop={e      => handleDrop(e, i)}
            onDragEnd={resetDrag}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Ảnh ${i + 1}`} />
            {i === 0 && <span className="villa-img-cover-badge">Bìa</span>}
            {!disabled && (
              <button
                type="button"
                className="villa-img-remove"
                onClick={() => removeImage(i)}
                aria-label={`Xóa ảnh ${i + 1}`}
              >
                ✕
              </button>
            )}
            {/* Drag handle indicator */}
            {!disabled && (
              <span className="img-drag-handle" title="Kéo để sắp xếp">⠿</span>
            )}
          </div>
        ))}

        {/* Add button */}
        {canAddMore && (
          <button
            type="button"
            className="img-add-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <span className="img-uploading">⏳</span>
            ) : (
              <>
                <span className="img-add-icon">+</span>
                <span className="img-add-label">
                  {value.length === 0 ? 'Thêm ảnh' : `${value.length}/${MAX_COUNT}`}
                </span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Counter */}
      {value.length > 0 && (
        <p className="img-counter">
          {value.length}/{MAX_COUNT} ảnh
          {value.length > 1 && !disabled && ' — kéo để sắp xếp, ảnh đầu làm bìa'}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <style>{`
        .img-uploader {
          display:        flex;
          flex-direction: column;
          gap:            10px;
        }

        .img-preview-grid {
          display:               grid;
          grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
          gap:                   8px;
        }

        .villa-img-thumb {
          position:      relative;
          border-radius: var(--radius-md);
          overflow:      hidden;
          aspect-ratio:  1;
          background:    var(--sage-pale);
          cursor:        grab;
          border:        2px solid transparent;
          transition:    border-color .15s, opacity .15s, transform .15s;
        }

        .villa-img-thumb img {
          width:       100%;
          height:      100%;
          object-fit:  cover;
          display:     block;
          pointer-events: none;
        }

        .villa-img-thumb.is-cover {
          border-color: var(--forest);
        }

        .villa-img-thumb.is-dragging {
          opacity:   .5;
          transform: scale(.95);
          cursor:    grabbing;
        }

        .villa-img-thumb.is-drop-target {
          border-color:  var(--sage);
          border-style:  dashed;
          transform:     scale(1.03);
        }

        .villa-img-cover-badge {
          position:      absolute;
          top:           4px;
          left:          4px;
          background:    var(--forest);
          color:         var(--white);
          font-size:     0.62rem;
          padding:       2px 6px;
          border-radius: 99px;
          font-weight:   700;
          letter-spacing: 0.04em;
        }

        .villa-img-remove {
          position:        absolute;
          top:             4px;
          right:           4px;
          background:      rgba(0,0,0,.55);
          color:           white;
          border:          none;
          width:           20px;
          height:          20px;
          border-radius:   50%;
          font-size:       0.65rem;
          cursor:          pointer;
          display:         flex;
          align-items:     center;
          justify-content: center;
          opacity:         0;
          transition:      opacity .15s;
        }

        .villa-img-thumb:hover .villa-img-remove { opacity: 1; }

        .img-drag-handle {
          position:   absolute;
          bottom:     4px;
          left:       50%;
          transform:  translateX(-50%);
          color:      rgba(255,255,255,.7);
          font-size:  0.85rem;
          opacity:    0;
          transition: opacity .15s;
          pointer-events: none;
        }

        .villa-img-thumb:hover .img-drag-handle { opacity: 1; }

        .img-add-btn {
          aspect-ratio:    1;
          border:          2px dashed var(--stone);
          border-radius:   var(--radius-md);
          background:      var(--parchment);
          display:         flex;
          flex-direction:  column;
          align-items:     center;
          justify-content: center;
          gap:             4px;
          cursor:          pointer;
          transition:      border-color .15s, background .15s;
          color:           var(--ink-muted);
          min-height:      88px;
        }

        .img-add-btn:hover:not(:disabled) {
          border-color: var(--sage);
          background:   var(--sage-pale);
          color:        var(--forest);
        }

        .img-add-btn:disabled { opacity: .5; cursor: not-allowed; }

        .img-add-icon  { font-size: 1.4rem; line-height: 1; }
        .img-add-label { font-size: 0.72rem; font-weight: 600; }
        .img-uploading { font-size: 1.4rem; }

        .img-counter {
          font-size:  0.78rem;
          color:      var(--ink-muted);
          text-align: center;
        }
      `}</style>
    </div>
  );
}
