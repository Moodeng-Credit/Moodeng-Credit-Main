import WalletBalanceCard from '@/views/account/WalletBalanceCard';

// DEV-only visual harness for the borrower wallet card. Renders the real component with mock
// data in the Account screen's mobile frame so the GCash/Atome-style design can be reviewed
// without a logged-in, wallet-locked borrower. Not routed in production.
export default function AccountWalletPreview() {
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col gap-5 px-md-4 py-md-4">
            <p className="text-md-b2 font-medium text-md-neutral-700">Instant Wallet (Openfort)</p>
            <WalletBalanceCard previewAddress="0x9a1F4c2b7e5D3a86F0c1B2e4d5A6c7B8e9F0a1B2" previewBalance={12.5} previewIsInstant />
         </div>
      </div>
   );
}
