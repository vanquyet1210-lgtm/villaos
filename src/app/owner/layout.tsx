import { getServerSession } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OwnerLayoutClient from './OwnerLayoutClient';

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/auth/login');
  const { profile } = session;
  const isAdmin = profile.role === 'admin';
  return (
    <OwnerLayoutClient
      profileName={profile.name}
      profileBrand={(profile as any).brand ?? ''}
      isAdmin={isAdmin}
    >
      {children}
    </OwnerLayoutClient>
  );
}
