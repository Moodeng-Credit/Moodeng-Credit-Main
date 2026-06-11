// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.6.0
pragma solidity ^0.8.27;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Holder} from "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title Moodeng Credit - LoanManager (Liquidity Relay)
 * @notice Originates USDC loans represented by transferable ERC721 "Loan Note" NFTs and
 *         relays liquidity: Moodeng fronts a borrower first, mints the Loan Note to itself,
 *         lists it, and a lender later buys the Note (refilling Moodeng's capital). The
 *         borrower repays this contract and repayments are AUTOMATICALLY forwarded to the
 *         current Note owner — there is no claim step and no claimable balances.
 *
 * @dev Repayment routing (the key correction vs. a claimable design):
 *      In {repay}, the pulled USDC is immediately forwarded to the repayment recipient:
 *        - if the Note is actively listed (escrowed here) -> the listing seller, because
 *          while listed `ownerOf` is THIS contract and funds must never be sent to it;
 *        - otherwise -> `ownerOf(loanId)` (Moodeng before sale, the lender after).
 *
 *      Roles:
 *        - DEFAULT_ADMIN_ROLE: manages roles.
 *        - ADMIN_ROLE: mark defaulted, rescue non-USDC tokens.
 *        - ORIGINATOR_ROLE: originate/fund loans (Moodeng / internal funding wallet).
 *
 *      Transfer restriction: Loan Notes are transferable only while the loan is Active
 *      (mint, list-into-escrow, buy, cancel, escrow-return all happen while Active).
 */
contract LoanManager is ERC721, ERC721Holder, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------
    bytes32 public constant ORIGINATOR_ROLE = keccak256("ORIGINATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------
    enum LoanStatus {
        Active,
        Repaid,
        Defaulted
    }

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 totalOwed;
        uint256 amountRepaid;
        uint256 dueDate;
        uint256 createdAt;
        bytes32 requestId;
        LoanStatus status;
    }

    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    // -------------------------------------------------------------------------
    // Storage
    // -------------------------------------------------------------------------
    IERC20 public immutable usdc;
    uint256 private _nextLoanId = 1;

    mapping(uint256 loanId => Loan) private _loans;
    mapping(bytes32 requestId => bool) public requestIdUsed;
    mapping(uint256 loanId => Listing) public listings;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 principal,
        uint256 totalOwed,
        uint256 dueDate,
        bytes32 indexed requestId
    );
    event LoanFunded(uint256 indexed loanId, address indexed borrower, uint256 principal);
    event LoanNoteListed(uint256 indexed loanId, address indexed seller, uint256 price);
    event LoanNoteSold(uint256 indexed loanId, address indexed seller, address indexed buyer, uint256 price);
    event ListingCancelled(uint256 indexed loanId, address indexed seller);
    event RepaymentMade(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 totalRepaid);
    /// @notice Emitted when a repayment is automatically forwarded to the Note owner / listing seller.
    event RepaymentForwarded(uint256 indexed loanId, address indexed recipient, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower);
    /// @notice Emitted when a repayment is made at or after the due date.
    event LateRepayment(uint256 indexed loanId, uint256 amount, uint256 dueDate, uint256 paidAt);

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------
    error ZeroAddress();
    error InvalidAmount();
    error InvalidLoan();
    error InvalidTerms();
    error RequestIdAlreadyUsed();
    error NotBorrower();
    error NotActive();
    error OverRepayment();
    error NotTokenOwner();
    error ListingNotActive();
    error AlreadyListed();
    error PriceMustBePositive();
    error BuyerIsSeller();
    error NotListingSeller();
    error TransferNotAllowed();
    error LoanNotOverdue();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------
    /**
     * @param usdc_ USDC token address used for funding, repayment, and settlement.
     * @param admin Receives DEFAULT_ADMIN_ROLE, ADMIN_ROLE, and ORIGINATOR_ROLE.
     */
    constructor(address usdc_, address admin) ERC721("Moodeng Loan Note", "MDLN") {
        if (usdc_ == address(0) || admin == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(ORIGINATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Origination
    // -------------------------------------------------------------------------
    /**
     * @notice Moodeng fronts the borrower: pulls `principal` USDC from the originator,
     *         disburses it to the borrower, and mints the Loan Note to the originator.
     * @return loanId The new loan id (also the ERC721 tokenId).
     */
    function createAndFundLoan(
        address borrower,
        uint256 principal,
        uint256 totalOwed,
        uint256 dueDate,
        bytes32 requestId
    ) external nonReentrant onlyRole(ORIGINATOR_ROLE) returns (uint256 loanId) {
        if (borrower == address(0)) revert ZeroAddress();
        if (requestId == bytes32(0)) revert InvalidTerms();
        if (requestIdUsed[requestId]) revert RequestIdAlreadyUsed();
        if (principal == 0) revert InvalidTerms();
        if (totalOwed < principal) revert InvalidTerms();
        if (dueDate <= block.timestamp) revert InvalidTerms();

        requestIdUsed[requestId] = true;

        loanId = _nextLoanId++;
        _loans[loanId] = Loan({
            borrower: borrower,
            principal: principal,
            totalOwed: totalOwed,
            amountRepaid: 0,
            dueDate: dueDate,
            createdAt: block.timestamp,
            requestId: requestId,
            status: LoanStatus.Active
        });

        emit LoanCreated(loanId, borrower, principal, totalOwed, dueDate, requestId);

        usdc.safeTransferFrom(msg.sender, address(this), principal);
        usdc.safeTransfer(borrower, principal);
        emit LoanFunded(loanId, borrower, principal);

        _safeMint(msg.sender, loanId);
    }

    // -------------------------------------------------------------------------
    // Marketplace (escrow) — the relay
    // -------------------------------------------------------------------------
    /**
     * @notice List a Loan Note for sale and move it into escrow. For the Liquidity Relay,
     *         Moodeng lists at `price == principal` so a lender refills exactly the capital
     *         that was fronted (the lender's upside is then `totalOwed - principal`).
     * @dev Caller must approve this contract for the tokenId (or setApprovalForAll) first.
     */
    function listLoanNote(uint256 loanId, uint256 price) external nonReentrant {
        if (price == 0) revert PriceMustBePositive();
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
        if (loan.status != LoanStatus.Active) revert NotActive();
        if (ownerOf(loanId) != msg.sender) revert NotTokenOwner();
        if (listings[loanId].active) revert AlreadyListed();

        listings[loanId] = Listing({seller: msg.sender, price: price, active: true});
        safeTransferFrom(msg.sender, address(this), loanId); // escrow
        emit LoanNoteListed(loanId, msg.sender, price);
    }

    /// @notice Cancel an active listing and return the Note from escrow to the seller.
    function cancelListing(uint256 loanId) external nonReentrant {
        Listing storage lst = listings[loanId];
        if (!lst.active) revert ListingNotActive();
        if (lst.seller != msg.sender) revert NotListingSeller();

        lst.active = false;
        _safeTransfer(address(this), msg.sender, loanId, "");
        emit ListingCancelled(loanId, msg.sender);
    }

    /**
     * @notice Lender buys the listed Loan Note: pays the seller (Moodeng) `price` USDC and
     *         receives the Note. From now on, repayments auto-route to the lender.
     * @dev Buyer must approve this contract to spend at least `price` USDC.
     */
    function buyLoanNote(uint256 loanId) external nonReentrant {
        Listing storage lst = listings[loanId];
        if (!lst.active) revert ListingNotActive();

        Loan storage loan = _loans[loanId];
        if (loan.status != LoanStatus.Active) revert NotActive();

        address seller = lst.seller;
        uint256 price = lst.price;
        if (msg.sender == seller) revert BuyerIsSeller();

        lst.active = false; // effects before interactions

        usdc.safeTransferFrom(msg.sender, address(this), price);
        usdc.safeTransfer(seller, price);
        _safeTransfer(address(this), msg.sender, loanId, "");

        emit LoanNoteSold(loanId, seller, msg.sender, price);
    }

    // -------------------------------------------------------------------------
    // Repayment — automatic forward (no claim)
    // -------------------------------------------------------------------------
    /**
     * @notice Borrower repays. The amount is pulled from the borrower and IMMEDIATELY
     *         forwarded to the repayment recipient — listing seller if escrowed/listed,
     *         otherwise the current Note owner. No claimable balances, no claim step.
     */
    function repay(uint256 loanId, uint256 amount) external nonReentrant {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.status != LoanStatus.Active) revert NotActive();
        if (amount == 0) revert InvalidAmount();

        uint256 remaining = loan.totalOwed - loan.amountRepaid;
        if (amount > remaining) revert OverRepayment();

        address recipient = _repaymentRecipient(loanId);

        // Pull from borrower, then immediately forward to the recipient.
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdc.safeTransfer(recipient, amount);

        loan.amountRepaid += amount;
        emit RepaymentMade(loanId, msg.sender, amount, loan.amountRepaid);
        emit RepaymentForwarded(loanId, recipient, amount);

        if (block.timestamp >= loan.dueDate) {
            emit LateRepayment(loanId, amount, loan.dueDate, block.timestamp);
        }

        if (loan.amountRepaid == loan.totalOwed) {
            // Return any escrowed Note to the seller before the loan leaves Active
            // (transfers are blocked once not Active).
            Listing storage lst = listings[loanId];
            if (lst.active) {
                lst.active = false;
                _safeTransfer(address(this), lst.seller, loanId, "");
            }
            loan.status = LoanStatus.Repaid;
            emit LoanRepaid(loanId, loan.borrower);
        }
    }

    // -------------------------------------------------------------------------
    // Defaulting
    // -------------------------------------------------------------------------
    /// @notice Mark an overdue, still-Active loan as Defaulted; returns any escrowed Note to the seller.
    function markDefaulted(uint256 loanId) external nonReentrant onlyRole(ADMIN_ROLE) {
        Loan storage loan = _loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
        if (loan.status != LoanStatus.Active) revert NotActive();
        if (block.timestamp <= loan.dueDate) revert LoanNotOverdue();

        Listing storage lst = listings[loanId];
        if (lst.active) {
            lst.active = false;
            _safeTransfer(address(this), lst.seller, loanId, "");
        }

        loan.status = LoanStatus.Defaulted;
        emit LoanDefaulted(loanId, loan.borrower);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------
    function getLoan(uint256 loanId) external view returns (Loan memory) {
        Loan memory loan = _loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
        return loan;
    }

    function getRemainingOwed(uint256 loanId) external view returns (uint256) {
        Loan memory loan = _loans[loanId];
        if (loan.borrower == address(0)) revert InvalidLoan();
        return loan.totalOwed - loan.amountRepaid;
    }

    /// @notice The wallet repayments are automatically sent to (listing seller if listed, else owner).
    function getRepaymentRecipient(uint256 loanId) external view returns (address) {
        if (_loans[loanId].borrower == address(0)) revert InvalidLoan();
        return _repaymentRecipient(loanId);
    }

    function nextLoanId() external view returns (uint256) {
        return _nextLoanId;
    }

    function _repaymentRecipient(uint256 loanId) internal view returns (address) {
        Listing storage lst = listings[loanId];
        // While listed, the Note is escrowed here (ownerOf == address(this)); never send to self.
        if (lst.active) return lst.seller;
        return ownerOf(loanId);
    }

    // -------------------------------------------------------------------------
    // ERC721 transfer restriction
    // -------------------------------------------------------------------------
    /// @dev Block Loan Note transfers unless the loan is Active. Mint (from==0) and burn (to==0) allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && from != to) {
            if (_loans[tokenId].status != LoanStatus.Active) revert TransferNotAllowed();
        }
        return super._update(to, tokenId, auth);
    }

    // -------------------------------------------------------------------------
    // Admin utilities
    // -------------------------------------------------------------------------
    /// @notice Grant/revoke ORIGINATOR_ROLE (e.g. additional Moodeng funding wallets).
    function setOriginator(address originator, bool enabled) external onlyRole(ADMIN_ROLE) {
        if (originator == address(0)) revert ZeroAddress();
        if (enabled) {
            _grantRole(ORIGINATOR_ROLE, originator);
        } else {
            _revokeRole(ORIGINATOR_ROLE, originator);
        }
    }

    /// @notice Rescue non-USDC tokens accidentally sent here. USDC is platform funds and cannot be rescued.
    function rescueERC20(address token, address to, uint256 amount) external nonReentrant onlyRole(ADMIN_ROLE) {
        if (token == address(usdc)) revert InvalidTerms();
        if (to == address(0)) revert ZeroAddress();
        IERC20(token).safeTransfer(to, amount);
    }

    // -------------------------------------------------------------------------
    // Interface support (ERC721 + AccessControl)
    // -------------------------------------------------------------------------
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
