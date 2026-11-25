'use client';

import { useState, useTransition } from 'react';
import { money, num } from '@/lib/format';
import type { Product } from '@/lib/types';
import { createOrder } from '../actions';

export default function Cart({ products }: { products: Product[] }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<'crypto' | 'manual'>('crypto');
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const lines = products.filter((p) => (qty[p.id] ?? 0) > 0);
  const total = lines.reduce((s, p) => s + Number(p.price) * qty[p.id], 0);
  const pv = lines.reduce((s, p) => s + Number(p.pv) * qty[p.id], 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {products.map((p) => (
          <div key={p.id} className="card flex flex-col">
            {p.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image_url} alt={p.name} className="mb-3 aspect-video w-full rounded-lg object-cover" />
            )}
            <div className="font-semibold">{p.name}</div>
            <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-500">{p.description}</p>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="font-bold">{money(p.price)}</div>
                <div className="text-xs text-slate-500">PV {num(p.pv)}{p.stock !== null && ` · 재고 ${p.stock}`}</div>
              </div>
              <input
                type="number"
                min={0}
                max={p.stock ?? 100}
                value={qty[p.id] ?? 0}
                onChange={(e) => setQty({ ...qty, [p.id]: Math.max(0, Number(e.target.value)) })}
                className="input w-20"
              />
            </div>
          </div>
        ))}
        {!products.length && <p className="text-slate-500">등록된 상품이 없습니다.</p>}
      </div>

      <div className="card h-fit space-y-4 lg:sticky lg:top-6">
        <div className="font-semibold">주문 요약</div>
        <ul className="space-y-1 text-sm">
          {lines.map((p) => (
            <li key={p.id} className="flex justify-between">
              <span>{p.name} × {qty[p.id]}</span>
              <span>{money(Number(p.price) * qty[p.id])}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t pt-3 font-bold">
          <span>합계</span><span>{money(total)}</span>
        </div>
        <div className="text-sm text-slate-500">적립 PV {num(pv)}</div>
        <div className="space-y-1 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={method === 'crypto'} onChange={() => setMethod('crypto')} /> 지갑 결제 (스테이블코인)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={method === 'manual'} onChange={() => setMethod('manual')} /> 무통장 입금 (관리자 확인)
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          className="btn w-full"
          disabled={!lines.length || pending}
          onClick={() =>
            start(async () => {
              setError(undefined);
              const res = await createOrder(lines.map((p) => ({ productId: p.id, qty: qty[p.id] })), method);
              if (res?.error) setError(res.error);
            })
          }
        >
          {pending ? '주문 생성 중…' : '주문하기'}
        </button>
      </div>
    </div>
  );
}
