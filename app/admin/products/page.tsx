import { createAdminClient } from '@/lib/supabase/server';
import { money, num } from '@/lib/format';
import type { Product } from '@/lib/types';
import { saveProduct, toggleProduct } from '../actions';

function ProductForm({ p }: { p?: Product }) {
  return (
    <form action={saveProduct} className="grid gap-3 sm:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="sm:col-span-2">
        <label className="label">상품명</label>
        <input name="name" defaultValue={p?.name} required className="input" />
      </div>
      <div className="sm:col-span-2">
        <label className="label">설명</label>
        <textarea name="description" defaultValue={p?.description} rows={3} className="input" />
      </div>
      <div>
        <label className="label">판매가</label>
        <input name="price" type="number" step="0.01" min="0.01" defaultValue={p?.price} required className="input" />
      </div>
      <div>
        <label className="label">PV (수당 기준 점수)</label>
        <input name="pv" type="number" step="0.01" min="0" defaultValue={p?.pv} required className="input" />
      </div>
      <div>
        <label className="label">재고 (비우면 무제한)</label>
        <input name="stock" type="number" min="0" defaultValue={p?.stock ?? ''} className="input" />
      </div>
      <div>
        <label className="label">이미지 URL</label>
        <input name="image_url" defaultValue={p?.image_url ?? ''} className="input" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={p?.active ?? true} /> 판매 중
      </label>
      <div className="sm:col-span-2">
        <button className="btn">{p ? '수정 저장' : '상품 등록'}</button>
      </div>
    </form>
  );
}

export default async function AdminProducts() {
  const db = createAdminClient();
  const { data } = await db.from('products').select('*').order('created_at', { ascending: false });
  const products = (data ?? []) as Product[];

  return (
    <div className="space-y-6">
      <h1 className="h1">상품 관리</h1>
      <div className="card">
        <div className="mb-3 font-semibold">새 상품 등록</div>
        <ProductForm />
        <p className="mt-3 text-xs text-slate-500">
          실물 상품 또는 서비스만 등록하세요. PV는 수당 계산 기준이며 판매가보다 클 수 없게 운영하는 것을 권장합니다.
        </p>
      </div>

      <div className="space-y-3">
        {products.map((p) => (
          <details key={p.id} className="card">
            <summary className="flex cursor-pointer items-center justify-between gap-4">
              <span className="font-medium">{p.name}</span>
              <span className="flex items-center gap-3 text-sm text-slate-500">
                {money(p.price)} · PV {num(p.pv)} · 재고 {p.stock ?? '∞'}
                <span className={`badge ${p.active ? 'bg-green-50 text-green-700' : ''}`}>{p.active ? '판매 중' : '중지'}</span>
              </span>
            </summary>
            <div className="mt-4 space-y-3">
              <ProductForm p={p} />
              <form action={toggleProduct.bind(null, p.id, !p.active)}>
                <button className="btn-outline">{p.active ? '판매 중지' : '판매 재개'}</button>
              </form>
            </div>
          </details>
        ))}
        {!products.length && <p className="text-slate-500">등록된 상품이 없습니다.</p>}
      </div>
    </div>
  );
}
