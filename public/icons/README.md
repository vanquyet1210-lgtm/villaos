# VillaOS PWA Icons

Thư mục này cần các file icon sau (xem hướng dẫn tạo tại scripts/generate-icons.js):

## Bắt buộc
- icon-16.png          (16x16)
- icon-32.png          (32x32)
- icon-180.png         (180x180 - Apple touch)
- icon-192.png         (192x192 - PWA any)
- icon-512.png         (512x512 - PWA any)
- icon-maskable-192.png (192x192 - Android maskable)
- icon-maskable-512.png (512x512 - Android maskable)

## Splash screens (tùy chọn)
- splash-1320x2868.png  (iPhone 16 Pro Max)
- splash-1290x2796.png  (iPhone 14 Pro Max)
- splash-750x1334.png   (iPhone SE)

## Cách tạo nhanh
1. Chuẩn bị 1 ảnh vuông 1024x1024 px
2. Vào: https://www.pwabuilder.com/imageGenerator
3. Upload và download bộ icon
4. Copy vào thư mục này

Hoặc chạy script tự động:
  npm install sharp
  node scripts/generate-icons.js /path/to/icon-1024.png
