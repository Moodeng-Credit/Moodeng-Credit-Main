# LoanManager — Hold-and-Release Repayment Model

The lender never "claims." Repayments are **held in the contract** and **released
automatically** to the Loan Note owner — on **full payoff**, or on the **due date** for
whatever has accumulated. There is no `claimRepayments`, no claimable balance, and no
manual withdrawal.

## Lifecycle

1. Moodeng fronts the borrower first (`createAndFundLoan`) and **owns the Loan Note**.
2. Moodeng lists the Note (`listLoanNote`) at **principal**.
3. A lender buys the Note (`buyLoanNote`) — reimbursing Moodeng the principal.
4. The lender now owns the Note / repayment rights.
5. Borrower repays the contract (`repay`) — funds are **held (escrowed)** in the contract.
6. Held funds are **released** to the Note owner:
   - **Full payoff** → released automatically inside the borrower's final `repay` tx.
   - **Due date** → released via `settle(loanId)` (permissionless; a keeper, the lender, or
     the admin "Release" button calls it on/after the due date).
   - **Default** → `markDefaulted` releases held partials to the lender.

Example: borrower receives 20, owes 22; lender pays Moodeng 20 and gets the Note; borrower
repays 22; on payoff the contract releases 22 to the lender (net +2). If the borrower only
pays 10 by the due date, `settle` releases that 10 to the lender.

## `repay(uint256 loanId, uint256 amount)`

1. Pull `amount` USDC from the borrower into the contract; `heldRepayments[loanId] += amount`.
2. `amountRepaid += amount`; emit `RepaymentHeld` (+ `LateRepayment` if at/after due date).
3. If `amountRepaid == totalOwed` → return any escrowed Note to the seller (while still
   Active), set `Repaid`, then `_release(loanId)`.

## `settle(uint256 loanId)` — permissionless

- Reverts `NotYetDue` before the due date, `NothingToRelease` if nothing is held.
- Otherwise releases held funds to the recipient. Does not change loan status (a partially
  paid, overdue loan stays Active until repaid or defaulted).

## Recipient resolution (`_release` / `getRepaymentRecipient`)

- Listing active (Note escrowed here) → `listings[loanId].seller` (**never** `address(this)`).
- Else → `ownerOf(loanId)` (Moodeng before sale, the lender after).

## Due-date trigger

Full payoff needs no trigger. The due-date release needs something to call `settle()` on/after
the due date. Today: a permissionless `settle()` + an admin **"Release"** button in the
Liquidity Relay panel. A backend keeper/cron (reusing the existing Supabase cron + a Moodeng
relayer wallet) can call `settle()` automatically at the due date — follow-up, no contract change.

The frontend service (`mockService` / `realService`) implements this interface
(`repay`, `settle`, `getHeld`, `getRepaymentRecipient`).
