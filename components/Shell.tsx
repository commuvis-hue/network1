import Link from 'next/link';
import { signOut } from '@/app/(auth)/actions';
import Web3Provider from './Web3Provider';

export default function Shell({
  title,
  nav,
  userName,
  extra,
  children,
}: {
  title: string;
  nav: Array<{ href: string; label: string }>;
  userName: string;
  extra?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Web3Provider>
      <div className="min-h-screen md:flex">
        <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-56 md:border-r md:border-b-0">
          <div className="px-5 py-5 text-lg font-bold">{title}</div>
          <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-lg px-3 py-2 text-sm whitespace-nowrap text-slate-700 hover:bg-slate-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="hidden px-5 py-4 text-sm text-slate-500 md:block">
            <div className="mb-2 font-medium text-slate-700">{userName}</div>
            {extra}
            <form action={signOut}>
              <button className="mt-2 text-slate-500 underline">로그아웃</button>
            </form>
          </div>
        </aside>
        <main className="flex-1 p-5 md:p-8">{children}</main>
      </div>
    </Web3Provider>
  );
}
