import Link from 'next/link';
import Shell from '@/components/Shell';
import { requireAdmin } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  return (
    <Shell
      title="관리자"
      userName={me.name || me.email || ''}
      nav={[
        { href: '/admin', label: '개요 · 정산' },
        { href: '/admin/products', label: '상품 관리' },
        { href: '/admin/orders', label: '주문 관리' },
        { href: '/admin/members', label: '회원 관리' },
        { href: '/admin/payouts', label: '출금 관리' },
        { href: '/admin/settings', label: '수당 설정' },
      ]}
      extra={<Link href="/dashboard" className="block text-brand-600 underline">회원 화면</Link>}
    >
      {children}
    </Shell>
  );
}
