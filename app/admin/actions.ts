'use server';

import { revalidatePath } from 'next/cache';
import { LEGAL_CAP_PERCENT, normalizePlan } from '@/lib/commission/engine';
import { requireAdmin } from '@/lib/server/auth';
import { refundOrder, runSettlement } from '@/lib/server/commissions';
import { markOrderPaid } from '@/lib/server/orders';
import { createAdminClient } from '@/lib/supabase/server';

const nums = (s: FormDataEntryValue | null) =>
  String(s ?? '')
    .split(',')
    .map((x) => Number(x.trim()))
    .filter((x) => Number.isFinite(x) && x >= 0);

// ── 상품 ────────────────────────────────────────────
export async function saveProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get('id') ?? '');
  const stockRaw = String(formData.get('stock') ?? '').trim();
  const row = {
    name: String(formData.get('name') ?? '').trim(),
    description: String(formData.get('description') ?? ''),
    price: Number(formData.get('price')),
    pv: Number(formData.get('pv')),
    image_url: String(formData.get('image_url') ?? '').trim() || null,
    stock: stockRaw === '' ? null : Math.max(0, Math.floor(Number(stockRaw))),
    active: formData.get('active') === 'on',
  };
  if (!row.name || !(row.price > 0) || !(row.pv >= 0)) throw new Error('상품명, 가격, PV를 확인하세요.');
  const db = createAdminClient();
  if (id) await db.from('products').update(row).eq('id', id);
  else await db.from('products').insert(row);
  revalidatePath('/admin/products');
}

export async function toggleProduct(id: string, active: boolean) {
  await requireAdmin();
  await createAdminClient().from('products').update({ active }).eq('id', id);
  revalidatePath('/admin/products');
}

// ── 주문 ────────────────────────────────────────────
export async function confirmOrder(id: string) {
  await requireAdmin();
  await markOrderPaid(id);
  revalidatePath('/admin/orders');
}

export async function refund(id: string) {
  await requireAdmin();
  await refundOrder(id);
  revalidatePath('/admin/orders');
}

// ── 회원 ────────────────────────────────────────────
export async function setMemberStatus(id: string, status: 'active' | 'suspended') {
  const me = await requireAdmin();
  if (id === me.id) return;
  await createAdminClient().from('profiles').update({ status }).eq('id', id);
  revalidatePath('/admin/members');
}

export async function setMemberRole(id: string, role: 'member' | 'admin') {
  const me = await requireAdmin();
  if (id === me.id) return;
  await createAdminClient().from('profiles').update({ role }).eq('id', id);
  revalidatePath('/admin/members');
}

// ── 출금 ────────────────────────────────────────────
export async function markPayoutPaid(id: string, txHash: string) {
  await requireAdmin();
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('트랜잭션 해시 형식이 올바르지 않습니다.');
  await createAdminClient()
    .from('payouts')
    .update({ status: 'paid', tx_hash: txHash.toLowerCase(), processed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'requested');
  revalidatePath('/admin/payouts');
}

export async function rejectPayout(id: string) {
  await requireAdmin();
  await createAdminClient()
    .from('payouts')
    .update({ status: 'rejected', processed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'requested');
  revalidatePath('/admin/payouts');
}

// ── 설정 ────────────────────────────────────────────
export async function savePlan(formData: FormData) {
  await requireAdmin();
  const plan = normalizePlan({
    unilevel: {
      enabled: formData.get('unilevel.enabled') === 'on',
      rates: nums(formData.get('unilevel.rates')),
      compression: formData.get('unilevel.compression') === 'on',
      activeMinPv: Number(formData.get('unilevel.activeMinPv') ?? 0),
    },
    binary: {
      enabled: formData.get('binary.enabled') === 'on',
      rate: Number(formData.get('binary.rate') ?? 0),
      capPerPeriod: Number(formData.get('binary.capPerPeriod') ?? 0),
    },
    matrix: {
      enabled: formData.get('matrix.enabled') === 'on',
      width: Number(formData.get('matrix.width') ?? 3),
      rates: nums(formData.get('matrix.rates')),
    },
    rank: { enabled: formData.get('rank.enabled') === 'on' },
    payoutCapPercent: Math.min(LEGAL_CAP_PERCENT, Number(formData.get('payoutCapPercent') ?? LEGAL_CAP_PERCENT)),
  });
  await createAdminClient()
    .from('settings')
    .update({ config: plan, updated_at: new Date().toISOString() })
    .eq('id', 1);
  revalidatePath('/admin/settings');
}

export async function saveRank(formData: FormData) {
  await requireAdmin();
  const level = Math.floor(Number(formData.get('level')));
  if (!Number.isFinite(level) || level < 0) throw new Error('직급 레벨이 올바르지 않습니다.');
  await createAdminClient()
    .from('ranks')
    .upsert({
      level,
      name: String(formData.get('name') ?? '').trim() || `직급 ${level}`,
      min_personal_pv: Number(formData.get('min_personal_pv') ?? 0),
      min_group_pv: Number(formData.get('min_group_pv') ?? 0),
      min_direct_count: Math.floor(Number(formData.get('min_direct_count') ?? 0)),
      bonus_rate: Math.min(LEGAL_CAP_PERCENT, Math.max(0, Number(formData.get('bonus_rate') ?? 0))),
    });
  revalidatePath('/admin/settings');
}

// ── 정산 ────────────────────────────────────────────
export async function settleNow() {
  await requireAdmin();
  await runSettlement();
  revalidatePath('/admin');
}
