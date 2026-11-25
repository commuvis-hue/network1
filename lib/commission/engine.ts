/**
 * 수당 계산 엔진 (순수 함수, DB 의존 없음)
 *
 * - 모든 수당은 "실제 상품 판매"의 PV(Point Value)를 기준으로 계산합니다.
 * - 금액은 센트(소수 2자리) 단위로 내림 처리해 초과 지급을 막습니다.
 * - 주문 1건에서 발생하는 수당 합계와 정산 기간의 수당 합계는
 *   매출 대비 payoutCapPercent(기본 35%)를 넘지 않도록 비례 축소합니다.
 */

export type CommissionType = 'unilevel' | 'binary' | 'matrix' | 'rank';

export interface Payout {
  memberId: string;
  type: CommissionType;
  level: number;
  basePv: number;
  rate: number; // %
  amount: number;
}

/** 추천(스폰서) 라인 또는 매트릭스 라인의 상위 회원. depth 1 = 바로 위 */
export interface UplineMember {
  memberId: string;
  depth: number;
  active: boolean;
  rankLevel: number;
}

export interface Rank {
  level: number;
  name: string;
  minPersonalPv: number;
  minGroupPv: number;
  minDirectCount: number;
  bonusRate: number; // 직급 차등 수당 %
}

export interface PlanConfig {
  unilevel: {
    enabled: boolean;
    rates: number[]; // 1대, 2대 ... (%)
    compression: boolean; // 비활성 회원을 건너뛰고 다음 활성 회원에게 롤업
    activeMinPv: number; // 최근 30일 개인 PV 기준
  };
  binary: {
    enabled: boolean;
    rate: number; // 소실적(매칭 PV) 대비 %
    capPerPeriod: number; // 회원 1인당 정산 1회 최대 금액 (0 = 제한 없음)
  };
  matrix: {
    enabled: boolean;
    width: number;
    rates: number[]; // 깊이별 % (배열 길이 = 깊이)
  };
  rank: {
    enabled: boolean;
  };
  payoutCapPercent: number; // 후원수당 총액 상한 (방문판매법 35%)
}

export const LEGAL_CAP_PERCENT = 35;

export const DEFAULT_PLAN: PlanConfig = {
  unilevel: { enabled: true, rates: [8, 4, 2, 1, 1], compression: true, activeMinPv: 0 },
  binary: { enabled: true, rate: 6, capPerPeriod: 1000 },
  matrix: { enabled: false, width: 3, rates: [1, 1, 1, 1, 1, 1, 1] },
  rank: { enabled: true },
  payoutCapPercent: 35,
};

export function floor2(n: number): number {
  return Math.floor((n + 1e-9) * 100) / 100;
}

/** 설정값을 안전한 범위로 정리 (상한은 법정 35%를 넘을 수 없음) */
export function normalizePlan(input: Partial<PlanConfig> | null | undefined): PlanConfig {
  const p = { ...DEFAULT_PLAN, ...(input ?? {}) } as PlanConfig;
  const nums = (a: unknown) =>
    Array.isArray(a) ? a.map(Number).filter((x) => Number.isFinite(x) && x >= 0) : [];
  return {
    unilevel: {
      enabled: Boolean(p.unilevel?.enabled),
      rates: nums(p.unilevel?.rates).slice(0, 20),
      compression: Boolean(p.unilevel?.compression),
      activeMinPv: Math.max(0, Number(p.unilevel?.activeMinPv) || 0),
    },
    binary: {
      enabled: Boolean(p.binary?.enabled),
      rate: Math.max(0, Number(p.binary?.rate) || 0),
      capPerPeriod: Math.max(0, Number(p.binary?.capPerPeriod) || 0),
    },
    matrix: {
      enabled: Boolean(p.matrix?.enabled),
      width: Math.min(10, Math.max(2, Math.floor(Number(p.matrix?.width) || 3))),
      rates: nums(p.matrix?.rates).slice(0, 15),
    },
    rank: { enabled: Boolean(p.rank?.enabled) },
    payoutCapPercent: Math.min(
      LEGAL_CAP_PERCENT,
      Math.max(0, Number(p.payoutCapPercent) || LEGAL_CAP_PERCENT),
    ),
  };
}

/** 유니레벨: 추천 라인을 따라 대수별 %. compression=true면 비활성 회원은 대수를 소비하지 않음 */
export function computeUnilevel(
  upline: UplineMember[],
  pv: number,
  cfg: PlanConfig['unilevel'],
): Payout[] {
  if (!cfg.enabled || pv <= 0) return [];
  const out: Payout[] = [];
  let level = 1;
  for (const m of [...upline].sort((a, b) => a.depth - b.depth)) {
    if (level > cfg.rates.length) break;
    if (!m.active) {
      if (!cfg.compression) level++; // 압축 미사용: 해당 대수 수당 소멸
      continue;
    }
    const rate = cfg.rates[level - 1];
    const amount = floor2((pv * rate) / 100);
    if (amount > 0) out.push({ memberId: m.memberId, type: 'unilevel', level, basePv: pv, rate, amount });
    level++;
  }
  return out;
}

/**
 * 직급 차등(롤업) 수당: 위로 올라가며 "내 직급 요율 - 하위에서 이미 지급된 요율" 만큼 지급.
 * 비활성 회원은 건너뛰고 다음 적격 상위자에게 롤업.
 */
export function computeRankDifferential(upline: UplineMember[], pv: number, ranks: Rank[]): Payout[] {
  if (pv <= 0) return [];
  const rateOf = new Map(ranks.map((r) => [r.level, r.bonusRate]));
  const maxRate = Math.max(0, ...ranks.map((r) => r.bonusRate));
  const out: Payout[] = [];
  let paid = 0;
  for (const m of [...upline].sort((a, b) => a.depth - b.depth)) {
    if (paid >= maxRate) break;
    if (!m.active) continue;
    const rate = rateOf.get(m.rankLevel) ?? 0;
    if (rate > paid) {
      const diff = rate - paid;
      const amount = floor2((pv * diff) / 100);
      if (amount > 0)
        out.push({ memberId: m.memberId, type: 'rank', level: m.rankLevel, basePv: pv, rate: diff, amount });
      paid = rate;
    }
  }
  return out;
}

/** 매트릭스: 매트릭스 배치 라인의 깊이별 %. 비활성 회원 몫은 소멸 */
export function computeMatrix(upline: UplineMember[], pv: number, cfg: PlanConfig['matrix']): Payout[] {
  if (!cfg.enabled || pv <= 0) return [];
  const out: Payout[] = [];
  for (const m of upline) {
    if (m.depth > cfg.rates.length) continue;
    if (!m.active) continue;
    const rate = cfg.rates[m.depth - 1];
    const amount = floor2((pv * rate) / 100);
    if (amount > 0) out.push({ memberId: m.memberId, type: 'matrix', level: m.depth, basePv: pv, rate, amount });
  }
  return out;
}

/** 지급 합계가 한도를 넘으면 비례 축소 */
export function scaleToPool<T extends { amount: number }>(items: T[], pool: number): T[] {
  const total = items.reduce((s, x) => s + x.amount, 0);
  if (total <= pool) return items;
  if (pool <= 0) return items.map((x) => ({ ...x, amount: 0 })).filter((x) => x.amount > 0);
  const factor = pool / total;
  return items
    .map((x) => ({ ...x, amount: floor2(x.amount * factor) }))
    .filter((x) => x.amount > 0);
}

/** 주문 1건 수당을 매출액 × 상한% 안으로 제한 */
export function applyOrderCap(payouts: Payout[], saleAmount: number, capPercent: number): Payout[] {
  return scaleToPool(payouts, floor2((saleAmount * Math.min(capPercent, LEGAL_CAP_PERCENT)) / 100));
}

/** 주문 1건에 대한 전체 즉시 수당 (바이너리는 정산 시점에 별도 계산) */
export function computeOrderCommissions(args: {
  sponsorUpline: UplineMember[];
  matrixUpline: UplineMember[];
  pv: number;
  saleAmount: number;
  plan: PlanConfig;
  ranks: Rank[];
}): Payout[] {
  const { plan } = args;
  const all = [
    ...computeUnilevel(args.sponsorUpline, args.pv, plan.unilevel),
    ...(plan.rank.enabled ? computeRankDifferential(args.sponsorUpline, args.pv, args.ranks) : []),
    ...computeMatrix(args.matrixUpline, args.pv, plan.matrix),
  ];
  return applyOrderCap(all, args.saleAmount, plan.payoutCapPercent);
}

/** 바이너리 매칭: 좌/우 중 작은 쪽(소실적)을 매칭하고 나머지는 이월 */
export function binaryMatch(left: number, right: number, cfg: PlanConfig['binary']) {
  const matched = Math.max(0, Math.min(left, right));
  let bonus = floor2((matched * cfg.rate) / 100);
  if (cfg.capPerPeriod > 0) bonus = Math.min(bonus, cfg.capPerPeriod);
  return { matched, bonus, left: left - matched, right: right - matched };
}

export interface RankInputMember {
  id: string;
  sponsorId: string | null;
  personalPv: number;
  rankLevel: number;
  active: boolean;
}

/** 직급 평가 (승급만, 강등 없음). 그룹 PV = 본인 + 추천 하위 전체 */
export function evaluateRanks(members: RankInputMember[], ranks: Rank[]) {
  const children = new Map<string, string[]>();
  const byId = new Map(members.map((m) => [m.id, m]));
  for (const m of members) {
    if (m.sponsorId && byId.has(m.sponsorId)) {
      const arr = children.get(m.sponsorId) ?? [];
      arr.push(m.id);
      children.set(m.sponsorId, arr);
    }
  }
  // 반복형 후위 순회로 그룹 PV 계산 (깊은 트리에서도 스택 오버플로 없음)
  const groupPv = new Map<string, number>();
  const roots = members.filter((m) => !m.sponsorId || !byId.has(m.sponsorId)).map((m) => m.id);
  const stack: Array<{ id: string; done: boolean }> = roots.map((id) => ({ id, done: false }));
  while (stack.length) {
    const top = stack.pop()!;
    const kids = children.get(top.id) ?? [];
    if (!top.done) {
      stack.push({ id: top.id, done: true });
      for (const k of kids) stack.push({ id: k, done: false });
    } else {
      let sum = byId.get(top.id)!.personalPv;
      for (const k of kids) sum += groupPv.get(k) ?? 0;
      groupPv.set(top.id, sum);
    }
  }
  const sorted = [...ranks].sort((a, b) => b.level - a.level);
  const changes: Array<{ id: string; from: number; to: number; groupPv: number }> = [];
  for (const m of members) {
    if (!m.active) continue;
    const directs = (children.get(m.id) ?? []).filter((k) => (byId.get(k)?.personalPv ?? 0) > 0).length;
    const g = groupPv.get(m.id) ?? 0;
    const qualified = sorted.find(
      (r) => m.personalPv >= r.minPersonalPv && g >= r.minGroupPv && directs >= r.minDirectCount,
    );
    const to = qualified?.level ?? 0;
    if (to > m.rankLevel) changes.push({ id: m.id, from: m.rankLevel, to, groupPv: g });
  }
  return { changes, groupPv };
}
