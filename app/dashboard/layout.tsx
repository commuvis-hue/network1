import Link from 'next/link';
import Shell from '@/components/Shell';
import { requireMember } from '@/lib/server/auth';
import { placeMember } from '@/lib/server/placement';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let profile = await requireMember();
  if (!profile.placed) {
    await placeMember(profile.id).catch((e) => console.error(e));
    profile = await requireMember();
  }
  return (
    <Shell
      title="회원센터"
      userName={profile.name || profile.email || ''}
      nav={[
        { href: '/dashboard', label: '대시보드' },
        { href: '/dashboard/shop', label: '상품 구매' },
        { href: '/dashboard/orders', label: '주문 내역' },
        { href: '/dashboard/tree', label: '조직도' },
        { href: '/dashboard/commissions', label: '수당 내역' },
        { href: '/dashboard/wallet', label: '지갑 · 출금' },
      ]}
      extra={profile.role === 'admin' ? <Link href="/admin" className="block text-brand-600 underline">관리자 화면</Link> : null}
    >
      {children}
    </Shell>
  );
}
