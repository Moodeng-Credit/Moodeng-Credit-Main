import WalletActivity, { type ActivityRow } from '@/views/account/WalletActivity';
import WalletBalanceCard from '@/views/account/WalletBalanceCard';

const PREVIEW_ROWS: ActivityRow[] = [
   { direction: 'out', amount: 3.75, timestamp: '2026-07-23T18:00:00Z', hash: '0xccc' },
   { direction: 'out', amount: 8.75, timestamp: '2026-07-21T13:30:00Z', hash: '0xbbb' },
   { direction: 'in', amount: 25, timestamp: '2026-07-20T09:00:00Z', hash: '0xaaa' }
];

// DEV-only visual harness for the borrower wallet card. Renders the real component with mock
// data in the Account screen's mobile frame so the GCash/Atome-style design can be reviewed
// without a logged-in, wallet-locked borrower. Not routed in production.
export default function AccountWalletPreview() {
   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto flex max-w-[440px] flex-col gap-5 px-md-4 py-md-4">
            <p className="text-md-b2 font-medium text-md-neutral-700">Instant Wallet (Openfort)</p>
            <WalletBalanceCard previewAddress="0x9a1F4c2b7e5D3a86F0c1B2e4d5A6c7B8e9F0a1B2" previewBalance={12.5} previewIsInstant />
            <WalletActivity previewRows={PREVIEW_ROWS} />

            <p className="mt-4 text-md-b2 font-medium text-md-neutral-700">Empty wallet (zero state)</p>
            <WalletBalanceCard previewAddress="0x9a1F4c2b7e5D3a86F0c1B2e4d5A6c7B8e9F0a1B2" previewBalance={0} previewIsInstant />
         </div>
      </div>
   );
}
