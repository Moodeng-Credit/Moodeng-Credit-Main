import { type Chain } from 'wagmi/chains';

export interface CustomChainConfig extends Chain {
   iconBackground: string;
   displayName: string;
   shortName: string;
   color: string;
   bgColor: string;
   textColor: string;
   tokens: Record<string, string>;
}
