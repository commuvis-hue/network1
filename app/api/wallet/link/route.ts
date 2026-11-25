import { NextResponse } from 'next/server';
import { getAddress, isAddress, verifyMessage } from 'viem';
import { walletLinkMessage } from '@/lib/chain';
import { getSessionUser } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';

/** 서명으로 지갑 소유를 증명하고 회원 계정에 연결 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { address, signature } = (await req.json().catch(() => ({}))) as {
    address?: string;
    signature?: `0x${string}`;
  };
  if (!address || !isAddress(address) || !signature)
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });

  const db = createAdminClient();
  const { data: profile } = await db.from('profiles').select('wallet_nonce').eq('id', user.id).single();
  if (!profile?.wallet_nonce) return NextResponse.json({ error: '서명 요청을 다시 시작하세요.' }, { status: 400 });

  const ok = await verifyMessage({
    address: getAddress(address),
    message: walletLinkMessage(user.id, profile.wallet_nonce),
    signature,
  }).catch(() => false);
  if (!ok) return NextResponse.json({ error: '서명 검증 실패' }, { status: 400 });

  const { error } = await db
    .from('profiles')
    .update({ wallet_address: address.toLowerCase(), wallet_nonce: null })
    .eq('id', user.id);
  if (error)
    return NextResponse.json(
      { error: error.code === '23505' ? '다른 회원이 이미 사용 중인 지갑입니다.' : '저장 실패' },
      { status: 409 },
    );
  return NextResponse.json({ ok: true });
}
