import FundWalletSheet from '@/views/fund/FundWalletSheet';

// DEV-only harness to review the Fund Wallet sheet (balance box + Deposit USDC option)
// without a connected lender session. Mounted at /fund-wallet-preview in dev only.
export default function FundWalletPreview() {
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <FundWalletSheet isOpen onClose={() => {}} walletAddress="0x71c92A46A238AEeB8D4502aE43B709d7E75B9d42" />
      </div>
   );
}
