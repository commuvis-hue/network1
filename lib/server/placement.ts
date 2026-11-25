import 'server-only';
import { findBinarySlot, findMatrixSlot, type Side } from '@/lib/commission/placement';
import { createAdminClient } from '@/lib/supabase/server';
import { getPlan } from './settings';

/**
 * 가입한 회원을 추천/바이너리/매트릭스 트리에 배치.
 * - 추천코드가 없거나 잘못되면 최상위 관리자(루트) 아래로 배치
 * - 바이너리는 가입 시 선택한 쪽(L/R) 다리 바깥쪽 빈자리
 * - 매트릭스는 스폰서 아래 BFS 첫 빈자리
 */
export async function placeMember(
  userId: string,
  override: { ref?: string; side?: string } = {},
): Promise<void> {
  const db = createAdminClient();
  const { data: me } = await db.from('profiles').select('id, placed').eq('id', userId).single();
  if (!me || me.placed) return;

  const { data: userRes } = await db.auth.admin.getUserById(userId);
  // 이메일 가입은 user_metadata, 구글 가입은 쿠키에서 넘어온 override 사용
  const meta = { ...((userRes?.user?.user_metadata ?? {}) as { ref?: string; side?: string }) };
  if (override.ref) meta.ref = override.ref;
  if (override.side) meta.side = override.side;
  const side: Side = meta.side === 'R' ? 'R' : 'L';

  let sponsorId: string | null = null;
  if (meta.ref) {
    const { data: s } = await db
      .from('profiles')
      .select('id, placed')
      .eq('referral_code', String(meta.ref).trim().toUpperCase())
      .maybeSingle();
    if (s && s.id !== userId && s.placed) sponsorId = s.id;
  }
  if (!sponsorId) {
    const { data: root } = await db
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('placed', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    if (!root) throw new Error('루트 회원이 없습니다');
    sponsorId = root.id;
  }

  const plan = await getPlan();

  for (let attempt = 0; attempt < 5; attempt++) {
    const bin = await findBinarySlot(sponsorId!, side, async (parentId, s) => {
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('binary_parent_id', parentId)
        .eq('binary_position', s)
        .maybeSingle();
      return data?.id ?? null;
    });

    const mat = await findMatrixSlot(sponsorId!, plan.matrix.width, async (ids) => {
      const rows: Array<{ id: string; matrix_parent_id: string; matrix_position: number | null }> = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db
          .from('profiles')
          .select('id, matrix_parent_id, matrix_position')
          .in('matrix_parent_id', ids.slice(i, i + 200));
        rows.push(...(data ?? []));
      }
      const map = new Map<string, Array<{ id: string; position: number }>>();
      for (const row of rows) {
        const arr = map.get(row.matrix_parent_id) ?? [];
        arr.push({ id: row.id, position: row.matrix_position ?? 0 });
        map.set(row.matrix_parent_id, arr);
      }
      return map;
    });

    const { error } = await db
      .from('profiles')
      .update({
        sponsor_id: sponsorId,
        binary_parent_id: bin.parentId,
        binary_position: bin.position,
        matrix_parent_id: mat.parentId,
        matrix_position: mat.position,
        placed: true,
      })
      .eq('id', userId)
      .eq('placed', false);

    if (!error) return;
    if (error.code !== '23505') throw error; // 동시 가입으로 자리 충돌 시 재시도
  }
  throw new Error('배치 재시도 횟수 초과');
}
