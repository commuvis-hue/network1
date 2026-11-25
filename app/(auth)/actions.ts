'use server';

import { redirect } from 'next/navigation';
import { placeMember } from '@/lib/server/placement';
import { createAdminClient, createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string };

export async function signIn(_: AuthState, formData: FormData): Promise<AuthState> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  });
  if (error || !data.user) return { error: '이메일 또는 비밀번호가 올바르지 않습니다.' };

  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  const isAdmin = profile?.role === 'admin';

  // 원래 가려던 페이지가 있으면 그쪽으로 (회원은 /admin 으로 보내지 않음)
  const next = String(formData.get('next') ?? '');
  if (next.startsWith('/') && !next.startsWith('//') && (isAdmin || !next.startsWith('/admin'))) redirect(next);
  redirect(isAdmin ? '/admin' : '/dashboard');
}

export async function signUp(_: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim();
  const ref = String(formData.get('ref') ?? '').trim().toUpperCase();
  const side = formData.get('side') === 'R' ? 'R' : 'L';
  const agree = formData.get('agree') === 'on';

  if (!name) return { error: '이름을 입력하세요.' };
  if (password.length < 8) return { error: '비밀번호는 8자 이상이어야 합니다.' };
  if (!agree) return { error: '판매원 약관 및 개인정보 처리에 동의해야 합니다.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name, ref, side },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });
  if (error) return { error: error.message };

  if (data.user) {
    try {
      await placeMember(data.user.id);
    } catch (e) {
      // 대시보드 첫 진입 시 다시 시도됨
      console.error('placement failed', e);
    }
  }
  if (!data.session) return { message: '인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료하세요.' };
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
