import CopyButton from '@/components/CopyButton';
import { requireMember } from '@/lib/server/auth';
import { getRanks } from '@/lib/server/settings';
import { createAdminClient } from '@/lib/supabase/server';
import { COMMISSION_LABEL, date, money, num } from '@/lib/format';

export default async function DashboardPage() {
  const me = await requireMember();
  const db = createAdminClient();
  const [ranks, { data: bal }, { data: vol }, { count: directs }, { data: recent }, { data: byType }] =
    await Promise.all([
      getRanks(),
      db.from('member_balances').select('*').eq('member_id', me.id).single(),
      db.from('binary_volumes').select('*').eq('member_id', me.id).maybeSingle(),
      db.from('profiles').select('id', { count: 'exact', head: true }).eq('sponsor_id', me.id),
      db.from('commissions').select('*').eq('member_id', me.id).order('created_at', { ascending: false }).limit(5),
      db.from('commissions').select('type, amount').eq('member_id', me.id).eq('status', 'confirmed'),
    ]);

  const rank = ranks.find((r) => r.level === me.rank_level);
  const nextRank = ranks.find((r) => r.level === me.rank_level + 1);
  const balance = Number(bal?.earned ?? 0) - Number(bal?.withdrawn ?? 0);
  const totals: Record<string, number> = {};
  for (const c of byType ?? []) totals[c.type] = (totals[c.type] ?? 0) + Number(c.amount);
  const link = `${process.env.NEXT_PUBLIC_SITE_URL}/signup?ref=${me.referral_code}`;

  return (
    <div className="space-y-6">
      <h1 className="h1">안녕하세요, {me.name || '회원'}님</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="출금 가능 잔액" value={money(balance)} />
        <Stat label="누적 수당" value={money(bal?.earned)} />
        <Stat label="직급" value={rank?.name ?? '-'} sub={nextRank ? `다음: ${nextRank.name}` : '최고 직급'} />
        <Stat label="직추천 회원" value={`${num(directs)}명`} />
      </div>

      <div className="card">
        <div className="mb-2 font-semibold">내 추천 링크</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={link} className="input font-mono" />
          <CopyButton text={link} />
        </div>
        <p className="mt-2 text-xs text-slate-500">추천 코드: {me.referral_code}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-3 font-semibold">바이너리 실적 (이월 포함)</div>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">왼쪽 PV</div>
              <div className="text-xl font-bold">{num(vol?.left_pv)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="text-xs text-slate-500">오른쪽 PV</div>
              <div className="text-xl font-bold">{num(vol?.right_pv)}</div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="mb-3 font-semibold">수당 유형별 누적</div>
          <ul className="space-y-2 text-sm">
            {Object.keys(COMMISSION_LABEL).map((t) => (
              <li key={t} className="flex justify-between">
                <span className="text-slate-600">{COMMISSION_LABEL[t]}</span>
                <span className="font-medium">{money(totals[t] ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-3 font-semibold">최근 수당</div>
        <table className="table">
          <thead><tr><th>일시</th><th>유형</th><th>금액</th><th>상태</th></tr></thead>
          <tbody>
            {(recent ?? []).map((c) => (
              <tr key={c.id}>
                <td>{date(c.created_at)}</td>
                <td>{COMMISSION_LABEL[c.type]}</td>
                <td>{money(c.amount)}</td>
                <td>{c.status === 'reversed' ? <span className="badge bg-red-50 text-red-700">회수</span> : '확정'}</td>
              </tr>
            ))}
            {!recent?.length && <tr><td colSpan={4} className="text-slate-400">아직 수당이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}
