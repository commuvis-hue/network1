'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import ConnectWallet from '@/components/ConnectWallet';

export default function LinkWallet({ linked }: { linked: string | null }) {
  const router = useRouter();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  const same = address && linked && address.toLowerCase() === linked.toLowerCase();

  return (
    <div className="space-y-3">
      <ConnectWallet />
      {address && !same && (
        <button
          className="btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(undefined);
            try {
              const { message } = await fetch('/api/wallet/nonce', { method: 'POST' }).then((r) => r.json());
              const signature = await signMessageAsync({ message });
              const res = await fetch('/api/wallet/link', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ address, signature }),
              });
              const body = await res.json();
              if (!res.ok) throw new Error(body.error);
              setMsg('지갑이 연결되었습니다.');
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message.split('\n')[0] : '실패');
            } finally {
              setBusy(false);
            }
          }}
        >
          {linked ? '이 지갑으로 변경' : '이 지갑을 계정에 연결'} (서명)
        </button>
      )}
      {same && <p className="text-sm text-green-700">현재 연결된 지갑입니다.</p>}
      {msg && <p className="text-sm text-slate-600">{msg}</p>}
    </div>
  );
}
