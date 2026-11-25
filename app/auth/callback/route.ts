import { NextResponse, type NextRequest } from 'next/server';
import { placeMember } from '@/lib/server/placement';
import { createAdminClient, createClient } from '@/lib/supabase/server';

/** 이메일 인증 링크 / Google 로그인 후 돌아오는 주소 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  let dest = '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(`${origin}/login?error=oauth`);
    if (data.user) {
      // 구글 가입 화면에서 저장해 둔 추천인 코드·바이너리 위치
      const ref = request.cookies.get('signup_ref')?.value;
      const side = request.cookies.get('signup_side')?.value;
      await placeMember(data.user.id, { ref, side }).catch((e) => console.error(e));

      const { data: profile } = await createAdminClient()
        .from('profiles')
        .select('role, status')
        .eq('id', data.user.id)
        .single();
      if (profile?.status === 'suspended') dest = '/login?error=suspended';
      else if (profile?.role === 'admin') dest = '/admin';
    }
  }

  const res = NextResponse.redirect(`${origin}${dest}`);
  res.cookies.delete('signup_ref');
  res.cookies.delete('signup_side');
  return res;
}
