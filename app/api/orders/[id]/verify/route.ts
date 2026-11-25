import { NextResponse } from 'next/server';
import { createPublicClient, erc20Abi, http, isHash, parseEventLogs, parseUnits } from 'viem';
import { appChain, RPC_URL, TOKEN_ADDRESS, TOKEN_DECIMALS, TREASURY_ADDRESS } from '@/lib/chain';
import { getSessionUser } from '@/lib/server/auth';
import { markOrderPaid } from '@/lib/server/orders';
import { createAdminClient } from '@/lib/supabase/server';

const client = createPublicClient({ chain: appChain, transport: http(RPC_URL) });

/** 온체인 ERC-20 전송을 검증하고 주문을 결제 완료로 전환 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const { txHash } = (await req.json().catch(() => ({}))) as { txHash?: string };
  if (!txHash || !isHash(txHash)) return NextResponse.json({ error: '잘못된 트랜잭션 해시' }, { status: 400 });

  const db = createAdminClient();
  const [{ data: order }, { data: profile }] = await Promise.all([
    db.from('orders').select('*').eq('id', id).eq('member_id', user.id).maybeSingle(),
    db.from('profiles').select('wallet_address').eq('id', user.id).single(),
  ]);
  if (!order) return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
  if (order.status !== 'pending' || order.payment_method !== 'crypto')
    return NextResponse.json({ error: '결제 대기 중인 지갑 결제 주문이 아닙니다.' }, { status: 409 });
  if (!profile?.wallet_address) return NextResponse.json({ error: '연결된 지갑이 없습니다.' }, { status: 400 });

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return NextResponse.json({ message: '트랜잭션을 아직 찾을 수 없습니다. 잠시 후 다시 확인합니다.' }, { status: 202 });
  }
  if (receipt.status !== 'success') return NextResponse.json({ error: '실패한 트랜잭션입니다.' }, { status: 400 });

  const minConf = BigInt(process.env.PAYMENT_MIN_CONFIRMATIONS ?? 3);
  const head = await client.getBlockNumber();
  const confirmations = head - receipt.blockNumber + BigInt(1);
  if (confirmations < minConf)
    return NextResponse.json(
      { message: `블록 확인 대기 중 (${confirmations}/${minConf})` },
      { status: 202 },
    );

  const logs = parseEventLogs({ abi: erc20Abi, eventName: 'Transfer', logs: receipt.logs });
  const wallet = profile.wallet_address.toLowerCase();
  const paid = logs
    .filter(
      (l) =>
        l.address.toLowerCase() === TOKEN_ADDRESS.toLowerCase() &&
        l.args.to.toLowerCase() === TREASURY_ADDRESS.toLowerCase() &&
        l.args.from.toLowerCase() === wallet,
    )
    .reduce((s, l) => s + l.args.value, BigInt(0));

  const required = parseUnits(Number(order.total_amount).toFixed(2), TOKEN_DECIMALS);
  if (paid < required)
    return NextResponse.json({ error: '전송 금액 또는 수신 주소가 주문과 일치하지 않습니다.' }, { status: 400 });

  try {
    await markOrderPaid(order.id, { txHash, payFrom: wallet });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '처리 실패' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}
