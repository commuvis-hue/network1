import 'server-only';
import { normalizePlan, type PlanConfig, type Rank } from '@/lib/commission/engine';
import { createAdminClient } from '@/lib/supabase/server';
import type { RankRow } from '@/lib/types';

export async function getPlan(): Promise<PlanConfig> {
  const db = createAdminClient();
  const { data } = await db.from('settings').select('config').eq('id', 1).single();
  return normalizePlan(data?.config as Partial<PlanConfig>);
}

export async function getRanks(): Promise<Rank[]> {
  const db = createAdminClient();
  const { data } = await db.from('ranks').select('*').order('level');
  return ((data ?? []) as RankRow[]).map((r) => ({
    level: r.level,
    name: r.name,
    minPersonalPv: Number(r.min_personal_pv),
    minGroupPv: Number(r.min_group_pv),
    minDirectCount: Number(r.min_direct_count),
    bonusRate: Number(r.bonus_rate),
  }));
}
