# LoanManager — Automatic Repayment Model

The lender experience is **automatic payout**, not claimable balances. There is no
`claimRepayments`, no claimable accounting, and no manual withdrawal for lenders.

## Lifecycle

1. Moodeng fronts the borrower first (`createAndFundLoan`) and **owns the Loan Note**.
2. Moodeng lists the Note (`listLoanNote`).
3. A lender buys the Note (`buyLoanNote`) — reimbursing Moodeng the principal.
4. The lender now owns the Note / repayment rights.
5. Borrower repays the contract (`repay`).
6. The contract **immediately forwards** the repayment to the Note owner's wallet.

Example: borrower receives 20 USDC, owes 22; lender pays Moodeng 20 and gets the Note;
borrower repays 22; lender automatically receives 22.

## Required contract change to `repay(uint256 loanId, uint256 amount)`

Replace the claimable-credit logic with immediate forwarding:

1. Pull `amount` USDC from the borrower (`safeTransferFrom(borrower, address(this), amount)`).
2. Resolve the recipient:
   - If `listings[loanId].active` (Note is escrowed/listed) → `listings[loanId].seller`.
   - Else → `ownerOf(loanId)`.
   - **Never** send to `address(this)`. While listed, `ownerOf` is the contract, so the
     listing seller is the correct recipient.
3. `safeTransfer(recipient, amount)` immediately.
4. `amountRepaid += amount`.
5. If `amountRepaid == totalOwed` → status `Repaid`; if a listing is still active, deactivate it.
6. If `block.timestamp > dueDate`, emit a `LateRepayment` event.
7. Deactivate the listing if the loan becomes `Repaid` or `Defaulted` while listed.

Remove from the contract: `claimRepayments`, `claimRepaymentsBatch`, `getClaimable`,
`claimableByLoanAndRecipient`, `_claimableAggregate`.

Add a view `getRepaymentRecipient(loanId)` returning the address repayments are routed to
(listing seller if listed, else owner) for UI display ("Repayment destination wallet").

The frontend service (`mockService` / `realService`) already implements this interface.
