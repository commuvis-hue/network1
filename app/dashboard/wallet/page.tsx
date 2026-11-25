import { requireMember } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { explorerTx } from '@/lib/chain';
import { date, money } from '@/lib/format';
import LinkWallet from './LinkWallet';
import WithdrawForm from './WithdrawForm';

const PAYOUT_LABEL: Record<string, string> = { requested: '처리 대기', paid: '지급 완료', rejected: '반려' };

export default async function WalletPage() {
  const me = await requireMember();
  const db = createAdminClient();
  const [{ data: bal }, { data: payouts }] = await Promise.all([
    db.from('member_balances').select('*').eq('member_id', me.id).single(),
    db.from('payouts').select('*').eq('member_id', me.id).order('created_at', { ascending: false }).limit(50),
  ]);
  const available = Number(bal?.earned ?? 0) - Number(bal?.withdrawn ?? 0);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="h1">지갑 · 출금</h1>

      <div className="card space-y-3">
        <div className="font-semibold">지갑 연결</div>
        <p className="text-sm text-slate-500">
          연결된 지갑: <span className="font-mono">{me.wallet_address ?? '없음'}</span>
        </p>
        <LinkWallet linked={me.wallet_address} />
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between">
          <span className="font-semibold">출금</span>
          <span className="text-sm">출금 가능: <b>{money(available)}</b></span>
        </div>
        <WithdrawForm max={available} disabled={!me.wallet_address || available <= 0} />
        <p className="text-xs text-slate-500">출금은 연결된 지갑으로 관리자 확인 후 지급됩니다.</p>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 font-semibold">출금 내역</div>
        <table className="table">
          <thead><tr><th>신청일</th><th>금액</th><th>상태</th><th>트랜잭션</th></tr></thead>
          <tbody>
            {(payouts ?? []).map((p) => (
              <tr key={p.id}>
                <td>{date(p.created_at)}</td>
                <td>{money(p.amount)}</td>
                <td>{PAYOUT_LABEL[p.status]}</td>
                <td>{p.tx_hash ? <a className="text-brand-600 underline" href={explorerTx(p.tx_hash)} target="_blank">보기</a> : '-'}</td>
              </tr>
            ))}
            {!payouts?.length && <tr><td colSpan={4} className="text-slate-400">내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
