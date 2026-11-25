'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import GoogleButton from '@/components/GoogleButton';
import { signIn, type AuthState } from '../actions';

export default function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signIn, {});
  return (
    <form action={action} className="card w-full max-w-sm space-y-4">
      <h1 className="h1">로그인</h1>
      {notice && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{notice}</p>}
      <input type="hidden" name="next" value={next ?? ''} />
      <div>
        <label className="label">이메일</label>
        <input name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label">비밀번호</label>
        <input name="password" type="password" required className="input" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? '로그인 중…' : '로그인'}</button>
      <GoogleButton mode="login" />
      <p className="text-center text-sm text-slate-500">
        계정이 없나요? <Link href="/signup" className="text-brand-600 underline">회원가입</Link>
      </p>
    </form>
  );
}
