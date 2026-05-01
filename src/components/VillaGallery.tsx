'use client';
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — components/VillaGallery.tsx                   ║
// ║  Port từ buildGalleryHtml() trong ui.js                     ║
// ║  Agoda-style: 1 ảnh lớn + 2 ảnh nhỏ bên phải               ║
// ╚══════════════════════════════════════════════════════════════╝

import { useState } from 'react';

interface VillaGalleryProps {
  images: string[];
  emoji:  string;
  name?:  string;
}

export default function VillaGallery({ images, emoji, name }: VillaGalleryProps) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  // ── Fallback: no images ───────────────────────────────────────
  if (!images || images.length === 0) {
    return (
      <div className="gallery-fallback">
        <div className="gallery-main-placeholder">
          <span className="gallery-emoji">{emoji}</span>
        </div>
        <div className="gallery-side">
          <div className="gallery-side-placeholder">🛁</div>
          <div className="gallery-side-placeholder">🌅</div>
        </div>
        <style>{galleryStyles}</style>
      </div>
    );
  }

  // ── Single image ──────────────────────────────────────────────
  if (images.length === 1) {
    return (
      <>
        <div className="gallery-single" onClick={() => setLightbox(0)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt={name ?? 'Villa'} />
        </div>
        {lightbox !== null && (
          <Lightbox images={images} index={lightbox} onClose={() => setLightbox(null)} />
        )}
        <style>{galleryStyles}</style>
      </>
    );
  }

  // ── 2+ images: Agoda layout ───────────────────────────────────
  const extraCount = images.length > 3 ? images.length - 3 : 0;

  return (
    <>
      <div className="gallery-agoda">
        {/* Main large image */}
        <div className="gallery-main" onClick={() => setLightbox(0)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[0]} alt={name ?? 'Villa'} />
        </div>

        {/* Side images */}
        <div className="gallery-side">
          <div className="gallery-side-cell" onClick={() => setLightbox(1)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={images[1]} alt="" />
          </div>

          {images[2] ? (
            <div className="gallery-side-cell" onClick={() => setLightbox(2)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[2]} alt="" />
              {extraCount > 0 && (
                <div className="gallery-extra-overlay">+{extraCount}</div>
              )}
            </div>
          ) : (
            <div className="gallery-side-placeholder">🌅</div>
          )}
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox
          images={images}
          index={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      <style>{galleryStyles}</style>
    </>
  );
}

// ── Lightbox ──────────────────────────────────────────────────────

function Lightbox({
  images, index, onClose,
}: {
  images: string[];
  index:  number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(index);

  const prev = () => setCurrent(i => (i - 1 + images.length) % images.length);
  const next = () => setCurrent(i => (i + 1) % images.length);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-inner" onClick={e => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose}>×</button>

        {images.length > 1 && (
          <button className="lightbox-nav lightbox-prev" onClick={prev}>‹</button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[current]}
          alt=""
          className="lightbox-img"
        />

        {images.length > 1 && (
          <button className="lightbox-nav lightbox-next" onClick={next}>›</button>
        )}

        <div className="lightbox-counter">{current + 1} / {images.length}</div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────

const galleryStyles = `
  .gallery-agoda {
    display:               grid;
    grid-template-columns: 2fr 1fr;
    grid-template-rows:    130px 130px;
    gap:                   8px;
    border-radius:         var(--radius-lg);
    overflow:              hidden;
    margin-bottom:         16px;
    cursor:                pointer;
  }

  .gallery-main {
    grid-row:      span 2;
    overflow:      hidden;
    border-radius: var(--radius-lg) 0 0 var(--radius-lg);
  }

  .gallery-main img,
  .gallery-side-cell img,
  .gallery-single img {
    width:       100%;
    height:      100%;
    object-fit:  cover;
    display:     block;
    transition:  transform .25s;
  }

  .gallery-main:hover img,
  .gallery-side-cell:hover img { transform: scale(1.03); }

  .gallery-side {
    display:        flex;
    flex-direction: column;
    gap:            8px;
  }

  .gallery-side-cell {
    flex:          1;
    overflow:      hidden;
    position:      relative;
    border-radius: var(--radius-sm);
    cursor:        pointer;
  }

  .gallery-side-cell:first-child { border-radius: 0 var(--radius-lg) 0 0; }
  .gallery-side-cell:last-child  { border-radius: 0 0 var(--radius-lg) 0; }

  .gallery-extra-overlay {
    position:        absolute;
    inset:           0;
    background:      rgba(0,0,0,.45);
    display:         flex;
    align-items:     center;
    justify-content: center;
    color:           white;
    font-size:       1.2rem;
    font-weight:     700;
    font-family:     var(--font-display);
  }

  .gallery-single {
    border-radius: var(--radius-lg);
    overflow:      hidden;
    height:        220px;
    margin-bottom: 16px;
    cursor:        pointer;
  }

  .gallery-fallback {
    display:               grid;
    grid-template-columns: 2fr 1fr;
    grid-template-rows:    130px 130px;
    gap:                   8px;
    border-radius:         var(--radius-lg);
    overflow:              hidden;
    margin-bottom:         16px;
  }

  .gallery-main-placeholder {
    grid-row:        span 2;
    background:      var(--sage-pale);
    display:         flex;
    align-items:     center;
    justify-content: center;
    border-radius:   var(--radius-lg) 0 0 var(--radius-lg);
  }

  .gallery-emoji     { font-size: 4rem; }

  .gallery-side-placeholder {
    flex:            1;
    background:      var(--sage-light);
    display:         flex;
    align-items:     center;
    justify-content: center;
    font-size:       1.6rem;
    border-radius:   var(--radius-sm);
  }

  /* Lightbox */
  .lightbox-overlay {
    position:        fixed;
    inset:           0;
    background:      rgba(0,0,0,.88);
    z-index:         9999;
    display:         flex;
    align-items:     center;
    justify-content: center;
    animation:       fadeIn .15s ease;
  }

  .lightbox-inner {
    position: relative;
    max-width:  92vw;
    max-height: 88vh;
    display:    flex;
    align-items: center;
    justify-content: center;
  }

  .lightbox-img {
    max-width:     88vw;
    max-height:    84vh;
    object-fit:    contain;
    border-radius: var(--radius-md);
    box-shadow:    0 8px 40px rgba(0,0,0,.5);
  }

  .lightbox-close {
    position:        absolute;
    top:             -40px;
    right:           0;
    background:      none;
    border:          none;
    color:           white;
    font-size:       2rem;
    cursor:          pointer;
    line-height:     1;
    opacity:         .8;
    transition:      opacity .15s;
  }

  .lightbox-close:hover { opacity: 1; }

  .lightbox-nav {
    position:        absolute;
    top:             50%;
    transform:       translateY(-50%);
    background:      rgba(255,255,255,.12);
    border:          none;
    color:           white;
    font-size:       2rem;
    width:           44px;
    height:          44px;
    border-radius:   50%;
    cursor:          pointer;
    display:         flex;
    align-items:     center;
    justify-content: center;
    transition:      background .15s;
  }

  .lightbox-nav:hover { background: rgba(255,255,255,.24); }
  .lightbox-prev { left:  -56px; }
  .lightbox-next { right: -56px; }

  .lightbox-counter {
    position:   absolute;
    bottom:     -32px;
    left:       50%;
    transform:  translateX(-50%);
    color:      rgba(255,255,255,.6);
    font-size:  0.82rem;
    white-space: nowrap;
  }
`;
