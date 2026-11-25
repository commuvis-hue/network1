import type { Chain } from 'viem';
import {
  arbitrum,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  mainnet,
  polygon,
  polygonAmoy,
  sepolia,
} from 'viem/chains';

const CHAINS: Record<number, Chain> = {
  [mainnet.id]: mainnet,
  [sepolia.id]: sepolia,
  [polygon.id]: polygon,
  [polygonAmoy.id]: polygonAmoy,
  [bsc.id]: bsc,
  [bscTestnet.id]: bscTestnet,
  [base.id]: base,
  [baseSepolia.id]: baseSepolia,
  [arbitrum.id]: arbitrum,
};

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? sepolia.id);
export const appChain: Chain = CHAINS[CHAIN_ID] ?? sepolia;
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_PAYMENT_TOKEN_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;
export const TOKEN_DECIMALS = Number(process.env.NEXT_PUBLIC_PAYMENT_TOKEN_DECIMALS ?? 6);
export const TOKEN_SYMBOL = process.env.NEXT_PUBLIC_PAYMENT_TOKEN_SYMBOL ?? 'USDT';
export const TREASURY_ADDRESS = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS ??
  '0x0000000000000000000000000000000000000000') as `0x${string}`;

export function explorerTx(hash: string) {
  const url = appChain.blockExplorers?.default.url;
  return url ? `${url}/tx/${hash}` : '#';
}

export function walletLinkMessage(userId: string, nonce: string) {
  return `네트워크 회원 지갑 연결\n회원 ID: ${userId}\nNonce: ${nonce}`;
}
