import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-bold">Network Commerce</span>
        <nav className="flex gap-2">
          <Link href="/login" className="btn-outline">로그인</Link>
          <Link href="/signup" className="btn">회원가입</Link>
        </nav>
      </header>

      <section className="flex flex-1 flex-col justify-center py-16">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight">
          좋은 상품을 쓰고, 소개하고,<br />판매 실적만큼 투명하게 보상받으세요.
        </h1>
        <p className="mt-4 max-w-xl text-slate-600">
          모든 후원수당은 실제 상품 판매(PV)에서만 발생하며, 수당 총액은 매출의 35%를 넘지 않습니다.
          결제와 출금은 연결된 지갑으로 처리됩니다.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup" className="btn">시작하기</Link>
          <Link href="/login" className="btn-outline">회원 로그인</Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-4">
          {[
            ['유니레벨', '추천 라인 대수별 판매 수당'],
            ['바이너리', '좌·우 소실적 매칭 수당'],
            ['매트릭스', '고정 폭 자동 배치 수당'],
            ['직급 롤업', '직급별 차등 보너스'],
          ].map(([t, d]) => (
            <div key={t} className="card">
              <div className="font-semibold">{t}</div>
              <div className="mt-1 text-sm text-slate-500">{d}</div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 py-6 text-xs text-slate-500">
        본 서비스는 「방문판매 등에 관한 법률」에 따른 다단계판매업 등록 및 공제조합 가입 후 운영됩니다.
        가입비·의무 구매·원금 보장·확정 수익은 없습니다.
      </footer>
    </main>
  );
}
