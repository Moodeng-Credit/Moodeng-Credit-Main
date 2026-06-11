/**
 * ABIs for the LoanManager contract and the USDC ERC20 token.
 *
 * Only the functions the app calls are included. Repayments are automatic (no claim):
 * repay() forwards USDC to the Note owner / listing seller, so there is no
 * claimRepayments / getClaimable in this ABI. See REPAYMENT_MODEL.md.
 */

export const LOAN_MANAGER_ABI = [
   {
      type: 'function',
      name: 'createAndFundLoan',
      stateMutability: 'nonpayable',
      inputs: [
         { name: 'borrower', type: 'address' },
         { name: 'principal', type: 'uint256' },
         { name: 'totalOwed', type: 'uint256' },
         { name: 'dueDate', type: 'uint256' },
         { name: 'requestId', type: 'bytes32' }
      ],
      outputs: [{ name: 'loanId', type: 'uint256' }]
   },
   {
      type: 'function',
      name: 'listLoanNote',
      stateMutability: 'nonpayable',
      inputs: [
         { name: 'loanId', type: 'uint256' },
         { name: 'price', type: 'uint256' }
      ],
      outputs: []
   },
   {
      type: 'function',
      name: 'buyLoanNote',
      stateMutability: 'nonpayable',
      inputs: [{ name: 'loanId', type: 'uint256' }],
      outputs: []
   },
   {
      type: 'function',
      name: 'repay',
      stateMutability: 'nonpayable',
      inputs: [
         { name: 'loanId', type: 'uint256' },
         { name: 'amount', type: 'uint256' }
      ],
      outputs: []
   },
   {
      type: 'function',
      name: 'getLoan',
      stateMutability: 'view',
      inputs: [{ name: 'loanId', type: 'uint256' }],
      outputs: [
         {
            name: '',
            type: 'tuple',
            components: [
               { name: 'borrower', type: 'address' },
               { name: 'principal', type: 'uint256' },
               { name: 'totalOwed', type: 'uint256' },
               { name: 'amountRepaid', type: 'uint256' },
               { name: 'dueDate', type: 'uint256' },
               { name: 'createdAt', type: 'uint256' },
               { name: 'requestId', type: 'bytes32' },
               { name: 'status', type: 'uint8' }
            ]
         }
      ]
   },
   {
      type: 'function',
      name: 'nextLoanId',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint256' }]
   },
   {
      type: 'function',
      name: 'getRemainingOwed',
      stateMutability: 'view',
      inputs: [{ name: 'loanId', type: 'uint256' }],
      outputs: [{ name: '', type: 'uint256' }]
   },
   {
      type: 'function',
      name: 'getRepaymentRecipient',
      stateMutability: 'view',
      inputs: [{ name: 'loanId', type: 'uint256' }],
      outputs: [{ name: '', type: 'address' }]
   },
   {
      type: 'function',
      name: 'ownerOf',
      stateMutability: 'view',
      inputs: [{ name: 'tokenId', type: 'uint256' }],
      outputs: [{ name: '', type: 'address' }]
   },
   {
      type: 'function',
      name: 'listings',
      stateMutability: 'view',
      inputs: [{ name: 'loanId', type: 'uint256' }],
      outputs: [
         { name: 'seller', type: 'address' },
         { name: 'price', type: 'uint256' },
         { name: 'active', type: 'bool' }
      ]
   }
] as const;

export const ERC20_ABI = [
   {
      type: 'function',
      name: 'approve',
      stateMutability: 'nonpayable',
      inputs: [
         { name: 'spender', type: 'address' },
         { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ name: '', type: 'bool' }]
   },
   {
      type: 'function',
      name: 'allowance',
      stateMutability: 'view',
      inputs: [
         { name: 'owner', type: 'address' },
         { name: 'spender', type: 'address' }
      ],
      outputs: [{ name: '', type: 'uint256' }]
   },
   {
      type: 'function',
      name: 'balanceOf',
      stateMutability: 'view',
      inputs: [{ name: 'account', type: 'address' }],
      outputs: [{ name: '', type: 'uint256' }]
   },
   {
      type: 'function',
      name: 'decimals',
      stateMutability: 'view',
      inputs: [],
      outputs: [{ name: '', type: 'uint8' }]
   }
] as const;
