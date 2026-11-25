import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/server';
import { explorerTx } from '@/lib/chain';
import { date, money, num, ORDER_STATUS_LABEL } from '@/lib/format';
import { confirmOrder, refund } from '../actions';

const FILTERS = ['all', 'pending', 'paid', 'refunded', 'cancelled'] as const;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const s = (await searchParams).s ?? 'all';
  const db = createAdminClient();
  let q = db
    .from('orders')
    .select('*, member:profiles!orders_member_id_fkey(name, email)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (s !== 'all') q = q.eq('status', s);
  const { data } = await q;

  return (
    <div className="space-y-6">
      <h1 className="h1">주문 관리</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link key={f} href={`?s=${f}`} className={f === s ? 'btn' : 'btn-outline'}>
            {f === 'all' ? '전체' : ORDER_STATUS_LABEL[f]}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>주문일</th><th>주문번호</th><th>회원</th><th>금액</th><th>PV</th><th>결제</th><th>상태</th><th>처리</th></tr>
          </thead>
          <tbody>
            {(data ?? []).map((o) => (
              <tr key={o.id}>
                <td>{date(o.created_at)}</td>
                <td className="font-mono text-xs">{o.id.slice(0, 8)}</td>
                <td>{o.member?.name} <span className="text-xs text-slate-400">{o.member?.email}</span></td>
                <td>{money(o.total_amount)}</td>
                <td>{num(o.total_pv)}</td>
                <td>
                  {o.payment_method === 'crypto' ? '지갑' : '무통장'}
                  {o.tx_hash && <a href={explorerTx(o.tx_hash)} target="_blank" className="ml-1 text-brand-600 underline">tx</a>}
                </td>
                <td><span className="badge">{ORDER_STATUS_LABEL[o.status]}</span></td>
                <td className="space-x-2">
                  {o.status === 'pending' && o.payment_method === 'manual' && (
                    <form action={confirmOrder.bind(null, o.id)} className="inline">
                      <button className="btn-outline px-2 py-1 text-xs">입금 확인</button>
                    </form>
                  )}
                  {o.status === 'paid' && (
                    <form action={refund.bind(null, o.id)} className="inline">
                      <button className="btn-danger">환불 · 수당 회수</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {!data?.length && <tr><td colSpan={8} className="text-slate-400">주문이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
