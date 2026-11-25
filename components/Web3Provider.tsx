'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { createConfig, http, WagmiProvider } from 'wagmi';
import { appChain, RPC_URL } from '@/lib/chain';

/**
 * 'wagmi/connectors'는 import하지 않습니다.
 * (Coinbase/Base 등 모든 커넥터 SDK가 함께 번들되어 Vercel 빌드가 실패함)
 * 대신 EIP-6963 자동 감지로 브라우저에 설치된 MetaMask 등 지갑을 찾습니다.
 */
const wagmiConfig = createConfig({
  chains: [appChain],
  multiInjectedProviderDiscovery: true,
  transports: { [appChain.id]: http(RPC_URL) },
  ssr: true,
});

export default function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
