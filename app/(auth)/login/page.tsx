import LoginForm from './LoginForm';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const notice =
    sp.error === 'suspended'
      ? '이용이 정지된 계정입니다. 관리자에게 문의하세요.'
      : sp.error === 'oauth'
        ? '로그인 처리에 실패했습니다. 다시 시도하세요.'
        : sp.error === 'confirm'
          ? '인증 링크가 만료되었거나 이미 사용되었습니다. 이미 인증했다면 바로 로그인하세요.'
          : undefined;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <LoginForm next={sp.next} notice={notice} />
    </main>
  );
}
