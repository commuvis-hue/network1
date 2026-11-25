import Link from 'next/link';
import { requireMember } from '@/lib/server/auth';
import { getPlan, getRanks } from '@/lib/server/settings';
import { createAdminClient } from '@/lib/supabase/server';
import type { TreeNode } from '@/lib/types';
import { BinaryTree, ListTree } from '@/components/TreeViews';

const TABS = [
  { key: 'sponsor', label: '추천 조직 (유니레벨)' },
  { key: 'binary', label: '바이너리' },
  { key: 'matrix', label: '매트릭스' },
] as const;

export default async function TreePage({ searchParams }: { searchParams: Promise<{ t?: string; root?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.t) ? (sp.t as (typeof TABS)[number]['key']) : 'sponsor';
  const me = await requireMember();
  const db = createAdminClient();
  const [ranks, plan] = await Promise.all([getRanks(), getPlan()]);

  // 하위 조직의 특정 회원을 기준으로 펼쳐보기 (본인 하위만 허용)
  let rootId = me.id;
  if (sp.root && sp.root !== me.id) {
    const { data: mine } = await db.rpc('downline', { p_root: me.id, p_tree: tab, p_max: 1000 });
    if ((mine as TreeNode[] | null)?.some((n) => n.id === sp.root)) rootId = sp.root;
  }

  const depth = tab === 'binary' ? 4 : tab === 'matrix' ? Math.max(1, Math.min(plan.matrix.rates.length, 5)) : 6;
  const { data } = await db.rpc('downline', { p_root: rootId, p_tree: tab, p_max: depth });
  const nodes = (data ?? []) as TreeNode[];
  const rankName = Object.fromEntries(ranks.map((r) => [r.level, r.name]));

  const { data: vols } =
    tab === 'binary'
      ? await db.from('binary_volumes').select('member_id, left_pv, right_pv').in('member_id', nodes.map((n) => n.id))
      : { data: [] };
  const volMap = Object.fromEntries((vols ?? []).map((v) => [v.member_id, v]));

  return (
    <div className="space-y-6">
      <h1 className="h1">조직도</h1>
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/dashboard/tree?t=${t.key}`} className={t.key === tab ? 'btn' : 'btn-outline'}>
            {t.label}
          </Link>
        ))}
        {rootId !== me.id && (
          <Link href={`/dashboard/tree?t=${tab}`} className="btn-outline">내 위치로</Link>
        )}
      </div>
      <p className="text-sm text-slate-500">
        총 {Math.max(0, nodes.length - 1)}명 표시 (깊이 {depth}단계까지). 회원을 누르면 그 회원 기준으로 펼쳐집니다.
      </p>
      <div className="card overflow-x-auto">
        {tab === 'binary' ? (
          <BinaryTree nodes={nodes} rootId={rootId} rankName={rankName} volumes={volMap} tab={tab} />
        ) : (
          <ListTree nodes={nodes} rootId={rootId} rankName={rankName} tab={tab} />
        )}
      </div>
    </div>
  );
}
