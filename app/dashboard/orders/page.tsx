import Link from 'next/link';
import { requireMember } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { date, money, num, ORDER_STATUS_LABEL } from '@/lib/format';
import type { Order } from '@/lib/types';

export default async function OrdersPage() {
  const me = await requireMember();
  const db = createAdminClient();
  const { data } = await db
    .from('orders')
    .select('*')
    .eq('member_id', me.id)
    .order('created_at', { ascending: false })
    .limit(100);
  const orders = (data ?? []) as Order[];
  return (
    <div className="space-y-6">
      <h1 className="h1">주문 내역</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>주문일</th><th>금액</th><th>PV</th><th>결제</th><th>상태</th><th /></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{date(o.created_at)}</td>
                <td>{money(o.total_amount)}</td>
                <td>{num(o.total_pv)}</td>
                <td>{o.payment_method === 'crypto' ? '지갑' : '무통장'}</td>
                <td><span className="badge">{ORDER_STATUS_LABEL[o.status]}</span></td>
                <td><Link href={`/dashboard/orders/${o.id}`} className="text-brand-600 underline">상세</Link></td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={6} className="text-slate-400">주문이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
