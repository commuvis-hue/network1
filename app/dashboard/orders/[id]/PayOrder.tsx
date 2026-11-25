'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { erc20Abi, parseUnits } from 'viem';
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import ConnectWallet from '@/components/ConnectWallet';
import { appChain, TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL, TREASURY_ADDRESS } from '@/lib/chain';

export default function PayOrder({
  orderId,
  amount,
  linkedWallet,
}: {
  orderId: string;
  amount: number;
  linkedWallet: string | null;
}) {
  const router = useRouter();
  const { address, chainId } = useAccount();
  const { writeContractAsync, data: hash, isPending } = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash, chainId: appChain.id });
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState<string>();

  // 트랜잭션 채굴 후 서버 검증 (확인 블록 수가 모자라면 재시도)
  useEffect(() => {
    if (!hash || !receipt.isSuccess) return;
    let stop = false;
    const verify = async () => {
      setStatus('서버에서 결제를 확인하는 중…');
      const res = await fetch(`/api/orders/${orderId}/verify`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ txHash: hash }),
      });
      const body = await res.json().catch(() => ({}));
      if (stop) return;
      if (res.status === 202) {
        setStatus(body.message ?? '블록 확인 대기 중…');
        setTimeout(verify, 6000);
      } else if (res.ok) {
        setStatus('결제가 완료되었습니다.');
        router.refresh();
      } else {
        setError(body.error ?? '결제 확인에 실패했습니다.');
      }
    };
    verify();
    return () => {
      stop = true;
    };
  }, [hash, receipt.isSuccess, orderId, router]);

  if (!linkedWallet)
    return (
      <div className="card text-sm">
        지갑 결제를 하려면 먼저 <Link href="/dashboard/wallet" className="text-brand-600 underline">지갑을 연결</Link>하세요.
      </div>
    );

  const wrongWallet = address && address.toLowerCase() !== linkedWallet.toLowerCase();

  return (
    <div className="card space-y-3">
      <div className="font-semibold">지갑으로 결제</div>
      <p className="text-sm text-slate-600">
        {appChain.name} 네트워크에서 {amount} {TOKEN_SYMBOL}를 회사 지갑으로 전송합니다.
      </p>
      <ConnectWallet />
      {wrongWallet && <p className="text-sm text-red-600">회원 계정에 연결된 지갑({linkedWallet})으로 결제해야 합니다.</p>}
      <button
        className="btn"
        disabled={!address || !!wrongWallet || chainId !== appChain.id || isPending || !!hash}
        onClick={async () => {
          setError(undefined);
          try {
            await writeContractAsync({
              address: TOKEN_ADDRESS,
              abi: erc20Abi,
              functionName: 'transfer',
              args: [TREASURY_ADDRESS, parseUnits(amount.toFixed(2), TOKEN_DECIMALS)],
              chainId: appChain.id,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message.split('\n')[0] : '전송이 취소되었습니다.');
          }
        }}
      >
        {isPending ? '지갑에서 승인 대기…' : hash ? '전송됨' : `${amount} ${TOKEN_SYMBOL} 결제`}
      </button>
      {hash && !receipt.isSuccess && <p className="text-sm text-slate-500">트랜잭션 처리 중…</p>}
      {status && <p className="text-sm text-slate-600">{status}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
