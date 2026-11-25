import { NextResponse } from 'next/server';
import { walletLinkMessage } from '@/lib/chain';
import { getSessionUser } from '@/lib/server/auth';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const nonce = crypto.randomUUID();
  await createAdminClient().from('profiles').update({ wallet_nonce: nonce }).eq('id', user.id);
  return NextResponse.json({ message: walletLinkMessage(user.id, nonce) });
}
