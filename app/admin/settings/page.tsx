import { getPlan } from '@/lib/server/settings';
import { createAdminClient } from '@/lib/supabase/server';
import type { RankRow } from '@/lib/types';
import { savePlan, saveRank } from '../actions';

export default async function AdminSettings() {
  const plan = await getPlan();
  const { data } = await createAdminClient().from('ranks').select('*').order('level');
  const ranks = (data ?? []) as RankRow[];

  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="h1">수당 설정</h1>

      <form action={savePlan} className="space-y-6">
        <section className="card space-y-3">
          <Toggle name="unilevel.enabled" label="유니레벨" checked={plan.unilevel.enabled} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="대수별 요율 % (쉼표 구분)" name="unilevel.rates" value={plan.unilevel.rates.join(', ')} />
            <Field label="활성 기준 PV (최근 30일)" name="unilevel.activeMinPv" value={plan.unilevel.activeMinPv} type="number" />
            <Toggle name="unilevel.compression" label="압축(비활성 회원 건너뛰기)" checked={plan.unilevel.compression} />
          </div>
        </section>

        <section className="card space-y-3">
          <Toggle name="binary.enabled" label="바이너리" checked={plan.binary.enabled} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="소실적 매칭 요율 %" name="binary.rate" value={plan.binary.rate} type="number" />
            <Field label="1인 1회 정산 상한 (0=없음)" name="binary.capPerPeriod" value={plan.binary.capPerPeriod} type="number" />
          </div>
        </section>

        <section className="card space-y-3">
          <Toggle name="matrix.enabled" label="매트릭스" checked={plan.matrix.enabled} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="폭 (2~10, 신규 배치부터 적용)" name="matrix.width" value={plan.matrix.width} type="number" />
            <Field label="깊이별 요율 % (쉼표 구분)" name="matrix.rates" value={plan.matrix.rates.join(', ')} />
          </div>
        </section>

        <section className="card space-y-3">
          <Toggle name="rank.enabled" label="직급 차등(롤업) 보너스" checked={plan.rank.enabled} />
          <Field
            label="후원수당 총액 상한 % (법정 최대 35)"
            name="payoutCapPercent"
            value={plan.payoutCapPercent}
            type="number"
          />
          <p className="text-xs text-slate-500">
            주문별 즉시 수당(유니레벨+직급+매트릭스)은 주문 금액 × 상한% 안으로, 바이너리는 정산 기간 매출 × 상한%에서
            즉시 수당을 뺀 금액 안으로 자동 비례 축소됩니다. 35%를 넘게 입력해도 35%로 저장됩니다.
          </p>
        </section>

        <button className="btn">플랜 저장</button>
      </form>

      <section className="card space-y-3">
        <div className="font-semibold">직급</div>
        <div className="hidden grid-cols-7 gap-2 text-xs font-medium text-slate-500 sm:grid">
          <span>레벨</span><span>이름</span><span>개인 PV</span><span>그룹 PV</span><span>직추천 수</span><span>차등 요율 %</span><span />
        </div>
        {[...ranks, { level: (ranks.at(-1)?.level ?? -1) + 1, name: '', min_personal_pv: 0, min_group_pv: 0, min_direct_count: 0, bonus_rate: 0 }].map(
          (r) => (
            <form key={r.level} action={saveRank} className="grid grid-cols-2 gap-2 sm:grid-cols-7">
              <input name="level" defaultValue={r.level} readOnly className="input bg-slate-50" />
              <input name="name" defaultValue={r.name} placeholder="새 직급" className="input" />
              <input name="min_personal_pv" type="number" defaultValue={r.min_personal_pv} className="input" />
              <input name="min_group_pv" type="number" defaultValue={r.min_group_pv} className="input" />
              <input name="min_direct_count" type="number" defaultValue={r.min_direct_count} className="input" />
              <input name="bonus_rate" type="number" step="0.1" defaultValue={r.bonus_rate} className="input" />
              <button className="btn-outline">{r.name ? '저장' : '추가'}</button>
            </form>
          ),
        )}
        <p className="text-xs text-slate-500">직급은 정산 시 평가되며 승급만 적용됩니다 (강등 없음).</p>
      </section>
    </div>
  );
}

function Field({ label, name, value, type = 'text' }: { label: string; name: string; value: string | number; type?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} defaultValue={value} type={type} step="any" className="input" />
    </div>
  );
}

function Toggle({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex items-center gap-2 font-semibold">
      <input type="checkbox" name={name} defaultChecked={checked} /> {label}
    </label>
  );
}
