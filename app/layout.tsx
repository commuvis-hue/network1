import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Network Commerce',
  description: '상품 판매 기반 네트워크 마케팅 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
