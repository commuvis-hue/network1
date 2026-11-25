import ConnectWallet from '@/components/ConnectWallet';
import { createAdminClient } from '@/lib/supabase/server';
import { explorerTx } from '@/lib/chain';
import { date, money } from '@/lib/format';
import PayoutSender from './PayoutSender';

export default async function AdminPayouts() {
  const db = createAdminClient();
  const [{ data: pending }, { data: done }] = await Promise.all([
    db.from('payouts').select('*, member:profiles!payouts_member_id_fkey(name, email)').eq('status', 'requested').order('created_at'),
    db.from('payouts').select('*, member:profiles!payouts_member_id_fkey(name)').neq('status', 'requested').order('processed_at', { ascending: false }).limit(50),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="h1">출금 관리</h1>
      <div className="card space-y-2">
        <div className="font-semibold">지급용 관리자 지갑</div>
        <ConnectWallet />
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 font-semibold">처리 대기</div>
        <table className="table">
          <thead><tr><th>신청일</th><th>회원</th><th>금액</th><th>받는 지갑</th><th>처리</th></tr></thead>
          <tbody>
            {(pending ?? []).map((p) => (
              <tr key={p.id}>
                <td>{date(p.created_at)}</td>
                <td>{p.member?.name} <span className="text-xs text-slate-400">{p.member?.email}</span></td>
                <td>{money(p.amount)}</td>
                <td className="font-mono text-xs">{p.wallet_address}</td>
                <td><PayoutSender id={p.id} to={p.wallet_address} amount={Number(p.amount)} /></td>
              </tr>
            ))}
            {!pending?.length && <tr><td colSpan={5} className="text-slate-400">대기 중인 출금이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 font-semibold">처리 완료</div>
        <table className="table">
          <thead><tr><th>처리일</th><th>회원</th><th>금액</th><th>상태</th><th>트랜잭션</th></tr></thead>
          <tbody>
            {(done ?? []).map((p) => (
              <tr key={p.id}>
                <td>{date(p.processed_at)}</td>
                <td>{p.member?.name}</td>
                <td>{money(p.amount)}</td>
                <td>{p.status === 'paid' ? '지급' : '반려'}</td>
                <td>{p.tx_hash ? <a href={explorerTx(p.tx_hash)} target="_blank" className="text-brand-600 underline">보기</a> : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
