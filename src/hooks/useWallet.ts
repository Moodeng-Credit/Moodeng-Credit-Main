

import { parseUnits } from 'viem';
import { useWriteContract } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { ALLOWED_CHAIN_DISPLAY_NAME, getAllowedChainTokenConfig } from '@/config/wagmiConfig';
import { ERROR_CODES } from '@/types/errorCodes';
import { getToastKeyFromErrorCode } from '@/types/errorToastMapping';

const ERC20_ABI = [
   {
      constant: false,
      inputs: [
         { name: 'to', type: 'address' },
         { name: 'amount', type: 'uint256' }
      ],
      name: 'transfer',
      outputs: [{ name: '', type: 'bool' }],
      type: 'function'
   },
   {
      constant: true,
      inputs: [],
      name: 'decimals',
      outputs: [{ name: '', type: 'uint8' }],
      type: 'function'
   }
];

const useWallet = () => {
   const { writeContractAsync } = useWriteContract();
   const { showToastByConfig } = useToast();

   const Transfer = async (e: unknown, recipient: string, amount: string, id: string, coin: string = 'USDC'): Promise<string | null> => {
      console.log('[Transfer] Starting transfer - Loan ID:', id, 'Coin:', coin);

      const tokenConfig = getAllowedChainTokenConfig();
      console.log('[Transfer] Token config:', tokenConfig);

      if (!tokenConfig) {
         console.error('[Transfer] Missing token configuration for', ALLOWED_CHAIN_DISPLAY_NAME, 'Loan ID:', id);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.NETWORK_REQUIRED));
         return null;
      }

      const effectiveCoin = (tokenConfig as Record<string, string | number>)[coin] ? coin : 'USDC';
      const tokenAddress = (tokenConfig as Record<string, string | number>)[effectiveCoin] as string | undefined;
      if (!tokenAddress) {
         console.error('[Transfer] Missing token address for', effectiveCoin, 'on', ALLOWED_CHAIN_DISPLAY_NAME);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
         return null;
      }

      console.log('[Transfer] Using', ALLOWED_CHAIN_DISPLAY_NAME, 'and', effectiveCoin);
      try {
         // USDC uses 6 decimals
         const decimals = 6;
         const amounts = parseUnits(amount, decimals);

         const hash = await writeContractAsync({
            address: tokenAddress as unknown as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, amounts]
         });

         console.log('Transaction hash:', hash);
         console.log('Loan ID:', id);

         return hash;
      } catch (err) {
         console.error('Tx failed:', err);
         showToastByConfig(getToastKeyFromErrorCode(ERROR_CODES.TRANSACTION_FAILED));
         return null;
      }
   };

   return { Transfer };
};

export default useWallet;
