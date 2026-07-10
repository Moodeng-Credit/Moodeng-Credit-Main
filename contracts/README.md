# Moodeng Credit — Smart Contracts

`LoanManager.sol` — the **Liquidity Relay**. Moodeng fronts an emergency loan first, mints
a transferable ERC721 **Loan Note**, lists it at **principal**, and a lender later buys the
Note (refilling Moodeng's capital). The borrower repays this contract and repayments are
**automatically forwarded** to the current Note owner — there is **no claim step**.

Built with OpenZeppelin Contracts v5.6 (`AccessControl`, `ReentrancyGuard`, `ERC721`,
`ERC721Holder`, `SafeERC20`, `IERC20`). Toolchain: Foundry.

## Setup

```bash
# 1. Install Foundry (one-time)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. From this contracts/ directory, install dependencies (pinned)
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1

# 3. Build & test
forge build
forge test -vvv
```

Remappings are in `remappings.txt`; Solidity 0.8.27 / EVM `cancun` are set in `foundry.toml`.

## Deploy (Base)

```bash
export USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913   # Base mainnet USDC
export ADMIN_ADDRESS=0xYourMoodengFundingWallet

forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_RPC_URL" --broadcast --verify \
  --private-key "$DEPLOYER_PRIVATE_KEY"
```

The admin/originator address receives `DEFAULT_ADMIN_ROLE`, `ADMIN_ROLE`, and
`ORIGINATOR_ROLE`. Grant additional funding wallets with `setOriginator(addr, true)`.

## Wire to the frontend

After deploying, set these in the app env (dotenvx):

```
VITE_ENABLE_REAL_LOAN_MANAGER=true
VITE_LOAN_MANAGER_ADDRESS=0x<deployed address>
VITE_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

The frontend ABI lives at `src/lib/web3/loanManager/abi.ts` and already matches this
contract's external surface (`createAndFundLoan`, `listLoanNote`, `buyLoanNote`, `repay`,
`settle`, `getLoan`, `getRemainingOwed`, `getRepaymentRecipient`, `heldRepayments`,
`ownerOf`, `listings`, `nextLoanId`). After any signature change, refresh it:

```bash
forge inspect src/LoanManager.sol:LoanManager abi > /tmp/LoanManager.abi.json
```

## Gasless contract calls (optional — Base paymaster)

Plain USDC sends are already gasless for Base smart-wallet users, but LoanManager calls
(`buyLoanNote`, `repay`, `settle`, `approve`, …) are contract calls and need a paymaster
to be gasless. Without one they still work — the sender just pays a few cents of Base gas.

To enable sponsorship:

1. In Coinbase Developer Platform → **Paymaster**, pick **Base Mainnet**; copy the endpoint
   `https://api.developer.coinbase.com/rpc/v1/base/<API_KEY>` → that's `VITE_PAYMASTER_URL`.
2. **Allowlist** the deployed `LoanManager` address + the sponsored functions
   (`createAndFundLoan`, `listLoanNote`, `buyLoanNote`, `repay`, `settle`) and USDC `approve`,
   with per-user / global spend caps. (Order: deploy first, then allowlist that address.)
3. Set `VITE_PAYMASTER_URL`. The app routes contract writes through EIP-5792
   `wallet_sendCalls` with the paymaster when the wallet supports it, and falls back to a
   normal user-paid tx otherwise. No contract change needed.

## Going-live checklist

1. `forge install` (forge-std + OpenZeppelin v5.6.1) → `forge test` (16/16).
2. `cp .env.example .env`, fill `BASE_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `USDC_ADDRESS`, `ADMIN_ADDRESS`.
3. `forge script script/Deploy.s.sol:Deploy --rpc-url "$BASE_RPC_URL" --broadcast --verify --private-key "$DEPLOYER_PRIVATE_KEY"`.
4. Grant any extra Moodeng funding wallets: `setOriginator(wallet, true)`.
5. Set frontend env: `VITE_ENABLE_REAL_LOAN_MANAGER=true`, `VITE_LOAN_MANAGER_ADDRESS`, `VITE_USDC_ADDRESS`.
6. (Optional) Paymaster: allowlist the address + set `VITE_PAYMASTER_URL` (above).
7. (Optional) Due-date release keeper: schedule a job to call `settle(loanId)` for loans past
   due with held funds (the admin Liquidity Relay panel has a manual "Release" button meanwhile).

## Model (matches the Liquidity Relay infographic)

1. Borrower requests (e.g. 20 USDC; owes 22).
2. `createAndFundLoan` — Moodeng fronts 20 to the borrower; Loan Note minted to Moodeng.
3. `listLoanNote(loanId, principal)` — listed at **20** (not 22) and escrowed.
4. `buyLoanNote(loanId)` — lender pays Moodeng **20**; Moodeng recovers liquidity; lender owns the Note.
5. `repay(loanId, amount)` — borrower repays; USDC is **immediately forwarded** to the Note
   owner (or the listing seller while escrowed — never to the contract itself).

There is intentionally no `claimRepayments` / `getClaimable`. See
`../src/lib/web3/loanManager/REPAYMENT_MODEL.md` for the design rationale.
