#!/usr/bin/env node
// ╔══════════════════════════════════════════════════════════════╗
// ║  VillaOS v7 — scripts/generate-icons.md                    ║
// ║  Hướng dẫn tạo icon PWA cho VillaOS                        ║
// ╚══════════════════════════════════════════════════════════════╝

/**
 * CÁCH TẠO ICON PWA - 3 BƯỚC
 * ============================
 *
 * BƯỚC 1: Chuẩn bị ảnh gốc
 * -------------------------
 * Cần 1 file ảnh vuông, tối thiểu 1024x1024 px:
 *   - Dùng logo VillaOS nếu có
 *   - Hoặc tạo nhanh: nền màu #2D4A3E + chữ "🏡" trắng ở giữa
 *   - Tools: Figma, Canva, hoặc bất kỳ editor ảnh nào
 *
 *
 * BƯỚC 2: Tạo icon tự động (chọn 1 trong 3 cách)
 * -----------------------------------------------
 *
 * CÁCH A — PWA Builder (khuyến nghị, dễ nhất):
 *   1. Vào: https://www.pwabuilder.com/imageGenerator
 *   2. Upload ảnh gốc 1024x1024
 *   3. Tải về ZIP chứa tất cả kích thước
 *   4. Copy vào thư mục public/icons/
 *
 * CÁCH B — Dùng script npm (cần package 'sharp'):
 *   npm install sharp
 *   node scripts/generate-icons.js  ← chạy file này
 *   (Xem code bên dưới)
 *
 * CÁCH C — App Icon Generator:
 *   1. Vào: https://www.appicon.co
 *   2. Upload ảnh, chọn iOS + Android
 *   3. Download và copy file
 *
 *
 * BƯỚC 3: Đặt file đúng vị trí
 * -----------------------------
 * Tất cả file vào: public/icons/
 *
 * File BẮT BUỘC cho PWA:
 *   public/icons/icon-192.png           ← 192x192 (any)
 *   public/icons/icon-512.png           ← 512x512 (any)
 *   public/icons/icon-maskable-192.png  ← 192x192 (maskable - Android)
 *   public/icons/icon-maskable-512.png  ← 512x512 (maskable - Android)
 *   public/icons/icon-180.png           ← 180x180 (Apple touch)
 *
 * File tùy chọn:
 *   public/icons/icon-32.png            ← 32x32 (favicon)
 *   public/icons/icon-16.png            ← 16x16 (favicon nhỏ)
 *   public/icons/splash-1320x2868.png   ← Splash iPhone 16 Pro Max
 *   public/icons/splash-1290x2796.png   ← Splash iPhone 14 Pro Max
 *   public/icons/splash-750x1334.png    ← Splash iPhone SE
 *   public/screenshots/mobile-calendar.png  ← Screenshot (tùy chọn)
 *   public/screenshots/mobile-villas.png    ← Screenshot (tùy chọn)
 *
 *
 * LƯU Ý VỀ MASKABLE ICON:
 * ------------------------
 * Maskable icon cần "safe zone" 80% ở giữa — phần quan trọng của logo
 * phải nằm trong vùng hình tròn 80% ở giữa, còn 10% mỗi bên có thể bị cắt.
 * Tool kiểm tra: https://maskable.app
 *
 *
 * SAU KHI CÓ ICON:
 * ----------------
 * 1. npm run build && npm run start
 * 2. Mở Chrome DevTools → Application → Manifest
 * 3. Kiểm tra icon hiển thị đúng
 * 4. Chạy Lighthouse → PWA check
 */

// Script tạo icon tự động (cần: npm install sharp)
// Chạy: node scripts/generate-icons.js /path/to/source-icon-1024.png

const path = require('path');
const fs   = require('fs');

const sourceFile = process.argv[2];
if (!sourceFile) {
  console.log('Usage: node scripts/generate-icons.js /path/to/icon-1024.png');
  console.log('\nKhông có sharp? Chạy: npm install sharp');
  process.exit(0);
}

// Kiểm tra sharp có sẵn không
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('❌ Cần cài sharp: npm install sharp');
  process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const ICONS = [
  { name: 'icon-16.png',          size: 16   },
  { name: 'icon-32.png',          size: 32   },
  { name: 'icon-180.png',         size: 180  },
  { name: 'icon-192.png',         size: 192  },
  { name: 'icon-512.png',         size: 512  },
  { name: 'icon-maskable-192.png', size: 192  },
  { name: 'icon-maskable-512.png', size: 512  },
];

// Splash screens (nền màu forest + icon ở giữa)
const SPLASHES = [
  { name: 'splash-1320x2868.png', width: 1320, height: 2868 },
  { name: 'splash-1290x2796.png', width: 1290, height: 2796 },
  { name: 'splash-750x1334.png',  width: 750,  height: 1334 },
];

async function generate() {
  console.log('🎨 Tạo icons từ:', sourceFile);

  // Tạo các kích thước icon
  for (const icon of ICONS) {
    const outPath = path.join(OUTPUT_DIR, icon.name);
    await sharp(sourceFile)
      .resize(icon.size, icon.size, { fit: 'contain', background: '#2D4A3E' })
      .png()
      .toFile(outPath);
    console.log(`  ✅ ${icon.name} (${icon.size}x${icon.size})`);
  }

  // Tạo splash screens
  for (const splash of SPLASHES) {
    const outPath = path.join(OUTPUT_DIR, splash.name);
    const iconSize = Math.min(splash.width, splash.height) * 0.4;
    const left = Math.round((splash.width - iconSize) / 2);
    const top  = Math.round((splash.height - iconSize) / 2);

    const iconBuffer = await sharp(sourceFile)
      .resize(Math.round(iconSize), Math.round(iconSize), { fit: 'contain', background: '#2D4A3E' })
      .png()
      .toBuffer();

    await sharp({
      create: {
        width:      splash.width,
        height:     splash.height,
        channels:   4,
        background: '#2D4A3E',
      }
    })
    .composite([{ input: iconBuffer, left, top }])
    .png()
    .toFile(outPath);

    console.log(`  ✅ ${splash.name} (${splash.width}x${splash.height})`);
  }

  console.log('\n✅ Xong! Tất cả icon đã được tạo trong public/icons/');
  console.log('📱 Tiếp theo: npm run build → kiểm tra Lighthouse PWA score');
}

generate().catch(console.error);
