'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { appChain } from '@/lib/chain';
import { shortAddr } from '@/lib/format';

export default function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  if (!isConnected)
    return (
      <div>
        <button
          className="btn-outline"
          disabled={isPending}
          onClick={() => connectors[0] && connect({ connector: connectors[0], chainId: appChain.id })}
        >
          {isPending ? '연결 중…' : 'MetaMask 연결'}
        </button>
        {error && <p className="mt-1 text-xs text-red-600">{error.message.split('\n')[0]}</p>}
      </div>
    );

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="badge font-mono">{shortAddr(address)}</span>
      {chainId !== appChain.id && (
        <button className="btn-outline" onClick={() => switchChain({ chainId: appChain.id })}>
          {appChain.name}로 전환
        </button>
      )}
      <button className="text-slate-500 underline" onClick={() => disconnect()}>연결 해제</button>
    </div>
  );
}
