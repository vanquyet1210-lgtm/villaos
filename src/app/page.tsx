import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/supabase/server';

export default async function RootPage() {
  const session = await getServerSession();

  if (!session) redirect('/auth/login');

  const { profile } = session;
  switch (profile.role) {
    case 'admin':    redirect('/admin/dashboard');
    case 'owner':    redirect('/owner/dashboard');
    case 'sale':     redirect('/sale/calendar');
    case 'customer': redirect('/customer/villas');
    default:         redirect('/auth/login');
  }
}
