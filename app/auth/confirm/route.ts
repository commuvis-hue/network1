import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { placeMember } from '@/lib/server/placement';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/**
 * 이메일 인증 링크 처리 (token_hash 방식)
 * 가입한 브라우저와 다른 기기·메일 앱에서 링크를 열어도 인증됩니다.
 * Supabase 메일 템플릿 링크: {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = (searchParams.get('type') ?? 'email') as EmailOtpType;

  if (!token_hash) return NextResponse.redirect(`${origin}/login?error=confirm`);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
  if (error || !data.user) return NextResponse.redirect(`${origin}/login?error=confirm`);

  await placeMember(data.user.id).catch((e) => console.error(e));
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();
  return NextResponse.redirect(`${origin}${profile?.role === 'admin' ? '/admin' : '/dashboard'}`);
}
