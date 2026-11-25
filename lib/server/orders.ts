import 'server-only';
import { createAdminClient } from '@/lib/supabase/server';
import { processPaidOrder } from './commissions';

/** 결제 대기 주문을 결제 완료로 전환하고 재고 차감 + 수당 처리 */
export async function markOrderPaid(orderId: string, extra: { txHash?: string; payFrom?: string } = {}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from('orders')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      ...(extra.txHash ? { tx_hash: extra.txHash.toLowerCase() } : {}),
      ...(extra.payFrom ? { pay_from: extra.payFrom.toLowerCase() } : {}),
    })
    .eq('id', orderId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();
  if (error) {
    if (error.code === '23505') throw new Error('이미 사용된 트랜잭션입니다.');
    throw error;
  }
  if (!data) throw new Error('결제 대기 상태의 주문이 아닙니다.');
  await db.rpc('decrement_stock', { p_order: orderId });
  await processPaidOrder(orderId);
}
