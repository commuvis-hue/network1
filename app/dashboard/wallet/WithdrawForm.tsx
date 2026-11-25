'use client';

import { useActionState } from 'react';
import { requestWithdrawal } from '../actions';

export default function WithdrawForm({ max, disabled }: { max: number; disabled: boolean }) {
  const [state, action, pending] = useActionState(requestWithdrawal, {} as { error?: string; ok?: boolean });
  return (
    <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1">
        <label className="label">출금 금액</label>
        <input name="amount" type="number" step="0.01" min={0} max={max} className="input" required />
      </div>
      <button className="btn" disabled={pending || disabled}>{pending ? '신청 중…' : '출금 신청'}</button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700">출금 신청이 접수되었습니다.</p>}
    </form>
  );
}
