import { requireMember } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';
import { COMMISSION_LABEL, date, money, num } from '@/lib/format';
import type { Commission } from '@/lib/types';

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page ?? 1));
  const size = 50;
  const me = await requireMember();
  const db = createAdminClient();
  const { data, count } = await db
    .from('commissions')
    .select('*, source:profiles!commissions_source_member_id_fkey(name)', { count: 'exact' })
    .eq('member_id', me.id)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);
  const rows = (data ?? []) as Array<Commission & { source: { name: string } | null }>;
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));

  return (
    <div className="space-y-6">
      <h1 className="h1">수당 내역</h1>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>일시</th><th>유형</th><th>대수/직급</th><th>발생 회원</th><th>기준 PV</th><th>요율</th><th>금액</th><th>상태</th></tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>{date(c.created_at)}</td>
                <td>{COMMISSION_LABEL[c.type]}</td>
                <td>{c.type === 'binary' ? '-' : c.level}</td>
                <td>{c.source?.name ?? (c.type === 'binary' ? '정산' : '-')}</td>
                <td>{num(c.base_pv)}</td>
                <td>{num(c.rate)}%</td>
                <td className="font-medium">{money(c.amount)}</td>
                <td>{c.status === 'reversed' ? <span className="badge bg-red-50 text-red-700">환불 회수</span> : '확정'}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="text-slate-400">수당 내역이 없습니다.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex gap-2 text-sm">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 20).map((p) => (
            <a key={p} href={`?page=${p}`} className={p === page ? 'btn' : 'btn-outline'}>{p}</a>
          ))}
        </div>
      )}
    </div>
  );
}
