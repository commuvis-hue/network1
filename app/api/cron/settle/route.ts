import { NextResponse } from 'next/server';
import { runSettlement } from '@/lib/server/commissions';

export const maxDuration = 300;

/** Vercel Cron: CRON_SECRET 환경변수를 설정하면 Authorization: Bearer 헤더로 자동 전송됨 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await runSettlement();
  return NextResponse.json(result);
}
