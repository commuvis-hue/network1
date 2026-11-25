import { createAdminClient } from '@/lib/supabase/server';
import { getRanks } from '@/lib/server/settings';
import { date, shortAddr } from '@/lib/format';
import type { Profile } from '@/lib/types';
import { setMemberRole, setMemberStatus } from '../actions';

export default async function AdminMembers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const size = 50;
  const db = createAdminClient();
  let query = db
    .from('profiles')
    .select('*, sponsor:profiles!profiles_sponsor_id_fkey(name, referral_code)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);
  if (sp.q) {
    const q = sp.q.replace(/[%,()]/g, '');
    query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,referral_code.ilike.%${q}%`);
  }
  const [{ data, count }, ranks] = await Promise.all([query, getRanks()]);
  const rankName = Object.fromEntries(ranks.map((r) => [r.level, r.name]));
  const rows = (data ?? []) as Array<Profile & { sponsor: { name: string; referral_code: string } | null }>;
  const pages = Math.max(1, Math.ceil((count ?? 0) / size));

  return (
    <div className="space-y-6">
      <h1 className="h1">회원 관리 <span className="text-base font-normal text-slate-500">({count ?? 0}명)</span></h1>
      <form className="flex max-w-md gap-2">
        <input name="q" defaultValue={sp.q} placeholder="이름·이메일·추천코드" className="input" />
        <button className="btn-outline">검색</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>가입일</th><th>이름</th><th>이메일</th><th>코드</th><th>추천인</th><th>직급</th><th>지갑</th><th>상태</th><th>관리</th></tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{date(m.created_at)}</td>
                <td>{m.name} {m.role === 'admin' && <span className="badge bg-brand-50 text-brand-700">관리자</span>}</td>
                <td>{m.email}</td>
                <td className="font-mono text-xs">{m.referral_code}</td>
                <td>{m.sponsor?.name ?? '-'}</td>
                <td>{rankName[m.rank_level]}</td>
                <td className="font-mono text-xs">{shortAddr(m.wallet_address)}</td>
                <td>{m.status === 'active' ? '정상' : <span className="badge bg-red-50 text-red-700">정지</span>}</td>
                <td className="space-x-2">
                  <form action={setMemberStatus.bind(null, m.id, m.status === 'active' ? 'suspended' : 'active')} className="inline">
                    <button className="text-xs underline">{m.status === 'active' ? '정지' : '해제'}</button>
                  </form>
                  <form action={setMemberRole.bind(null, m.id, m.role === 'admin' ? 'member' : 'admin')} className="inline">
                    <button className="text-xs underline">{m.role === 'admin' ? '관리자 해제' : '관리자 지정'}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {Array.from({ length: Math.min(pages, 30) }, (_, i) => i + 1).map((p) => (
            <a key={p} href={`?page=${p}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ''}`} className={p === page ? 'btn' : 'btn-outline'}>{p}</a>
          ))}
        </div>
      )}
    </div>
  );
}
