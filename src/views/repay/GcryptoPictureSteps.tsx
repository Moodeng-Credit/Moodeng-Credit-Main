import { formatCurrency } from '@/utils/decimalHelpers';

// GCrypto (inside GCash, run by PDAX) step by step, with real screenshots. Borrowers kept
// stopping at "I have pesos in GCrypto" — pesos can't be sent, only USDC (Base) can, so the
// Buy step is the one that matters. Screenshots live in /public/repay-guides/gcrypto (wallet
// address redacted).
const STEPS = [
   { title: 'Top up pesos', text: 'Tap Top Up and add pesos from GCash.', img: '/repay-guides/gcrypto/step1-topup.webp' },
   {
      title: 'Buy USDC (Base)',
      text: 'Tap Trade → Buy → USDC (Base). Pesos can’t be sent, only USDC.',
      img: '/repay-guides/gcrypto/step2-trade.webp'
   },
   {
      title: 'Send to your Moodeng wallet',
      text: 'Open Send USDC (Base). Paste your Moodeng address, then tap MAX.',
      img: '/repay-guides/gcrypto/step3-send.webp'
   },
   {
      title: 'Check it says Base, then Send',
      text: 'It arrives in a few minutes. Then come back here and tap Pay.',
      img: '/repay-guides/gcrypto/step4-confirm.webp'
   }
] as const;

// GCrypto's buy price runs about 2% over the official rate, sending costs 0.01 USDC, and it
// won't send less than 1 USDC — so a top-up for the exact amount lands a few cents short and
// can't be fixed with a tiny second send. Suggest a small buffer up front.
const suggestedBuyAmount = (shortfall: number) => Math.ceil((shortfall + 0.01) * 1.03 * 10) / 10;

interface GcryptoPictureStepsProps {
   shortfall: number | null;
}

const GcryptoPictureSteps = ({ shortfall }: GcryptoPictureStepsProps) => (
   <div className="mt-3 space-y-3">
      {shortfall !== null && shortfall > 0 ? (
         <p className="rounded-lg bg-[#fff6d6] px-3 py-2 text-[12px] font-semibold leading-snug text-[#4a2a00] dark:bg-[#3a2e10] dark:text-[#ffe27a]">
            Buy about ${formatCurrency(suggestedBuyAmount(shortfall))} USDC. GCrypto takes a small fee, so a little extra makes sure you
            have enough.
         </p>
      ) : null}
      {STEPS.map((step, i) => (
         <div
            key={step.img}
            className="overflow-hidden rounded-xl border border-[#e9e3f8] bg-white dark:border-[#3d2a60] dark:bg-[#1a1240]"
         >
            <div className="flex items-start gap-2.5 px-3 py-2.5">
               <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-[#6c3fe0] text-[10px] font-bold text-white">
                  {i + 1}
               </span>
               <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-[#1a1240] dark:text-white">{step.title}</p>
                  <p className="text-[12px] leading-snug text-[#6b6090] dark:text-[#a095c8]">{step.text}</p>
               </div>
            </div>
            <img src={step.img} alt={step.title} loading="lazy" className="block w-full border-t border-[#e9e3f8] dark:border-[#3d2a60]" />
         </div>
      ))}
   </div>
);

export default GcryptoPictureSteps;
