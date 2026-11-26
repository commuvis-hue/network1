'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg space-y-3">
        <h1 className="h1">문제가 발생했습니다</h1>
        <p className="text-sm text-slate-600">{error.message || '알 수 없는 오류'}</p>
        {error.digest && <p className="text-xs text-slate-400">오류 코드: {error.digest}</p>}
        <div className="flex gap-2">
          <button className="btn" onClick={reset}>다시 시도</button>
          <a href="/login" className="btn-outline">로그인 화면</a>
        </div>
      </div>
    </main>
  );
}
