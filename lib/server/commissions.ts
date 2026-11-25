import 'server-only';
import {
  binaryMatch,
  computeOrderCommissions,
  evaluateRanks,
  floor2,
  LEGAL_CAP_PERCENT,
  scaleToPool,
  type UplineMember,
} from '@/lib/commission/engine';
import { createAdminClient } from '@/lib/supabase/server';
import { getPlan, getRanks } from './settings';

interface UplineRow {
  member_id: string;
  depth: number;
  status: string;
  rank_level: number;
  recent_pv: number;
}

const toUpline = (rows: UplineRow[] | null, minPv: number): UplineMember[] =>
  (rows ?? []).map((r) => ({
    memberId: r.member_id,
    depth: r.depth,
    rankLevel: r.rank_level,
    active: r.status === 'active' && Number(r.recent_pv) >= minPv,
  }));

/** PostgREST 기본 1000행 제한을 넘는 조회용 페이지네이션 */
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await build(from, from + size - 1);
    if (error) throw error;
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < size) break;
  }
  return out;
}

/**
 * 결제 완료된 주문의 즉시 수당(유니레벨·직급·매트릭스) 계산 + 바이너리 실적 누적.
 * commissions_processed 플래그로 한 번만 실행됨 (멱등).
 */
export async function processPaidOrder(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db
    .from('orders')
    .update({ commissions_processed: true })
    .eq('id', orderId)
    .eq('status', 'paid')
    .eq('commissions_processed', false)
    .select('*')
    .maybeSingle();
  if (!order) return { skipped: true };

  try {
    const [plan, ranks] = await Promise.all([getPlan(), getRanks()]);
    const pv = Number(order.total_pv);
    const amount = Number(order.total_amount);

    const sponsorDepth = plan.unilevel.compression || plan.rank.enabled ? 200 : plan.unilevel.rates.length;
    const [{ data: sponsorRows, error: e1 }, { data: matrixRows, error: e2 }] = await Promise.all([
      db.rpc('sponsor_upline', { p_member: order.member_id, p_max: sponsorDepth }),
      plan.matrix.enabled
        ? db.rpc('matrix_upline', { p_member: order.member_id, p_max: plan.matrix.rates.length })
        : Promise.resolve({ data: [] as UplineRow[], error: null }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;

    const payouts = computeOrderCommissions({
      sponsorUpline: toUpline(sponsorRows as UplineRow[], plan.unilevel.activeMinPv),
      matrixUpline: toUpline(matrixRows as UplineRow[], plan.unilevel.activeMinPv),
      pv,
      saleAmount: amount,
      plan,
      ranks,
    });

    if (payouts.length) {
      const { error } = await db.from('commissions').insert(
        payouts.map((p) => ({
          member_id: p.memberId,
          type: p.type,
          level: p.level,
          order_id: order.id,
          source_member_id: order.member_id,
          base_pv: p.basePv,
          rate: p.rate,
          amount: p.amount,
        })),
      );
      if (error) throw error;
    }

    if (plan.binary.enabled && pv > 0) {
      const { error } = await db.rpc('add_binary_volume', { p_member: order.member_id, p_pv: pv });
      if (error) throw error;
    }
    return { payouts: payouts.length };
  } catch (err) {
    // 실패 시 재처리 가능하도록 플래그 복구
    await db.from('orders').update({ commissions_processed: false }).eq('id', orderId);
    throw err;
  }
}

/** 환불: 주문 상태 변경 + 해당 주문 수당 회수 + 바이너리 실적 차감 */
export async function refundOrder(orderId: string) {
  const db = createAdminClient();
  const { data: order } = await db
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', 'paid')
    .select('*')
    .maybeSingle();
  if (!order) throw new Error('결제 완료 상태의 주문만 환불할 수 있습니다');

  await db.from('commissions').update({ status: 'reversed' }).eq('order_id', orderId);

  if (order.commissions_processed) {
    const plan = await getPlan();
    if (plan.binary.enabled && Number(order.total_pv) > 0) {
      await db.rpc('add_binary_volume', { p_member: order.member_id, p_pv: -Number(order.total_pv) });
    }
  }
}

/**
 * 정기 정산 (Vercel Cron 또는 관리자 수동 실행)
 * 1) 바이너리 매칭 → 기간 매출 × 35% 에서 즉시 수당을 뺀 한도 안으로 비례 축소
 * 2) 직급 평가 (승급)
 */
export async function runSettlement() {
  const db = createAdminClient();
  const [plan, ranks] = await Promise.all([getPlan(), getRanks()]);

  const { data: last } = await db
    .from('settlements')
    .select('period_end')
    .order('period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  const periodStart = last?.period_end ?? '1970-01-01T00:00:00Z';
  const periodEnd = new Date().toISOString();

  // 기간 매출
  const paidOrders = await fetchAll<{ total_amount: number }>((a, b) =>
    db.from('orders').select('total_amount').eq('status', 'paid')
      .gt('paid_at', periodStart).lte('paid_at', periodEnd).order('id').range(a, b),
  );
  const sales = floor2(paidOrders.reduce((s, o) => s + Number(o.total_amount), 0));

  // 기간 내 이미 확정된 주문 수당
  const orderComms = await fetchAll<{ amount: number }>((a, b) =>
    db.from('commissions').select('amount').eq('status', 'confirmed').not('order_id', 'is', null)
      .gt('created_at', periodStart).lte('created_at', periodEnd).order('id').range(a, b),
  );
  const orderPayouts = floor2(orderComms.reduce((s, c) => s + Number(c.amount), 0));

  const cap = Math.min(plan.payoutCapPercent, LEGAL_CAP_PERCENT);
  const pool = Math.max(0, floor2((sales * cap) / 100 - orderPayouts));

  const { data: settlement, error: se } = await db
    .from('settlements')
    .insert({ period_start: periodStart, period_end: periodEnd, sales_amount: sales, order_payouts: orderPayouts, binary_pool: pool })
    .select('id')
    .single();
  if (se) throw se;

  // ── 바이너리 ──
  let binaryPaid = 0;
  if (plan.binary.enabled) {
    const vols = await fetchAll<{ member_id: string; left_pv: number; right_pv: number; profiles: { status: string } }>(
      (a, b) =>
        db.from('binary_volumes').select('member_id, left_pv, right_pv, profiles!inner(status)')
          .gt('left_pv', 0).gt('right_pv', 0).order('member_id').range(a, b),
    );

    const matches = vols.map((v) => {
      const m = binaryMatch(Number(v.left_pv), Number(v.right_pv), plan.binary);
      return { memberId: v.member_id, ...m, amount: v.profiles?.status === 'active' ? m.bonus : 0 };
    });

    const scaled = new Map(
      scaleToPool(matches.filter((m) => m.amount > 0), pool).map((m) => [m.memberId, m.amount]),
    );

    for (const m of matches) {
      if (m.matched <= 0) continue;
      await db
        .from('binary_volumes')
        .update({ left_pv: m.left, right_pv: m.right, updated_at: periodEnd })
        .eq('member_id', m.memberId);
      const amount = scaled.get(m.memberId) ?? 0;
      if (amount > 0) {
        binaryPaid += amount;
        await db.from('commissions').insert({
          member_id: m.memberId,
          type: 'binary',
          level: 0,
          settlement_id: settlement.id,
          base_pv: m.matched,
          rate: plan.binary.rate,
          amount,
        });
      }
    }
  }

  // ── 직급 평가 ──
  let rankChanges = 0;
  if (plan.rank.enabled) {
    const [members, pvRows] = await Promise.all([
      fetchAll<{ id: string; sponsor_id: string | null; rank_level: number; status: string }>((a, b) =>
        db.from('profiles').select('id, sponsor_id, rank_level, status').eq('placed', true).order('id').range(a, b),
      ),
      fetchAll<{ member_id: string; total_pv: number }>((a, b) =>
        db.from('orders').select('member_id, total_pv').eq('status', 'paid').order('id').range(a, b),
      ),
    ]);
    const personal = new Map<string, number>();
    for (const o of pvRows) personal.set(o.member_id, (personal.get(o.member_id) ?? 0) + Number(o.total_pv));

    const { changes } = evaluateRanks(
      members.map((m) => ({
        id: m.id,
        sponsorId: m.sponsor_id,
        rankLevel: m.rank_level,
        active: m.status === 'active',
        personalPv: personal.get(m.id) ?? 0,
      })),
      ranks,
    );
    for (const c of changes) {
      await db.from('profiles').update({ rank_level: c.to }).eq('id', c.id);
    }
    rankChanges = changes.length;
  }

  await db
    .from('settlements')
    .update({ binary_paid: floor2(binaryPaid), rank_changes: rankChanges })
    .eq('id', settlement.id);

  return { periodStart, periodEnd, sales, orderPayouts, pool, binaryPaid: floor2(binaryPaid), rankChanges };
}
