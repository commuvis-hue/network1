import { createAdminClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import Cart from './Cart';

export default async function ShopPage() {
  const db = createAdminClient();
  const { data } = await db.from('products').select('*').eq('active', true).order('created_at');
  return (
    <div className="space-y-6">
      <h1 className="h1">상품 구매</h1>
      <Cart products={(data ?? []) as Product[]} />
    </div>
  );
}
