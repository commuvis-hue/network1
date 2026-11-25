import { TOKEN_SYMBOL } from './chain';

export const money = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toLocaleString('ko-KR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${TOKEN_SYMBOL}`;

export const num = (n: number | string | null | undefined) =>
  Number(n ?? 0).toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export const date = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '-';

export const shortAddr = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '-');

export const COMMISSION_LABEL: Record<string, string> = {
  unilevel: '유니레벨',
  binary: '바이너리',
  matrix: '매트릭스',
  rank: '직급(롤업)',
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  refunded: '환불',
  cancelled: '취소',
};
