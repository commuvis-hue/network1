import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOrderCap,
  binaryMatch,
  computeMatrix,
  computeOrderCommissions,
  computeRankDifferential,
  computeUnilevel,
  DEFAULT_PLAN,
  evaluateRanks,
  normalizePlan,
  scaleToPool,
  type Rank,
  type UplineMember,
} from '../lib/commission/engine';
import { findBinarySlot, findMatrixSlot, type Side } from '../lib/commission/placement';

const ranks: Rank[] = [
  { level: 0, name: '회원', minPersonalPv: 0, minGroupPv: 0, minDirectCount: 0, bonusRate: 0 },
  { level: 1, name: '브론즈', minPersonalPv: 100, minGroupPv: 1000, minDirectCount: 2, bonusRate: 2 },
  { level: 2, name: '실버', minPersonalPv: 200, minGroupPv: 5000, minDirectCount: 3, bonusRate: 4 },
  { level: 3, name: '골드', minPersonalPv: 300, minGroupPv: 20000, minDirectCount: 4, bonusRate: 6 },
];

const up = (spec: Array<[string, boolean, number?]>): UplineMember[] =>
  spec.map(([id, active, rank = 0], i) => ({ memberId: id, depth: i + 1, active, rankLevel: rank }));

test('유니레벨: 대수별 요율', () => {
  const r = computeUnilevel(up([['a', true], ['b', true], ['c', true]]), 100, {
    enabled: true, rates: [10, 5], compression: true, activeMinPv: 0,
  });
  assert.deepEqual(r.map((x) => [x.memberId, x.level, x.amount]), [['a', 1, 10], ['b', 2, 5]]);
});

test('유니레벨: 압축 시 비활성 회원 건너뛰고 롤업', () => {
  const r = computeUnilevel(up([['a', false], ['b', true], ['c', true]]), 100, {
    enabled: true, rates: [10, 5], compression: true, activeMinPv: 0,
  });
  assert.deepEqual(r.map((x) => [x.memberId, x.level]), [['b', 1], ['c', 2]]);
});

test('유니레벨: 압축 미사용 시 비활성 몫 소멸', () => {
  const r = computeUnilevel(up([['a', false], ['b', true], ['c', true]]), 100, {
    enabled: true, rates: [10, 5], compression: false, activeMinPv: 0,
  });
  assert.deepEqual(r.map((x) => [x.memberId, x.level]), [['b', 2]]);
});

test('직급 차등: 하위 지급분을 뺀 차액만 지급', () => {
  const r = computeRankDifferential(up([['a', true, 1], ['b', true, 1], ['c', true, 3], ['d', true, 2]]), 1000, ranks);
  assert.deepEqual(r.map((x) => [x.memberId, x.rate, x.amount]), [['a', 2, 20], ['c', 4, 40]]);
});

test('직급 차등: 비활성 고직급은 건너뜀', () => {
  const r = computeRankDifferential(up([['a', false, 3], ['b', true, 2]]), 1000, ranks);
  assert.deepEqual(r.map((x) => [x.memberId, x.rate]), [['b', 4]]);
});

test('매트릭스: 깊이 제한', () => {
  const r = computeMatrix(up([['a', true], ['b', true], ['c', true]]), 100, { enabled: true, width: 3, rates: [3, 2] });
  assert.deepEqual(r.map((x) => [x.memberId, x.amount]), [['a', 3], ['b', 2]]);
});

test('주문 상한 35%: 초과 시 비례 축소', () => {
  const capped = applyOrderCap(
    [
      { memberId: 'a', type: 'unilevel', level: 1, basePv: 100, rate: 30, amount: 30 },
      { memberId: 'b', type: 'unilevel', level: 2, basePv: 100, rate: 20, amount: 20 },
    ],
    100,
    35,
  );
  const total = capped.reduce((s, x) => s + x.amount, 0);
  assert.ok(total <= 35);
  assert.equal(capped[0].amount, 21);
  assert.equal(capped[1].amount, 14);
});

test('상한은 설정값이 높아도 법정 35% 고정', () => {
  assert.equal(normalizePlan({ ...DEFAULT_PLAN, payoutCapPercent: 80 }).payoutCapPercent, 35);
  const capped = applyOrderCap(
    [{ memberId: 'a', type: 'unilevel', level: 1, basePv: 100, rate: 50, amount: 50 }], 100, 90,
  );
  assert.equal(capped[0].amount, 35);
});

test('주문 전체 수당 합계 ≤ 매출 × 35%', () => {
  const plan = normalizePlan({
    ...DEFAULT_PLAN,
    unilevel: { enabled: true, rates: [15, 10, 8, 5], compression: true, activeMinPv: 0 },
    matrix: { enabled: true, width: 3, rates: [5, 5, 5] },
  });
  const res = computeOrderCommissions({
    sponsorUpline: up([['a', true, 3], ['b', true, 1], ['c', true, 2], ['d', true]]),
    matrixUpline: up([['x', true], ['y', true], ['z', true]]),
    pv: 100, saleAmount: 100, plan, ranks,
  });
  assert.ok(res.reduce((s, x) => s + x.amount, 0) <= 35);
});

test('바이너리 매칭과 이월', () => {
  assert.deepEqual(binaryMatch(500, 300, { enabled: true, rate: 10, capPerPeriod: 0 }), {
    matched: 300, bonus: 30, left: 200, right: 0,
  });
  assert.equal(binaryMatch(50000, 50000, { enabled: true, rate: 10, capPerPeriod: 1000 }).bonus, 1000);
  assert.equal(binaryMatch(-100, 300, { enabled: true, rate: 10, capPerPeriod: 0 }).matched, 0);
});

test('풀 비례 축소', () => {
  const r = scaleToPool([{ amount: 60 }, { amount: 40 }], 50);
  assert.deepEqual(r.map((x) => x.amount), [30, 20]);
  assert.deepEqual(scaleToPool([{ amount: 10 }], 0), []);
});

test('직급 평가: 그룹 PV·직추천 조건', () => {
  const members = [
    { id: 'root', sponsorId: null, personalPv: 150, rankLevel: 0, active: true },
    { id: 'a', sponsorId: 'root', personalPv: 500, rankLevel: 0, active: true },
    { id: 'b', sponsorId: 'root', personalPv: 300, rankLevel: 0, active: true },
    { id: 'c', sponsorId: 'a', personalPv: 100, rankLevel: 0, active: true },
  ];
  const { changes, groupPv } = evaluateRanks(members, ranks);
  assert.equal(groupPv.get('root'), 1050);
  assert.deepEqual(changes.map((c) => [c.id, c.to]), [['root', 1]]);
});

test('바이너리 배치: 지정 다리 바깥쪽으로 스필오버', async () => {
  const tree = new Map<string, string>([['root:L', 'a'], ['a:L', 'b'], ['root:R', 'c']]);
  const get = async (p: string, s: Side) => tree.get(`${p}:${s}`) ?? null;
  assert.deepEqual(await findBinarySlot('root', 'L', get), { parentId: 'b', position: 'L' });
  assert.deepEqual(await findBinarySlot('root', 'R', get), { parentId: 'c', position: 'R' });
});

test('매트릭스 배치: BFS 첫 빈자리', async () => {
  const kids: Record<string, Array<{ id: string; position: number }>> = {
    root: [{ id: 'a', position: 1 }, { id: 'b', position: 2 }],
  };
  const get = async (ids: string[]) => new Map(ids.map((id) => [id, kids[id] ?? []]));
  assert.deepEqual(await findMatrixSlot('root', 2, get), { parentId: 'a', position: 1 });
  assert.deepEqual(await findMatrixSlot('root', 3, get), { parentId: 'root', position: 3 });
});
