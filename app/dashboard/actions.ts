'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { floor2 } from '@/lib/commission/engine';
import { requireMember } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';

export async function createOrder(items: Array<{ productId: string; qty: number }>, method: 'crypto' | 'manual') {
  const me = await requireMember();
  const clean = items
    .map((i) => ({ productId: String(i.productId), qty: Math.floor(Number(i.qty)) }))
    .filter((i) => i.qty > 0 && i.qty <= 100);
  if (!clean.length) return { error: '상품을 선택하세요.' };

  const db = createAdminClient();
  const { data: products } = await db
    .from('products')
    .select('*')
    .in('id', clean.map((i) => i.productId))
    .eq('active', true);
  const map = new Map(((products ?? []) as Product[]).map((p) => [p.id, p]));

  let total = 0;
  let totalPv = 0;
  const lines = [];
  for (const i of clean) {
    const p = map.get(i.productId);
    if (!p) return { error: '판매 중이 아닌 상품이 포함되어 있습니다.' };
    if (p.stock !== null && p.stock < i.qty) return { error: `${p.name} 재고가 부족합니다.` };
    total += Number(p.price) * i.qty;
    totalPv += Number(p.pv) * i.qty;
    lines.push({ product_id: p.id, name: p.name, qty: i.qty, unit_price: p.price, unit_pv: p.pv });
  }

  const { data: order, error } = await db
    .from('orders')
    .insert({
      member_id: me.id,
      payment_method: method === 'manual' ? 'manual' : 'crypto',
      total_amount: floor2(total),
      total_pv: floor2(totalPv),
    })
    .select('id')
    .single();
  if (error || !order) return { error: '주문 생성에 실패했습니다.' };

  await db.from('order_items').insert(lines.map((l) => ({ ...l, order_id: order.id })));
  redirect(`/dashboard/orders/${order.id}`);
}

export async function cancelOrder(orderId: string) {
  const me = await requireMember();
  const db = createAdminClient();
  await db
    .from('orders')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('member_id', me.id)
    .eq('status', 'pending');
  revalidatePath('/dashboard/orders');
}

export async function requestWithdrawal(_: { error?: string; ok?: boolean }, formData: FormData) {
  const me = await requireMember();
  if (!me.wallet_address) return { error: '먼저 지갑을 연결하세요.' };
  const amount = floor2(Number(formData.get('amount')));
  const min = Number(process.env.NEXT_PUBLIC_MIN_WITHDRAWAL ?? 10);
  if (!Number.isFinite(amount) || amount < min) return { error: `최소 출금 금액은 ${min} 입니다.` };

  const db = createAdminClient();
  const { data: bal } = await db.from('member_balances').select('*').eq('member_id', me.id).single();
  const available = Number(bal?.earned ?? 0) - Number(bal?.withdrawn ?? 0);
  if (amount > available) return { error: '출금 가능 잔액을 초과했습니다.' };

  const { count } = await db
    .from('payouts')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', me.id)
    .eq('status', 'requested');
  if ((count ?? 0) > 0) return { error: '처리 대기 중인 출금 신청이 있습니다.' };

  const { error } = await db
    .from('payouts')
    .insert({ member_id: me.id, amount, wallet_address: me.wallet_address });
  if (error) return { error: '출금 신청에 실패했습니다.' };
  revalidatePath('/dashboard/wallet');
  return { ok: true };
}
