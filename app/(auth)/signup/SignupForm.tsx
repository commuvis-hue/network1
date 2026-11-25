'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import GoogleButton from '@/components/GoogleButton';
import { signUp, type AuthState } from '../actions';

export default function SignupForm({ refCode, sponsorName }: { refCode: string; sponsorName?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {});

  if (state.message)
    return (
      <div className="card w-full max-w-md space-y-3">
        <h1 className="h1">메일을 확인하세요</h1>
        <p className="text-sm text-slate-600">{state.message}</p>
        <Link href="/login" className="btn-outline">로그인으로</Link>
      </div>
    );

  return (
    <form action={action} className="card w-full max-w-md space-y-4">
      <h1 className="h1">회원가입</h1>
      {sponsorName && (
        <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-700">
          추천인: <b>{sponsorName}</b>
        </p>
      )}
      <div>
        <label className="label">이름</label>
        <input name="name" required className="input" />
      </div>
      <div>
        <label className="label">이메일</label>
        <input name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label">비밀번호 (8자 이상)</label>
        <input name="password" type="password" minLength={8} required className="input" />
      </div>
      <div>
        <label className="label">추천인 코드</label>
        <input name="ref" defaultValue={refCode} className="input uppercase" placeholder="없으면 비워두세요" />
      </div>
      <div>
        <label className="label">바이너리 배치 위치</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="side" value="L" defaultChecked /> 왼쪽</label>
          <label className="flex items-center gap-2"><input type="radio" name="side" value="R" /> 오른쪽</label>
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" name="agree" className="mt-1" />
        <span>
          판매원 약관과 개인정보 처리방침에 동의합니다. 가입비와 의무 구매는 없으며,
          후원수당은 실제 상품 판매 실적에 따라서만 지급됩니다.
        </span>
      </label>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? '처리 중…' : '이메일로 가입하기'}</button>
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />또는<span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleButton mode="signup" />
      <p className="text-xs text-slate-500">Google로 가입할 때는 이름·이메일·비밀번호를 입력하지 않아도 됩니다. 추천인 코드와 배치 위치, 동의 체크만 해주세요.</p>
      <p className="text-center text-sm text-slate-500">
        이미 회원인가요? <Link href="/login" className="text-brand-600 underline">로그인</Link>
      </p>
    </form>
  );
}
