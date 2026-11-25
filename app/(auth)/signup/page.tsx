import { createAdminClient } from '@/lib/supabase/server';
import SignupForm from './SignupForm';

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = '' } = await searchParams;
  let sponsorName: string | undefined;
  if (ref) {
    const db = createAdminClient();
    const { data } = await db
      .from('profiles')
      .select('name')
      .eq('referral_code', ref.toUpperCase())
      .maybeSingle();
    sponsorName = data?.name || undefined;
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <SignupForm refCode={ref.toUpperCase()} sponsorName={sponsorName} />
    </main>
  );
}
