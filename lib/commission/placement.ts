/**
 * 조직 배치 알고리즘 (데이터 접근은 주입받는 함수로 처리 → 테스트 가능)
 */

export type Side = 'L' | 'R';

/** 바이너리: 스폰서 아래 지정한 쪽 다리의 가장 바깥 빈자리(스필오버) */
export async function findBinarySlot(
  startId: string,
  side: Side,
  getChild: (parentId: string, side: Side) => Promise<string | null>,
): Promise<{ parentId: string; position: Side }> {
  let current = startId;
  for (let i = 0; i < 100_000; i++) {
    const child = await getChild(current, side);
    if (!child) return { parentId: current, position: side };
    current = child;
  }
  throw new Error('바이너리 배치 실패: 트리가 너무 깊습니다');
}

/** 매트릭스: 스폰서 아래 너비 우선(BFS)으로 첫 빈자리 */
export async function findMatrixSlot(
  startId: string,
  width: number,
  getChildren: (parentIds: string[]) => Promise<Map<string, Array<{ id: string; position: number }>>>,
  maxLevels = 50,
): Promise<{ parentId: string; position: number }> {
  let level = [startId];
  for (let depth = 0; depth < maxLevels && level.length; depth++) {
    const map = await getChildren(level);
    for (const id of level) {
      const kids = map.get(id) ?? [];
      if (kids.length < width) {
        const used = new Set(kids.map((k) => k.position));
        let pos = 1;
        while (used.has(pos)) pos++;
        return { parentId: id, position: pos };
      }
    }
    level = level.flatMap((id) =>
      [...(map.get(id) ?? [])].sort((a, b) => a.position - b.position).map((k) => k.id),
    );
  }
  throw new Error('매트릭스 배치 실패: 빈자리를 찾지 못했습니다');
}
