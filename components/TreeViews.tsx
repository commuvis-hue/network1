import Link from 'next/link';
import type { TreeNode } from '@/lib/types';
import { num } from '@/lib/format';

type Vol = { left_pv: number; right_pv: number };

function NodeCard({
  n,
  rankName,
  tab,
  vol,
}: {
  n: TreeNode;
  rankName: Record<number, string>;
  tab: string;
  vol?: Vol;
}) {
  return (
    <Link
      href={`/dashboard/tree?t=${tab}&root=${n.id}`}
      className={`inline-block min-w-32 rounded-lg border px-3 py-2 text-left text-xs hover:border-brand-500 ${
        n.status === 'active' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400'
      }`}
    >
      <div className="font-semibold text-slate-800">{n.name || '(이름 없음)'}</div>
      <div className="text-slate-500">{rankName[n.rank_level] ?? '-'} · {n.referral_code}</div>
      {vol && <div className="mt-1 text-slate-500">L {num(vol.left_pv)} / R {num(vol.right_pv)}</div>}
    </Link>
  );
}

/** 추천·매트릭스용 들여쓰기 트리 */
export function ListTree({
  nodes,
  rootId,
  rankName,
  tab,
}: {
  nodes: TreeNode[];
  rootId: string;
  rankName: Record<number, string>;
  tab: string;
}) {
  const children = new Map<string, TreeNode[]>();
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const arr = children.get(n.parent_id) ?? [];
    arr.push(n);
    children.set(n.parent_id, arr);
  }
  const root = nodes.find((n) => n.id === rootId);
  if (!root) return <p className="text-slate-400">조직이 없습니다.</p>;

  const render = (n: TreeNode): React.ReactNode => {
    const kids = (children.get(n.id) ?? []).sort((a, b) => (a.matrix_position ?? 0) - (b.matrix_position ?? 0));
    return (
      <li key={n.id} className="mt-2">
        <NodeCard n={n} rankName={rankName} tab={tab} />
        {kids.length > 0 && (
          <ul className="ml-6 border-l border-slate-200 pl-4">{kids.map(render)}</ul>
        )}
      </li>
    );
  };
  return <ul>{render(root)}</ul>;
}

/** 바이너리 좌/우 트리 */
export function BinaryTree({
  nodes,
  rootId,
  rankName,
  volumes,
  tab,
}: {
  nodes: TreeNode[];
  rootId: string;
  rankName: Record<number, string>;
  volumes: Record<string, Vol>;
  tab: string;
}) {
  const byParent = new Map<string, { L?: TreeNode; R?: TreeNode }>();
  for (const n of nodes) {
    if (!n.parent_id || !n.binary_position) continue;
    const slot = byParent.get(n.parent_id) ?? {};
    slot[n.binary_position] = n;
    byParent.set(n.parent_id, slot);
  }
  const root = nodes.find((n) => n.id === rootId);
  if (!root) return <p className="text-slate-400">조직이 없습니다.</p>;

  const render = (n: TreeNode | undefined, level: number): React.ReactNode => {
    if (!n)
      return (
        <div className="inline-block min-w-32 rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-400">
          빈자리
        </div>
      );
    const slot = byParent.get(n.id);
    return (
      <div className="flex flex-col items-center gap-3">
        <NodeCard n={n} rankName={rankName} tab={tab} vol={volumes[n.id]} />
        {level < 3 && (
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[10px] text-slate-400">L</span>
              {render(slot?.L, level + 1)}
            </div>
            <div className="flex flex-col items-center">
              <span className="mb-1 text-[10px] text-slate-400">R</span>
              {render(slot?.R, level + 1)}
            </div>
          </div>
        )}
      </div>
    );
  };
  return <div className="flex justify-center py-4">{render(root, 0)}</div>;
}
