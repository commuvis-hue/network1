'use client';

import { useState, useTransition } from 'react';
import { erc20Abi, parseUnits } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { appChain, TOKEN_ADDRESS, TOKEN_DECIMALS, TOKEN_SYMBOL } from '@/lib/chain';
import { markPayoutPaid, rejectPayout } from '../actions';

/** 관리자 지갑(MetaMask)에서 회원 지갑으로 직접 전송 후 지급 완료 기록 */
export default function PayoutSender({ id, to, amount }: { id: string; to: string; amount: number }) {
  const { address, chainId } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const [manual, setManual] = useState('');
  const [err, setErr] = useState<string>();
  const [saving, start] = useTransition();

  const send = async () => {
    setErr(undefined);
    try {
      const hash = await writeContractAsync({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [to as `0x${string}`, parseUnits(amount.toFixed(2), TOKEN_DECIMALS)],
        chainId: appChain.id,
      });
      start(() => markPayoutPaid(id, hash));
    } catch (e) {
      setErr(e instanceof Error ? e.message.split('\n')[0] : '전송 실패');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="btn px-3 py-1 text-xs" disabled={!address || chainId !== appChain.id || isPending || saving} onClick={send}>
        {isPending ? '승인 대기…' : `${amount} ${TOKEN_SYMBOL} 전송`}
      </button>
      <input
        value={manual}
        onChange={(e) => setManual(e.target.value)}
        placeholder="또는 tx 해시 입력"
        className="input w-48 py-1 text-xs"
      />
      <button
        className="btn-outline px-2 py-1 text-xs"
        disabled={!manual || saving}
        onClick={() => start(() => markPayoutPaid(id, manual.trim()))}
      >
        지급 처리
      </button>
      <button className="btn-danger" disabled={saving} onClick={() => start(() => rejectPayout(id))}>반려</button>
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}
