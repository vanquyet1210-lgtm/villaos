// VillaOS v7 — app/owner/page.tsx
// Trang chủ owner → redirect thẳng vào lịch đặt phòng
import { redirect } from 'next/navigation';

export default function OwnerHomePage() {
  redirect('/owner/calendar');
}
