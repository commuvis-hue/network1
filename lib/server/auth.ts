import 'server-only';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/types';

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireMember(): Promise<Profile> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const admin = createAdminClient();
  const { data } = await admin.from('profiles').select('*').eq('id', user.id).single();
  if (!data) redirect('/login');
  const profile = data as Profile;
  if (profile.status === 'suspended') redirect('/login?error=suspended');
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireMember();
  if (profile.role !== 'admin') redirect('/dashboard');
  return profile;
}
