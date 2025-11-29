'use client';

import { useDispatch } from 'react-redux';
import { parseUnits } from 'viem';
import { useSwitchChain, useWriteContract } from 'wagmi';

import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { chainIdFromNetwork, tokenAddresses } from '@/config/wagmiConfig';
import { addHash } from '@/store/slices/loanSlice';
import type { AppDispatch } from '@/store/store';

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
   const dispatch = useDispatch<AppDispatch>();
   const { switchChain } = useSwitchChain();
   const { writeContractAsync } = useWriteContract();
   const { showToastByConfig } = useToast();

   const Transfer = async (e: unknown, recipient: string, amount: string, id: string, block: string, coin: string) => {
      const blockChain = chainIdFromNetwork(block);
      try {
         const targetChainId = tokenAddresses[blockChain || ''].id;
         const tokenAddress = tokenAddresses[targetChainId][coin as keyof (typeof tokenAddresses)[typeof targetChainId]];
         switchChain({ chainId: targetChainId });

         const decimals = coin === 'Link' ? 18 : 6;
         const amounts = parseUnits(amount, decimals);

         const hash = await writeContractAsync({
            address: tokenAddress as unknown as `0x${string}`,
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [recipient, amounts]
         });

         await dispatch(
            addHash({
               _id: id,
               hash: hash
            })
         )
            .unwrap()
            .then(() => {
               console.log('Hash added successfully for loan:', id);
            })
            .catch((error) => {
               console.error('Error adding Hash:', error.message || error);
            });

         console.log('Transaction hash:', hash);
         console.log('Loan ID:', id);
         return true;
      } catch (err) {
         console.error('Tx failed:', err);
         showToastByConfig('transaction_error');
         return false;
      }
   };

   return { Transfer };
};

export default useWallet;
