'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { appChain } from '@/lib/chain';
import { shortAddr } from '@/lib/format';

export default function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  // EIP-6963으로 감지된 지갑 중 MetaMask 우선
  const connector = connectors.find((c) => c.id === 'io.metamask') ?? connectors[0];

  if (!isConnected && !connector)
    return (
      <p className="text-sm text-slate-600">
        MetaMask가 감지되지 않았습니다.{' '}
        <a href="https://metamask.io/download/" target="_blank" className="text-brand-600 underline">
          MetaMask 설치
        </a>{' '}
        후 새로고침하세요. 모바일은 MetaMask 앱 안의 브라우저로 접속하세요.
      </p>
    );

  if (!isConnected)
    return (
      <div>
        <button
          className="btn-outline"
          disabled={isPending}
          onClick={() => connector && connect({ connector, chainId: appChain.id })}
        >
          {isPending ? '연결 중…' : `${connector?.name ?? 'MetaMask'} 연결`}
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
