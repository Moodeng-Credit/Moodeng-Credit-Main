# LoanManager Deployments

## Base Mainnet (chain 8453)

| Field | Value |
|-------|-------|
| **LoanManager** | `0x15c3999a6E00AEb2Dc41a82b894b5C81CaFE7C89` |
| Admin / owner (DEFAULT_ADMIN + ADMIN + ORIGINATOR) | `0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6` (Moodeng Base Account) |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Deployed | 2026-06-11 |
| Compiler | solc 0.8.x (OpenZeppelin v5.6.1) |
| Verified on Basescan | ✅ https://basescan.org/address/0x15c3999a6E00AEb2Dc41a82b894b5C81CaFE7C89#code |

### Frontend env (set in the deploy environment, e.g. Vercel; Vite inlines at build time)

```
VITE_ENABLE_REAL_LOAN_MANAGER=true
VITE_LOAN_MANAGER_ADDRESS=0x15c3999a6E00AEb2Dc41a82b894b5C81CaFE7C89
VITE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
# VITE_PAYMASTER_URL=<your Coinbase Developer Platform paymaster endpoint>  # optional, for gasless
```

### Paymaster allowlist (Coinbase Developer Platform)
- LoanManager `0x15c3999a6E00AEb2Dc41a82b894b5C81CaFE7C89`: `createAndFundLoan(address,uint256,uint256,uint256,bytes32),listLoanNote(uint256,uint256),buyLoanNote(uint256),repay(uint256,uint256),settle(uint256)`
- USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`: `approve(address,uint256)`

> Deployed once via a throwaway EOA (gas only); the admin/owner is the Moodeng Base Account above.
