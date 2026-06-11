// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

import {LoanManager} from "../src/LoanManager.sol";

/// @dev Minimal USDC-like token (6 decimals) for tests.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract LoanManagerTest is Test {
    MockUSDC internal usdc;
    LoanManager internal manager;

    address internal moodeng = makeAddr("moodeng"); // admin + originator (fronts loans)
    address internal borrower = makeAddr("borrower"); // Rosebelle
    address internal lender = makeAddr("lender");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant PRINCIPAL = 20e6; // 20 USDC
    uint256 internal constant TOTAL_OWED = 22e6; // 22 USDC
    bytes32 internal constant REQUEST_ID = keccak256("req-1");

    function setUp() public {
        usdc = new MockUSDC();
        manager = new LoanManager(address(usdc), moodeng);

        // Moodeng holds float to front loans; lender holds USDC to buy the Note;
        // borrower holds enough to repay totalOwed.
        usdc.mint(moodeng, 1_000e6);
        usdc.mint(lender, 1_000e6);
        usdc.mint(borrower, 1_000e6);
    }

    function _fund() internal returns (uint256 loanId) {
        vm.startPrank(moodeng);
        usdc.approve(address(manager), PRINCIPAL);
        loanId = manager.createAndFundLoan(borrower, PRINCIPAL, TOTAL_OWED, block.timestamp + 30 days, REQUEST_ID);
        vm.stopPrank();
    }

    function _fundAndList(uint256 price) internal returns (uint256 loanId) {
        loanId = _fund();
        vm.startPrank(moodeng);
        manager.approve(address(manager), loanId);
        manager.listLoanNote(loanId, price);
        vm.stopPrank();
    }

    // --- Origination ---------------------------------------------------------

    function test_CreateAndFundLoan_disbursesAndMintsToMoodeng() public {
        uint256 borrowerBefore = usdc.balanceOf(borrower);
        uint256 loanId = _fund();

        assertEq(usdc.balanceOf(borrower), borrowerBefore + PRINCIPAL, "borrower funded immediately");
        assertEq(manager.ownerOf(loanId), moodeng, "Note minted to Moodeng");

        LoanManager.Loan memory loan = manager.getLoan(loanId);
        assertEq(loan.principal, PRINCIPAL);
        assertEq(loan.totalOwed, TOTAL_OWED);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Active));
    }

    function test_OnlyOriginatorCanFund() public {
        vm.prank(stranger);
        vm.expectRevert();
        manager.createAndFundLoan(borrower, PRINCIPAL, TOTAL_OWED, block.timestamp + 30 days, REQUEST_ID);
    }

    function test_DuplicateRequestIdReverts() public {
        _fund();
        vm.startPrank(moodeng);
        usdc.approve(address(manager), PRINCIPAL);
        vm.expectRevert(LoanManager.RequestIdAlreadyUsed.selector);
        manager.createAndFundLoan(borrower, PRINCIPAL, TOTAL_OWED, block.timestamp + 30 days, REQUEST_ID);
        vm.stopPrank();
    }

    // --- Relay flow ----------------------------------------------------------

    function test_FullRelay_lenderPaysPrincipal_repaymentAutoRoutesToLender() public {
        // List at PRINCIPAL (20), not totalOwed — the core economic rule.
        uint256 loanId = _fundAndList(PRINCIPAL);

        uint256 moodengBefore = usdc.balanceOf(moodeng);

        // Lender buys the Note: pays Moodeng 20, receives the Note.
        vm.startPrank(lender);
        usdc.approve(address(manager), PRINCIPAL);
        manager.buyLoanNote(loanId);
        vm.stopPrank();

        assertEq(manager.ownerOf(loanId), lender, "lender owns the Note");
        assertEq(usdc.balanceOf(moodeng), moodengBefore + PRINCIPAL, "Moodeng recovered principal as liquidity");
        assertEq(manager.getRepaymentRecipient(loanId), lender, "repayments now route to lender");

        // Borrower repays 22 -> automatically sent to the lender. No claim step.
        uint256 lenderBefore = usdc.balanceOf(lender);
        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, TOTAL_OWED);
        vm.stopPrank();

        assertEq(usdc.balanceOf(lender), lenderBefore + TOTAL_OWED, "lender auto-received full repayment");
        assertEq(usdc.balanceOf(address(manager)), 0, "contract holds no funds");
        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Repaid));
    }

    function test_LenderUpsideIsTotalOwedMinusPrincipal() public {
        uint256 loanId = _fundAndList(PRINCIPAL);
        uint256 lenderStart = usdc.balanceOf(lender);

        vm.startPrank(lender);
        usdc.approve(address(manager), PRINCIPAL);
        manager.buyLoanNote(loanId);
        vm.stopPrank();

        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, TOTAL_OWED);
        vm.stopPrank();

        // Paid 20, received 22 => net +2.
        assertEq(usdc.balanceOf(lender), lenderStart + (TOTAL_OWED - PRINCIPAL), "net upside == totalOwed - principal");
    }

    // --- Escrow edge case ----------------------------------------------------

    function test_RepayWhileListed_goesToSeller_notContract() public {
        // Borrower repays BEFORE any lender buys: Note is escrowed (ownerOf == contract),
        // so repayment must go to the listing seller (Moodeng), never to address(this).
        uint256 loanId = _fundAndList(PRINCIPAL);
        assertEq(manager.ownerOf(loanId), address(manager), "Note escrowed in contract while listed");
        assertEq(manager.getRepaymentRecipient(loanId), moodeng, "recipient is the listing seller");

        uint256 moodengBefore = usdc.balanceOf(moodeng);
        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, TOTAL_OWED);
        vm.stopPrank();

        assertEq(usdc.balanceOf(moodeng), moodengBefore + TOTAL_OWED, "seller received repayment");
        assertEq(usdc.balanceOf(address(manager)), 0, "contract never retains funds");
        // Fully repaid while listed: Note returned from escrow to seller and loan Repaid.
        assertEq(manager.ownerOf(loanId), moodeng, "escrowed Note returned to seller on repay");
        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Repaid));
    }

    function test_PartialIsHeldThenReleasedOnPayoff() public {
        uint256 loanId = _fund(); // not listed -> recipient is owner (Moodeng)
        uint256 moodengBefore = usdc.balanceOf(moodeng);

        // First partial is HELD in the contract, not forwarded.
        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, 10e6);
        vm.stopPrank();

        assertEq(manager.heldRepayments(loanId), 10e6, "partial held in contract");
        assertEq(usdc.balanceOf(moodeng), moodengBefore, "nothing released yet");
        assertEq(usdc.balanceOf(address(manager)), 10e6, "contract escrows the partial");

        // Final payment completes the loan and releases everything.
        vm.prank(borrower);
        manager.repay(loanId, 12e6);

        assertEq(manager.heldRepayments(loanId), 0, "held cleared on payoff");
        assertEq(usdc.balanceOf(moodeng), moodengBefore + TOTAL_OWED, "released on full payoff");
        assertEq(usdc.balanceOf(address(manager)), 0, "contract holds no funds after release");
        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Repaid));
    }

    function test_SettleReleasesHeldOnDueDate() public {
        uint256 loanId = _fund(); // recipient = Moodeng (owner)
        uint256 moodengBefore = usdc.balanceOf(moodeng);

        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, 10e6); // partial, held
        vm.stopPrank();

        // Cannot settle before the due date.
        vm.expectRevert(LoanManager.NotYetDue.selector);
        manager.settle(loanId);

        // On/after the due date, anyone can release whatever is held.
        vm.warp(block.timestamp + 31 days);
        manager.settle(loanId); // permissionless

        assertEq(manager.heldRepayments(loanId), 0, "held released on due date");
        assertEq(usdc.balanceOf(moodeng), moodengBefore + 10e6, "recipient got the held partial");
        // Loan stays Active (still owes the remainder) until repaid or defaulted.
        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Active));
    }

    function test_SettleWithNothingHeldReverts() public {
        uint256 loanId = _fund();
        vm.warp(block.timestamp + 31 days);
        vm.expectRevert(LoanManager.NothingToRelease.selector);
        manager.settle(loanId);
    }

    function test_MarkDefaulted_releasesHeldPartialToOwner() public {
        uint256 loanId = _fundAndList(PRINCIPAL);
        // Lender buys, then borrower only partially repays before default.
        vm.startPrank(lender);
        usdc.approve(address(manager), PRINCIPAL);
        manager.buyLoanNote(loanId);
        vm.stopPrank();

        uint256 lenderBefore = usdc.balanceOf(lender);
        vm.startPrank(borrower);
        usdc.approve(address(manager), 10e6);
        manager.repay(loanId, 10e6);
        vm.stopPrank();

        vm.warp(block.timestamp + 31 days);
        vm.prank(moodeng);
        manager.markDefaulted(loanId);

        assertEq(manager.heldRepayments(loanId), 0, "held released on default");
        assertEq(usdc.balanceOf(lender), lenderBefore + 10e6, "lender keeps what was paid");
        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Defaulted));
    }

    // --- Guards --------------------------------------------------------------

    function test_BuyerIsSellerReverts() public {
        uint256 loanId = _fundAndList(PRINCIPAL);
        vm.startPrank(moodeng);
        usdc.approve(address(manager), PRINCIPAL);
        vm.expectRevert(LoanManager.BuyerIsSeller.selector);
        manager.buyLoanNote(loanId);
        vm.stopPrank();
    }

    function test_OnlyBorrowerCanRepay() public {
        uint256 loanId = _fund();
        vm.startPrank(stranger);
        usdc.approve(address(manager), TOTAL_OWED);
        vm.expectRevert(LoanManager.NotBorrower.selector);
        manager.repay(loanId, TOTAL_OWED);
        vm.stopPrank();
    }

    function test_OverRepaymentReverts() public {
        uint256 loanId = _fund();
        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED + 1);
        vm.expectRevert(LoanManager.OverRepayment.selector);
        manager.repay(loanId, TOTAL_OWED + 1);
        vm.stopPrank();
    }

    function test_TransferBlockedWhenNotActive() public {
        uint256 loanId = _fund();
        vm.startPrank(borrower);
        usdc.approve(address(manager), TOTAL_OWED);
        manager.repay(loanId, TOTAL_OWED); // -> Repaid
        vm.stopPrank();

        vm.prank(moodeng);
        vm.expectRevert(LoanManager.TransferNotAllowed.selector);
        manager.transferFrom(moodeng, lender, loanId);
    }

    function test_MarkDefaulted_returnsEscrowAndBlocksAfter() public {
        uint256 loanId = _fundAndList(PRINCIPAL);
        vm.warp(block.timestamp + 31 days);

        vm.prank(moodeng);
        manager.markDefaulted(loanId);

        assertEq(uint8(manager.getLoan(loanId).status), uint8(LoanManager.LoanStatus.Defaulted));
        assertEq(manager.ownerOf(loanId), moodeng, "escrowed Note returned to seller on default");
    }

    function test_MarkDefaulted_onlyAdmin() public {
        uint256 loanId = _fund();
        vm.warp(block.timestamp + 31 days);
        vm.prank(stranger);
        vm.expectRevert();
        manager.markDefaulted(loanId);
    }
}
