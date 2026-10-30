import { useMemo, useState } from 'react';

import { ArrowDownLeft, ArrowUpRight, ChevronLeft, Coins, Landmark, Loader2 } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { erc20Abi } from 'viem';
import { useAccount, useReadContract } from 'wagmi';

import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from '@/config/wagmiConfig';
import { useUsdcRate } from '@/lib/useUsdcRate';
import { getBaseWalletLockStatus } from '@/lib/walletProvider';
import type { RootState } from '@/store/store';
import AnyNetworkDeposit from '@/views/repay/AnyNetworkDeposit';
import useBankPayoutAvailable from '@/views/withdraw/useBankPayoutAvailable';
import '@/views/withdraw/withdraw-theme.css';

// /money: one place to add money to the Moodeng wallet and to cash it out, styled after the
// Milestone design (white cards, heavy-italic section titles, purple pill buttons). Testers only
// while Stableyard's payouts are being tested (admins + stableyard_qr_testers).
//   Add money → crypto from any network (Stableyard deposit addresses, settles as USDC on Base).
//               "From GCash or bank" waits for Stableyard's bank on-ramp (not enabled for us yet).
//   Cash out  → /withdraw?to=bank: straight into the GCash / bank payout, which keeps the face
//               check, withdrawal record and notification of the normal withdraw page.

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif`;
const GRADIENT = 'linear-gradient(85deg, #9584ff 0%, #6b55f7 98%)';

type View = 'home' | 'add';

function SectionTitle({ children }: { children: React.ReactNode }) {
   return <p className="text-[22px] font-black italic leading-[1.2] tracking-[-0.3px] text-[var(--text-muted,#594d65)]">{children}</p>;
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
   return (
      <div className={`rounded-[8px] border-2 border-[var(--border-card,#e8e4ff)] bg-[var(--surface,#fff)] ${className}`}>{children}</div>
   );
}

export default function MoneyHub() {
   const navigate = useNavigate();
   const location = useLocation();
   const account = useAccount();
   const user = useSelector((state: RootState) => state.auth.user);
   const isPreview = location.pathname === '/money-preview';
   const allowed = useBankPayoutAvailable(isPreview);
   const [view, setView] = useState<View>('home');
   const { value: phpRate } = useUsdcRate('php');

   const walletAddress = getBaseWalletLockStatus(user).address ?? account.address ?? '';
   const { data: rawBalance } = useReadContract({
      abi: erc20Abi,
      address: BASE_USDC_ADDRESS,
      functionName: 'balanceOf',
      args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
      chainId: ALLOWED_CHAIN_ID,
      query: { enabled: Boolean(walletAddress) && !isPreview, refetchInterval: 10000, refetchOnWindowFocus: true }
   });
   const balance = useMemo(() => {
      if (isPreview) return 50;
      return typeof rawBalance === 'bigint' ? Math.floor((Number(rawBalance) / 1e6) * 100) / 100 : null;
   }, [isPreview, rawBalance]);

   const back = () => (view === 'add' ? setView('home') : navigate('/dashboard'));

   return (
      <div style={{ fontFamily: FONT }} className="withdraw-flow min-h-screen bg-[var(--app-bg,#f7f7f7)] flex justify-center">
         <div className="w-full max-w-[440px] px-[20px] pb-[40px] pt-[max(20px,env(safe-area-inset-top))] space-y-[20px]">
            <div className="relative flex items-center justify-center h-[44px]">
               <button
                  type="button"
                  onClick={back}
                  aria-label="Back"
                  className="absolute left-0 flex h-[40px] w-[40px] items-center justify-center rounded-full border border-[var(--border-card-2,#ece9f0)] bg-[var(--surface,#fff)]"
               >
                  <ChevronLeft className="h-[20px] w-[20px] text-[var(--ink,#1c053d)]" strokeWidth={2.5} />
               </button>
               <p className="text-[18px] font-bold text-[var(--ink,#1c053d)]">{view === 'add' ? 'Add money' : 'Your money'}</p>
            </div>

            {allowed === null ? (
               <div className="flex items-center justify-center gap-[8px] py-[40px] text-[14px] text-[var(--text-muted,#70617f)]">
                  <Loader2 className="h-[18px] w-[18px] animate-spin" /> Loading…
               </div>
            ) : !allowed ? (
               <Card className="p-[16px]">
                  <p className="text-[16px] font-semibold text-[var(--ink,#1c053d)]">Coming soon</p>
                  <p className="mt-[4px] text-[14px] leading-[19px] text-[var(--text-muted,#70617f)]">
                     Adding and cashing out pesos right here is being tested. For now, use Withdraw on your dashboard.
                  </p>
               </Card>
            ) : view === 'home' ? (
               <>
                  <Card className="p-[16px]">
                     <p className="text-[14px] text-[var(--text-muted,#45556c)]">In your Moodeng wallet</p>
                     <p className="mt-[6px] text-[40px] font-semibold leading-[1] tracking-[-1px] text-[#5c44f1]">
                        {balance === null ? '—' : balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        <span className="ml-[6px] text-[18px] font-medium text-[var(--text-muted,#594d65)]">USDC</span>
                     </p>
                     <p className="mt-[6px] text-[14px] text-[var(--text-faint,#c0b9c8)]">
                        {balance === null
                           ? walletAddress
                              ? 'Checking your balance…'
                              : 'Set up your Moodeng wallet first'
                           : `≈ ₱${(balance * phpRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                     </p>
                  </Card>

                  <div className="grid grid-cols-2 gap-[12px]">
                     <button
                        type="button"
                        onClick={() => setView('add')}
                        className="flex flex-col items-start gap-[10px] rounded-[16px] p-[16px] text-left text-white active:scale-[0.98]"
                        style={{ backgroundImage: GRADIENT, boxShadow: '0 6px 16px rgba(107,85,247,0.3)' }}
                     >
                        <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-white/20">
                           <ArrowDownLeft className="h-[20px] w-[20px]" strokeWidth={2.5} />
                        </span>
                        <span>
                           <span className="block text-[18px] font-bold">Add money</span>
                           <span className="block text-[13px] text-white/80">Put USDC in your wallet</span>
                        </span>
                     </button>
                     <button
                        type="button"
                        onClick={() => navigate('/withdraw?to=bank')}
                        className="flex flex-col items-start gap-[10px] rounded-[16px] border-2 border-[#e8e4ff] bg-[var(--surface,#fff)] p-[16px] text-left active:scale-[0.98]"
                     >
                        <span className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#e0dbff]">
                           <ArrowUpRight className="h-[20px] w-[20px] text-[#5640e0]" strokeWidth={2.5} />
                        </span>
                        <span>
                           <span className="block text-[18px] font-bold text-[var(--ink,#1c053d)]">Cash out</span>
                           <span className="block text-[13px] text-[var(--text-muted,#45556c)]">Pesos to GCash or bank</span>
                        </span>
                     </button>
                  </div>

                  <div className="space-y-[10px]">
                     <SectionTitle>How it works</SectionTitle>
                     <Card className="divide-y divide-[var(--divider,#ece9f0)]">
                        {[
                           ['1', 'Add money', 'Send USDC or USDT from any exchange or wallet. It lands here as USDC.'],
                           ['2', 'Use it', 'Repay loans straight from this balance.'],
                           ['3', 'Cash out', 'Pick GCash, Maya or a bank. Pesos arrive in minutes.']
                        ].map(([n, title, text]) => (
                           <div key={n} className="flex items-start gap-[12px] p-[14px]">
                              <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#e0dbff] text-[13px] font-bold text-[#5640e0]">
                                 {n}
                              </span>
                              <span>
                                 <span className="block text-[16px] font-semibold text-[var(--ink,#0f172b)]">{title}</span>
                                 <span className="block text-[14px] leading-[19px] text-[var(--text-muted,#45556c)]">{text}</span>
                              </span>
                           </div>
                        ))}
                     </Card>
                  </div>
               </>
            ) : (
               <div className="space-y-[14px]">
                  <SectionTitle>Choose how</SectionTitle>
                  <Card className="p-[16px] space-y-[12px]">
                     <div className="flex items-start gap-[12px]">
                        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#e0dbff]">
                           <Coins className="h-[20px] w-[20px] text-[#5640e0]" />
                        </span>
                        <span>
                           <span className="block text-[17px] font-semibold text-[var(--ink,#0f172b)]">From crypto</span>
                           <span className="block text-[14px] leading-[19px] text-[var(--text-muted,#45556c)]">
                              Binance, Coins.ph or any wallet. Send USDC or USDT on the network you have; it arrives as USDC.
                           </span>
                        </span>
                     </div>
                     <AnyNetworkDeposit embedded />
                  </Card>
                  <Card className="p-[16px] opacity-70">
                     <div className="flex items-start gap-[12px]">
                        <span className="flex h-[40px] w-[40px] shrink-0 items-center justify-center rounded-full bg-[#efedf1]">
                           <Landmark className="h-[20px] w-[20px] text-[#877897]" />
                        </span>
                        <span className="flex-1">
                           <span className="flex flex-wrap items-center gap-x-[8px] gap-y-[2px]">
                              <span className="text-[17px] font-semibold text-[var(--ink,#0f172b)]">From GCash or bank</span>
                              <span className="shrink-0 whitespace-nowrap rounded-[11px] bg-[#e0dbff] px-[8px] py-[1px] text-[12px] font-semibold text-[#5640e0]">
                                 Coming soon
                              </span>
                           </span>
                           <span className="block text-[14px] leading-[19px] text-[var(--text-muted,#45556c)]">
                              Pay pesos from your GCash or bank and get USDC.
                           </span>
                        </span>
                     </div>
                  </Card>
               </div>
            )}
         </div>
      </div>
   );
}
