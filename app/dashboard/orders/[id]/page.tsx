import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMember } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { explorerTx, TREASURY_ADDRESS } from '@/lib/chain';
import { date, money, num, ORDER_STATUS_LABEL } from '@/lib/format';
import type { Order } from '@/lib/types';
import { cancelOrder } from '../../actions';
import PayOrder from './PayOrder';

export default async function OrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMember();
  const db = createAdminClient();
  const { data } = await db.from('orders').select('*').eq('id', id).eq('member_id', me.id).maybeSingle();
  if (!data) notFound();
  const order = data as Order;
  const { data: items } = await db.from('order_items').select('*').eq('order_id', id);

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/orders" className="text-sm text-slate-500 underline">← 주문 내역</Link>
      <h1 className="h1">주문 상세</h1>

      <div className="card space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">상태</span>
          <span className="badge">{ORDER_STATUS_LABEL[order.status]}</span>
        </div>
        <div className="flex justify-between text-sm"><span className="text-slate-500">주문일</span><span>{date(order.created_at)}</span></div>
        <ul className="divide-y text-sm">
          {(items ?? []).map((i) => (
            <li key={i.id} className="flex justify-between py-2">
              <span>{i.name} × {i.qty}</span>
              <span>{money(Number(i.unit_price) * i.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-3 font-bold"><span>합계</span><span>{money(order.total_amount)}</span></div>
        <div className="text-sm text-slate-500">적립 PV {num(order.total_pv)}</div>
        {order.tx_hash && (
          <a href={explorerTx(order.tx_hash)} target="_blank" className="block truncate text-sm text-brand-600 underline">
            트랜잭션: {order.tx_hash}
          </a>
        )}
      </div>

      {order.status === 'pending' && order.payment_method === 'crypto' && (
        <PayOrder orderId={order.id} amount={Number(order.total_amount)} linkedWallet={me.wallet_address} />
      )}
      {order.status === 'pending' && order.payment_method === 'manual' && (
        <div className="card text-sm text-slate-600">
          회사 계좌로 입금하시면 관리자가 확인 후 결제 완료로 처리합니다. 입금자명에 주문번호 앞 8자리(
          <b>{order.id.slice(0, 8)}</b>)를 적어주세요.
        </div>
      )}
      {order.status === 'pending' && (
        <form action={cancelOrder.bind(null, order.id)}>
          <button className="btn-outline">주문 취소</button>
        </form>
      )}
      <p className="text-xs text-slate-400">결제 수령 주소: {TREASURY_ADDRESS}</p>
    </div>
  );
}
