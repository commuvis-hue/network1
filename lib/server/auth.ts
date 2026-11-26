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
  const { data, error } = await admin.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) {
    // 조용히 로그인 화면으로 보내지 않고 원인을 보여줌
    throw new Error(
      `회원 정보를 불러오지 못했습니다 (${error.message}). ` +
        'Vercel 환경변수 SUPABASE_SERVICE_ROLE_KEY 값과, Supabase에서 스키마 SQL을 실행했는지 확인하세요.',
    );
  }

  let profile = data as Profile | null;
  if (!profile) {
    // 스키마 SQL 실행 전에 가입한 계정 등: 프로필이 없으면 새로 만듦
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true });
    const first = (count ?? 0) === 0;
    const { data: created, error: ce } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        name: (user.user_metadata?.name ?? user.user_metadata?.full_name ?? '') as string,
        referral_code: crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase(),
        role: first ? 'admin' : 'member',
        placed: first,
      })
      .select('*')
      .single();
    if (ce) throw new Error(`회원 정보 생성 실패: ${ce.message}`);
    profile = created as Profile;
  }

  if (profile.status === 'suspended') redirect('/login?error=suspended');
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireMember();
  if (profile.role !== 'admin') redirect('/dashboard');
  return profile;
}
