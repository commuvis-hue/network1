import { createAdminClient } from '@/lib/supabase/server';
import { date, money, num } from '@/lib/format';
import { settleNow } from './actions';

export default async function AdminHome() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [{ count: members }, { count: pendingOrders }, { count: pendingPayouts }, { data: sales }, { data: comms }, { data: settlements }] =
    await Promise.all([
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
      db.from('orders').select('total_amount').eq('status', 'paid').gt('paid_at', since),
      db.from('commissions').select('amount').eq('status', 'confirmed').gt('created_at', since),
      db.from('settlements').select('*').order('created_at', { ascending: false }).limit(10),
    ]);
  const sales30 = (sales ?? []).reduce((s, o) => s + Number(o.total_amount), 0);
  const comm30 = (comms ?? []).reduce((s, c) => s + Number(c.amount), 0);
  const ratio = sales30 > 0 ? (comm30 / sales30) * 100 : 0;

  return (
    <div className="space-y-6">
      <h1 className="h1">개요</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="전체 회원" value={`${num(members)}명`} />
        <Stat label="최근 30일 매출" value={money(sales30)} />
        <Stat label="최근 30일 수당" value={money(comm30)} />
        <Stat label="수당 비율" value={`${ratio.toFixed(1)}%`} warn={ratio > 35} />
        <Stat label="대기 (주문 / 출금)" value={`${num(pendingOrders)} / ${num(pendingPayouts)}`} />
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">정산 실행</div>
            <p className="text-sm text-slate-500">
              바이너리 매칭 수당 지급과 직급 평가를 실행합니다. Vercel Cron이 매일 자정(KST)에 자동 실행합니다.
            </p>
          </div>
          <form action={settleNow}><button className="btn">지금 정산</button></form>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead><tr><th>실행 시각</th><th>기간 매출</th><th>주문 수당</th><th>바이너리 한도</th><th>바이너리 지급</th><th>승급</th></tr></thead>
            <tbody>
              {(settlements ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{date(s.created_at)}</td>
                  <td>{money(s.sales_amount)}</td>
                  <td>{money(s.order_payouts)}</td>
                  <td>{money(s.binary_pool)}</td>
                  <td>{money(s.binary_paid)}</td>
                  <td>{s.rank_changes}명</td>
                </tr>
              ))}
              {!settlements?.length && <tr><td colSpan={6} className="text-slate-400">정산 이력이 없습니다.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`card ${warn ? 'border-red-300 bg-red-50' : ''}`}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
