import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Copy, Wallet, ArrowUpRight,
  AlertTriangle, Info, ShieldAlert, Check, X, ArrowRight, ArrowDownLeft,
  PlayCircle, Download, CreditCard, MessageCircle, Landmark, ClipboardCheck,
  Lock, Loader2, Clock,
} from "lucide-react";
import { useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { erc20Abi } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt } from "wagmi";

import { useGeoCheck } from "@/hooks/useGeoCheck";
import { useLoanData } from "@/hooks/useLoanData";
import useWallet from "@/hooks/useWallet";
import { ALLOWED_CHAIN_ID, BASE_USDC_ADDRESS } from "@/config/wagmiConfig";
import { getBaseWalletLockStatus } from "@/lib/walletProvider";
import type { RootState } from "@/store/store";
import { parseDateSafely } from "@/utils/dateFormatters";

import "./withdraw-theme.css";

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif`;

type Screen = "celebrate" | "withdraw";
type Provider = "moneybees" | "binance" | "coinsph" | "gcash" | "pdax";

// Real data + actions provided by the page root and consumed by the ported
// prototype components. `available` replaces the prototype's hardcoded
// LOAN_USDC; `send` replaces the simulated transfer with a real on-chain USDC
// Transfer; `repayUsdc`/`dueDate` come from the borrower's funded loan.
type WithdrawData = {
  available: number;
  repayUsdc: number | null;
  dueDate: string | null;
  walletAddress: string;
  isPreview: boolean;
  // Returns the on-chain tx hash (or null if the send failed / was rejected).
  send: (toAddress: string, amount: string) => Promise<string | null>;
};
const WithdrawDataContext = createContext<WithdrawData | null>(null);
function useWithdrawData(): WithdrawData {
  const ctx = useContext(WithdrawDataContext);
  if (!ctx) throw new Error("useWithdrawData must be used within Withdraw");
  return ctx;
}

function isValidAddress(a: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(a.trim());
}

/* ─── primitives ─────────────────────────────────────────────────── */
function Card({ children, className = "", radius = "16px" }: { children: React.ReactNode; className?: string; radius?: string }) {
  return (
    <div className={`bg-[var(--surface)] relative ${className}`}
      style={{ boxShadow: "var(--card-shadow)", borderRadius: radius }}>
      <div aria-hidden className="absolute inset-0 border border-[var(--border-card-2)] pointer-events-none" style={{ borderRadius: radius }} />
      {children}
    </div>
  );
}

function PrimaryBtn({ children, disabled, onClick, className = "" }: {
  children: React.ReactNode; disabled?: boolean; onClick?: () => void; className?: string;
}) {
  return (
    <button disabled={disabled} onClick={onClick}
      className={`w-full rounded-[16px] px-[20px] py-[16px] flex items-center justify-center gap-[8px] text-[16px] font-semibold leading-[24px] tracking-[-0.32px] text-white transition-all active:scale-[0.98] ${
        disabled ? "bg-[var(--disabled)] cursor-not-allowed" : "bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
      } ${className}`}>
      {children}
    </button>
  );
}

function SecondaryBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full rounded-[16px] px-[20px] py-[14px] flex items-center justify-center gap-[8px] text-[15px] font-semibold leading-[22px] tracking-[-0.3px] text-[var(--primary)] border border-[var(--border-2)] bg-[var(--surface-1)] hover:bg-[var(--hover-1)] transition-all active:scale-[0.98]">
      {children}
    </button>
  );
}

/* Live USDC → fiat rate from CoinGecko's free endpoint. Falls back to an approximate
   fixed rate if the request is blocked/rate-limited, so a payout estimate always shows. */
const FALLBACK_RATE: Record<"php" | "usd", number> = { php: 58.5, usd: 1 };
function useUsdcRate(currency: "php" | "usd") {
  const [rate, setRate] = useState<{ value: number; live: boolean }>({ value: FALLBACK_RATE[currency], live: false });
  useEffect(() => {
    let cancelled = false;
    setRate({ value: FALLBACK_RATE[currency], live: false });
    fetch(`https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=${currency}`)
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(d => {
        const v = d?.["usd-coin"]?.[currency];
        if (!cancelled && typeof v === "number") setRate({ value: v, live: true });
      })
      .catch(() => { /* keep the fallback rate */ });
    return () => { cancelled = true; };
  }, [currency]);
  return rate;
}

function ReceiveEstimate({ currency, usdcAmount }: { currency: string; usdcAmount: number }) {
  const cur = currency.toLowerCase() === "php" ? "php" : "usd";
  const symbol = cur === "php" ? "₱" : "$";
  const { value, live } = useUsdcRate(cur as "php" | "usd");
  const val = usdcAmount * value;
  return (
    <>
      <p className="text-[19px] font-semibold text-[var(--ink)] tracking-[-0.4px] mt-[4px]">≈ {symbol}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      <p className="text-[11px] text-[var(--text-faint)] leading-[15px] mt-[2px]">1 USDC ≈ {symbol}{value.toLocaleString(undefined, { maximumFractionDigits: 0 })} · {currency}{live ? "" : " (est.)"}</p>
    </>
  );
}

/* ─── Brand / flag SVGs ──────────────────────────────────────────── */
function BinanceMarkGold({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#F3BA2F" d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z" />
    </svg>
  );
}

function MoneybeesMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mbGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFD23F" />
          <stop offset="1" stopColor="#F5A300" />
        </linearGradient>
      </defs>
      <path d="M24 3 L42.18 13.5 L42.18 34.5 L24 45 L5.82 34.5 L5.82 13.5 Z" fill="url(#mbGold)" stroke="#0A0A0A" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 12.5 L33.7 18.1 L24 23.7 L14.3 18.1 Z" fill="#0A0A0A" />
      <path d="M14.3 18.1 L24 23.7 L24 37.2 L14.3 31.6 Z" fill="#FFFFFF" />
      <path d="M33.7 18.1 L33.7 31.6 L24 37.2 L24 23.7 Z" fill="#FFFFFF" />
      <path d="M18 24 L24 27.5 L30 24 L30 27.1 L24 30.6 L18 27.1 Z" fill="#0A0A0A" />
      <path d="M18 28.6 L24 32.1 L30 28.6 L30 31.7 L24 35.2 L18 31.7 Z" fill="#0A0A0A" />
    </svg>
  );
}

function GCashMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M64 22 A30 30 0 1 0 64 78" fill="none" stroke="#1C84FF" strokeWidth="11" strokeLinecap="round" />
      <path d="M56 35 A18 18 0 1 0 56 65 L56 50 L43 50" fill="none" stroke="#0A2FA8" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M76 39 A16 16 0 0 1 76 61" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M85 31 A25 25 0 0 1 85 69" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

function PdaxMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#0E1A2B" />
      <g fill="#19D86F">
        <path d="M34 30 H49 L37 70 H22 Z" />
        <path d="M59 30 H74 L62 70 H47 Z" />
      </g>
    </svg>
  );
}

function UsdcMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#2775CA" />
      <svg x="5" y="4" width="14" height="16" viewBox="0 0 14 16">
        <path fill="#FFFFFF" fillRule="evenodd" d="M5.5 13.47c0 .19-.15.29-.33.24a5.995 5.995 0 0 1 0-11.42c.18-.06.33.05.33.24v.46c0 .13-.1.27-.22.31C3.37 4 2 5.84 2 7.99s1.37 3.99 3.28 4.69c.12.04.22.19.22.31v.47Z" />
        <path fill="#FFFFFF" fillRule="evenodd" d="M7.5 11.75c0 .14-.11.25-.25.25h-.5c-.14 0-.25-.11-.25-.25v-.79c-1.09-.15-1.62-.76-1.77-1.59c-.03-.14.09-.27.23-.27h.57c.12 0 .22.08.24.2c.11.5.39.87 1.27.87c.65 0 1.1-.36 1.1-.9s-.27-.74-1.22-.9c-1.4-.19-2.06-.61-2.06-1.71c0-.85.64-1.5 1.63-1.65v-.77c0-.14.11-.25.25-.25h.5c.14 0 .25.11.25.25v.8c.81.14 1.32.6 1.48 1.36c.03.14-.08.28-.23.28h-.53c-.11 0-.21-.08-.24-.18c-.14-.48-.49-.69-1.08-.69c-.66 0-1 .32-1 .77c0 .47.19.71 1.21.86c1.37.19 2.08.58 2.08 1.75c0 .89-.66 1.61-1.69 1.77v.79Z" />
        <path fill="#FFFFFF" fillRule="evenodd" d="M8.83 13.71c-.18.06-.33-.05-.33-.24v-.46c0-.14.08-.27.22-.31C10.63 12 12 10.16 12 8.01s-1.37-3.99-3.28-4.69a.36.36 0 0 1-.22-.31v-.46c0-.19.15-.3.33-.24C11.25 3.08 13 5.35 13 8.02s-1.75 4.93-4.17 5.71Z" />
      </svg>
    </svg>
  );
}

function BaseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="96" fill="#0957FF" />
      <circle cx="256" cy="256" r="180" fill="#FFFFFF" />
      <rect x="198" y="198" width="116" height="116" rx="12" fill="#0957FF" />
    </svg>
  );
}

/* ── App-icon tiles ── */
function BinanceAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[#181A20] flex items-center justify-center ${className}`}>
      <BinanceMarkGold className="w-[52%] h-[52%]" />
    </div>
  );
}
function MoneybeesAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <MoneybeesMark className="w-full h-full" />
    </div>
  );
}
function GCashAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-white flex items-center justify-center ${className}`}>
      <GCashMark className="w-[85%] h-[85%]" />
    </div>
  );
}
function PdaxAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[#0B1426] flex items-center justify-center overflow-hidden ${className}`}>
      <PdaxMark className="w-[80%] h-[80%]" />
    </div>
  );
}
function CoinsPhAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] overflow-hidden flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="50" cy="50" r="50" fill="#F0A500" />
        <circle cx="50" cy="50" r="41" fill="#3B6CC8" />
        <path d="M62 36 A18 18 0 1 0 62 64" fill="none" stroke="#FFFFFF" strokeWidth="11" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function AmountCard({ receive, payout }: { receive: React.ReactNode; payout: React.ReactNode }) {
  const { available: LOAN_USDC } = useWithdrawData();
  return (
    <Card className="overflow-hidden">
      <div className="flex">
        <div className="flex-1 px-[14px] py-[12px]">
          <p className="text-[12px] text-[var(--text-muted)]">You're sending</p>
          <div className="flex items-center gap-[7px] mt-[4px]">
            <span className="text-[19px] font-semibold text-[var(--ink)] tracking-[-0.4px]">{LOAN_USDC} USDC</span>
            <UsdcMark className="w-[19px] h-[19px]" />
          </div>
        </div>
        <div className="w-px bg-[var(--divider-2)] my-[12px]" />
        <div className="flex-1 px-[14px] py-[12px]">
          <p className="text-[12px] text-[var(--text-muted)]">You'll receive</p>
          {receive}
        </div>
      </div>
      <div className="border-t border-[var(--divider-2)] px-[14px] py-[9px] flex items-center justify-center gap-[7px]">
        <Landmark className="w-[14px] h-[14px] text-[var(--accent)]" />
        <p className="text-[12px] text-[var(--text-2)]">{payout}</p>
      </div>
    </Card>
  );
}

function HowThisWorks({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[14px] bg-[var(--surface-2)] border border-[var(--border-1)] overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-[10px] p-[14px] text-left">
        <Info className="w-[18px] h-[18px] text-[var(--accent)] shrink-0" />
        <p className="flex-1 text-[14px] font-semibold text-[var(--accent-text)]">How this works</p>
        <ChevronRight className={`w-[18px] h-[18px] text-[var(--accent)] shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <p className="text-[13px] text-[var(--text-2)] leading-[19px] px-[14px] pb-[14px] -mt-[3px]">{children}</p>}
    </div>
  );
}

type Guide = { title: string; steps: string[]; video?: string; link?: { label: string; url: string } };
type FlowStep = { icon?: React.ReactNode; title: string; desc: string; guide?: Guide; extra?: React.ReactNode };

function HowToButton({ guide }: { guide: Guide }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="inline-flex items-center gap-[5px] mt-[6px] text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--primary)] transition-colors">
        <PlayCircle className="w-[14px] h-[14px]" /> Show me how
      </button>
      {open && <HowToModal guide={guide} onClose={() => setOpen(false)} />}
    </>
  );
}

function HowToModal({ guide, onClose }: { guide: Guide; onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-[60]" onClick={onClose}>
      <div className="w-full bg-[var(--surface)] rounded-t-[24px] p-[20px] space-y-[16px] pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ boxShadow: "var(--sheet-shadow)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-[12px]">
          <p className="text-[18px] font-semibold leading-[1.25] tracking-[-0.4px] text-[var(--ink)] pr-[8px]">{guide.title}</p>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity shrink-0 mt-[2px]">
            <X className="w-5 h-5 text-[var(--ink)]" />
          </button>
        </div>
        {guide.video ? (
          <div className="rounded-[16px] overflow-hidden aspect-video bg-black">
            <iframe className="w-full h-full" src={`https://www.youtube-nocookie.com/embed/${guide.video}`}
              title={guide.title} loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen />
          </div>
        ) : (
          <div className="rounded-[16px] bg-[var(--surface-1)] border border-[var(--border-3)] aspect-video flex flex-col items-center justify-center gap-[8px]">
            <div className="w-[50px] h-[50px] rounded-full bg-white/90 flex items-center justify-center" style={{ boxShadow: "0px 4px 12px rgba(96,16,210,0.15)" }}>
              <PlayCircle className="w-[26px] h-[26px] text-[var(--primary)]" />
            </div>
            <p className="text-[12px] font-semibold text-[var(--accent)] tracking-[-0.24px]">Video guide coming soon</p>
          </div>
        )}
        <div className="space-y-[12px]">
          {guide.steps.map((s, i) => (
            <div key={i} className="flex gap-[10px]">
              <div className="w-[22px] h-[22px] rounded-full bg-[var(--surface-1)] text-[var(--accent)] text-[12px] font-semibold flex items-center justify-center shrink-0 mt-[1px]">{i + 1}</div>
              <p className="text-[14px] leading-[21px] tracking-[-0.28px] text-[var(--ink-2)]">{s}</p>
            </div>
          ))}
        </div>
        {guide.link && (
          <a href={guide.link.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-[6px] w-full rounded-[14px] py-[12px] text-[14px] font-semibold text-[var(--primary)] bg-[var(--surface-1)] hover:bg-[var(--hover-1)] transition-colors">
            {guide.link.label} <ArrowRight className="w-[15px] h-[15px]" />
          </a>
        )}
        <PrimaryBtn onClick={onClose}>Got it</PrimaryBtn>
      </div>
    </div>
  );
}

function StepList({ steps, bare = false }: { steps: FlowStep[]; bare?: boolean }) {
  const rows = steps.map((s, i) => (
    <div key={i} className="flex gap-[13px]">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-[24px] h-[24px] rounded-full bg-[var(--surface-1)] border border-[var(--border-2)] text-[var(--primary)] text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</div>
        {i < steps.length - 1 && <div className="w-[2px] flex-1 bg-[var(--divider-2)] min-h-[14px] my-[5px]" />}
      </div>
      <div className={`flex-1 min-w-0 ${i < steps.length - 1 ? "pb-[16px]" : ""}`}>
        <div className="flex items-center gap-[7px] pt-[2px]">
          <p className="text-[15px] text-[var(--ink)] leading-[20px]" style={{ fontWeight: 590 }}>{s.title}</p>
        </div>
        <p className="text-[13px] text-[var(--text-muted)] leading-[18px] mt-[3px]">{s.desc}</p>
        {s.extra}
        {s.guide && <HowToButton guide={s.guide} />}
      </div>
    </div>
  ));
  return bare ? <>{rows}</> : <Card className="p-[18px]">{rows}</Card>;
}

function TimelineStep({ n, title, last, done, children }: {
  n: number; title: React.ReactNode; last?: boolean; done?: boolean; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-[14px]">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-[26px] h-[26px] rounded-full text-[12px] font-bold flex items-center justify-center z-10 transition-colors border ${
          done ? "bg-[var(--green)] border-[var(--green)] text-white" : "bg-[var(--surface-1)] border-[var(--border-2)] text-[var(--primary)]"
        }`}>
          {done ? <Check className="w-[13px] h-[13px]" strokeWidth={3} /> : n}
        </div>
        {!last && <div className="w-[2px] flex-1 bg-[var(--border-2)] min-h-[20px]" />}
      </div>
      <div className={`flex-1 min-w-0 ${last ? "pb-[2px]" : "pb-[20px]"}`}>
        <p className="text-[15px] font-semibold text-[var(--ink)] leading-[1.3] tracking-[-0.3px] pt-[4px]">{title}</p>
        {children && <div className="mt-[10px]">{children}</div>}
      </div>
    </div>
  );
}

function BaseOnlyNotice({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[var(--surface-2)] border border-[var(--border-1)] p-[16px] flex items-start gap-[12px] ${className}`}>
      <ShieldAlert className="w-[20px] h-[20px] text-[var(--accent)] shrink-0 mt-[1px]" />
      <p className="text-[13px] leading-[21px] text-[var(--text-2)]">
        Send only <UsdcMark className="inline-block w-[15px] h-[15px] align-[-3px] mx-[1px]" /> <span className="font-semibold text-[var(--ink)]">USDC</span> on <BaseMark className="inline-block w-[14px] h-[14px] align-[-3px] mx-[1px]" /> <span className="font-semibold text-[var(--ink)]">Base</span>. A different coin or network can't be recovered.
      </p>
    </div>
  );
}

/* ─── Region detection ───────────────────────────────────────────── */
type Region = "ph" | "other" | "loading";
function useRegion(): Region {
  const [region, setRegion] = useState<Region>("loading");
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then(r => r.json())
      .then(d => setRegion(d.country_code === "PH" ? "ph" : "other"))
      .catch(() => setRegion("ph"));
  }, []);
  return region;
}

/* ─── SCREEN 1: Withdraw your USDC ────────────────────────────────── */
type PickerRowProps = {
  id: Provider;
  selected: Provider;
  onSelect: (id: Provider) => void;
  icon: React.ReactNode;
  name: string;
  line1: string;
  line2: string;
  recommended?: boolean;
  warn?: boolean;
};

function PickerRow({ id, selected, onSelect, icon, name, line1, line2, recommended, warn }: PickerRowProps) {
  const active = selected === id;
  return (
    <button onClick={() => onSelect(id)} className="relative w-full text-left outline-none">
      {recommended && (
        <div className="absolute -top-[9px] left-[14px] z-10 bg-[var(--primary)] rounded-full px-[7px] py-[2px] shadow-sm flex items-center justify-center">
          <span className="text-[8px] font-bold text-white uppercase tracking-[0.4px] leading-none">Recommended</span>
        </div>
      )}
      {warn && !recommended && (
        <div className="absolute -top-[9px] left-[14px] z-10 bg-[var(--amber-icon)] rounded-full px-[7px] py-[2px] shadow-sm flex items-center justify-center">
          <span className="text-[8px] font-bold text-white uppercase tracking-[0.4px] leading-none">Verify Base first</span>
        </div>
      )}
      <div className={`rounded-[18px] p-[14px] border-2 flex items-center gap-[14px] transition-all ${active ? "bg-[var(--surface-2)] border-[var(--primary)]" : "bg-[var(--surface)] border-[var(--border-card)] hover:border-[var(--border-4)]"}`}
        style={{ boxShadow: active ? "0px 4px 14px rgba(96,16,210,0.10)" : "0px 1px 3px rgba(27,28,29,0.05)" }}>
        <div className="shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] text-[var(--ink)] leading-[20px]" style={{ fontWeight: 590 }}>{name}</p>
          <p className="text-[12px] text-[var(--text-muted)] leading-[16px] mt-[2px]">{line1}</p>
          <p className="text-[12px] text-[var(--text-faint)] leading-[16px]">{line2}</p>
        </div>
        <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center shrink-0 ${active ? "bg-[var(--primary)] border-[var(--primary)]" : "border-[var(--border-input)]"}`}>
          {active && <Check className="w-[12px] h-[12px] text-white" strokeWidth={3.5} />}
        </div>
      </div>
    </button>
  );
}

function CelebrateScreen({ onWithdraw, onLater }: { onWithdraw: (p: Provider) => void; onLater: () => void }) {
  const { available: LOAN_USDC, repayUsdc: REPAY_USDC, dueDate: DUE_DATE } = useWithdrawData();
  const region = useRegion();
  const isPH = region !== "other";
  const [selected, setSelected] = useState<Provider>("moneybees");

  useEffect(() => {
    if (region === "other") setSelected("binance");
    else if (region === "ph") setSelected("moneybees");
  }, [region]);

  const NAMES: Record<Provider, string> = {
    moneybees: "Moneybees", binance: "Binance", coinsph: "Coins.ph",
    gcash: "GCrypto", pdax: "PDAX",
  };

  return (
    <div className="absolute inset-0 bg-[var(--surface)] flex flex-col">
      <div className="flex-1 overflow-y-auto px-[22px] pt-[max(44px,env(safe-area-inset-top))]">
        <div className="relative flex flex-col items-center text-center pt-[8px] pb-[6px]">
          {[
            { top: "8%", left: "16%", s: 5, c: "#FCD116", o: 0.7 },
            { top: "20%", left: "82%", s: 4, c: "#34D981", o: 0.6 },
            { top: "46%", left: "10%", s: 4, c: "var(--dot-1)", o: 0.6 },
            { top: "38%", left: "88%", s: 4, c: "var(--accent)", o: 0.5 },
          ].map((d, i) => (
            <div key={i} className="absolute rounded-full pointer-events-none" style={{ top: d.top, left: d.left, width: d.s, height: d.s, background: d.c, opacity: d.o }} />
          ))}
          <div className="w-[64px] h-[64px] rounded-full bg-[var(--surface)] border-[5px] border-[var(--border-1)] flex items-center justify-center mb-[14px]" style={{ boxShadow: "0px 6px 18px rgba(96,16,210,0.14)" }}>
            <div className="relative">
              <Wallet className="w-[26px] h-[26px] text-[var(--primary)]" strokeWidth={2.2} />
              <ArrowUpRight className="w-[13px] h-[13px] text-[var(--primary)] absolute -top-[3px] -right-[5px]" strokeWidth={3} />
            </div>
          </div>
          <h1 className="text-[27px] text-[var(--ink)]" style={{ fontWeight: 590, lineHeight: 1.1, letterSpacing: "-0.04em" }}>Withdraw your USDC</h1>
          <p className="text-[13px] text-[var(--text-muted)] leading-[18px] mt-[6px]">
            {LOAN_USDC} USDC available
            {REPAY_USDC != null && DUE_DATE
              ? <> · Repay <span className="font-semibold text-[var(--primary)]">{REPAY_USDC} USDC</span> by {DUE_DATE}</>
              : null}
          </p>
        </div>

        <p className="text-[18px] text-[var(--ink)] mt-[10px] mb-[18px]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>How would you like to cash out?</p>
        <div className="space-y-[10px]">
          {isPH ? (<>
            <PickerRow selected={selected} onSelect={setSelected} id="moneybees" recommended icon={<MoneybeesAppIcon className="w-[46px] h-[46px]" />} name="Moneybees" line1="Assisted cash-out · BSP-registered" line2="Bank, GCash or Maya · ~1 business day" />
            <PickerRow selected={selected} onSelect={setSelected} id="coinsph" icon={<CoinsPhAppIcon className="w-[46px] h-[46px]" />} name="Coins.ph" line1="Sell for pesos, withdraw to bank or GCash" line2="Bank or GCash · ~30 min" />
            <PickerRow selected={selected} onSelect={setSelected} id="gcash" icon={<GCashAppIcon className="w-[46px] h-[46px]" />} name="GCrypto" line1="Cash out straight to your GCash" line2="GCash balance · ~5 min" />
            <PickerRow selected={selected} onSelect={setSelected} id="pdax" icon={<PdaxAppIcon className="w-[46px] h-[46px]" />} name="PDAX" line1="Sell for pesos, withdraw to bank or e-wallet" line2="Bank, GCash or Maya · ~30 min" />
            <PickerRow selected={selected} onSelect={setSelected} id="binance" icon={<BinanceAppIcon className="w-[46px] h-[46px]" />} name="Binance" line1="Sell for local currency via P2P marketplace" line2="GCash, Maya or Bank · 30 min–hours" />
          </>) : (<>
            <PickerRow selected={selected} onSelect={setSelected} id="binance" recommended icon={<BinanceAppIcon className="w-[46px] h-[46px]" />} name="Binance" line1="Sell for local currency via P2P marketplace" line2="Bank transfer · 30 min–hours" />
            <PickerRow selected={selected} onSelect={setSelected} id="gcash" icon={<GCashAppIcon className="w-[46px] h-[46px]" />} name="GCrypto" line1="Cash out straight to your GCash" line2="GCash balance · ~5 min" />
            <PickerRow selected={selected} onSelect={setSelected} id="pdax" icon={<PdaxAppIcon className="w-[46px] h-[46px]" />} name="PDAX" line1="Sell for pesos, withdraw to bank or e-wallet" line2="Bank, GCash or Maya · ~30 min" />
            <PickerRow selected={selected} onSelect={setSelected} id="coinsph" icon={<CoinsPhAppIcon className="w-[46px] h-[46px]" />} name="Coins.ph" line1="Sell for pesos, withdraw to bank or GCash" line2="Bank or GCash · ~30 min" />
          </>)}
        </div>

        {selected !== "moneybees" && <BaseOnlyNotice className="mt-[12px]" />}
        <div className="h-[12px]" />
      </div>

      <div className="px-[22px] pt-[12px] pb-[max(14px,env(safe-area-inset-bottom))] bg-[var(--surface)] border-t border-[var(--divider)] space-y-[6px]">
        <PrimaryBtn onClick={() => onWithdraw(selected)}>
          Continue with {NAMES[selected]} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
<button onClick={onLater} className="w-full text-center text-[14px] font-semibold text-[var(--primary)] py-[6px] hover:underline">
          I'll do this later
        </button>
      </div>
    </div>
  );
}

/* ─── Send confirmation (real on-chain receipt watch) ───────────── */
type SentStatus = "idle" | "in-progress" | "arrived" | "failed";

// Tracks a withdrawal send through to on-chain confirmation. After the review
// sheet broadcasts the transfer it calls `onSent(hash)`; we then watch the
// transaction receipt on Base and only flip to "arrived" once it actually mines
// successfully (or "failed" if it reverts / errors). In preview there's no chain,
// so a short timer stands in.
function useSendStatus(isPreview: boolean) {
  const [status, setStatus] = useState<SentStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  const { data: receipt, isError } = useWaitForTransactionReceipt({
    hash: !isPreview && txHash ? (txHash as `0x${string}`) : undefined,
    chainId: ALLOWED_CHAIN_ID,
    query: { enabled: !isPreview && Boolean(txHash) }
  });

  useEffect(() => {
    if (status !== "in-progress") return;
    if (isPreview) {
      const t = setTimeout(() => setStatus("arrived"), 2500);
      return () => clearTimeout(t);
    }
    if (receipt) setStatus(receipt.status === "success" ? "arrived" : "failed");
    else if (isError) setStatus("failed");
  }, [status, isPreview, receipt, isError]);

  return {
    status,
    txHash,
    onSent: (hash: string) => { setTxHash(hash); setStatus("in-progress"); }
  };
}

function SentStatusCard({ exchange, amount, status, txHash, isPreview }: {
  exchange: string; amount: number; status: Exclude<SentStatus, "idle">; txHash: string | null; isPreview: boolean;
}) {
  const failed = status === "failed";
  return (
    <Card className="p-[18px]">
      <div className="flex items-center gap-[14px]">
        <div className={`w-[44px] h-[44px] rounded-full flex items-center justify-center shrink-0 ${failed ? "bg-[var(--danger-bg)]" : "bg-[var(--green-bg)]"}`}>
          {failed
            ? <AlertTriangle className="w-[22px] h-[22px] text-[var(--danger)]" />
            : <CheckCircle2 className="w-[24px] h-[24px] text-[var(--green-2)]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold text-[var(--ink)] tracking-[-0.4px]">{amount} USDC sent to {exchange}</p>
          <div className="flex items-center gap-[6px] mt-[3px]">
            {status === "in-progress" && <Loader2 className="w-[13px] h-[13px] text-[var(--primary)] animate-spin shrink-0" />}
            {status === "arrived" && <Check className="w-[13px] h-[13px] text-[var(--green-2)] shrink-0" strokeWidth={3} />}
            {failed && <AlertTriangle className="w-[13px] h-[13px] text-[var(--danger)] shrink-0" />}
            <p className="text-[13px] text-[var(--text-muted)] leading-[18px]">
              {status === "in-progress"
                ? "Confirming on the Base network…"
                : status === "arrived"
                  ? `Confirmed on-chain · ${exchange} will credit you shortly`
                  : "We couldn't confirm this transfer — check the status below"}
            </p>
          </div>
        </div>
      </div>
      {!isPreview && txHash && (
        <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
          className="mt-[12px] inline-flex items-center gap-[5px] text-[12px] font-semibold text-[var(--accent)] hover:text-[var(--primary)] transition-colors">
          View on BaseScan <ArrowUpRight className="w-[13px] h-[13px]" />
        </a>
      )}
    </Card>
  );
}

/* ─── Shared address + amount form ──────────────────────────────── */
type AppFlowConfig = {
  name: string;
  short: string;
  howItWorks: string;
  payout: string;
  receiveCurrency: string;
  steps: FlowStep[];
  cashOutTitle: string;
  cashOutIntro: string;
  cashOutVideo?: string;
  cashOutSteps: { title: React.ReactNode; helper?: React.ReactNode; danger?: React.ReactNode }[];
  topWarning?: React.ReactNode;
};

function AppFlow({ cfg }: { cfg: AppFlowConfig }) {
  const { available: LOAN_USDC, isPreview, send } = useWithdrawData();
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [showCashOut, setShowCashOut] = useState(true);
  const { status: sentStatus, txHash, onSent } = useSendStatus(isPreview);
  const addrValid = isValidAddress(address);
  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= LOAN_USDC;
  const canSend = addrValid && amtValid && !sending;

  // Tapping send goes straight to the wallet — the Base Account popup is the
  // only confirmation step. While it's open and the tx broadcasts, the button
  // shows progress; once it returns a hash the form is replaced by the status.
  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    const hash = await send(address.trim(), String(amtNum));
    setSending(false);
    if (hash) onSent(hash);
  }

  return (
    <div className="space-y-[12px]">
      {cfg.topWarning}

      {sentStatus !== "idle" ? (
        <SentStatusCard exchange={cfg.name} amount={amtNum} status={sentStatus} txHash={txHash} isPreview={isPreview} />
      ) : (
        <>
          <AmountCard
            receive={<ReceiveEstimate currency={cfg.receiveCurrency} usdcAmount={amtValid ? amtNum : LOAN_USDC} />}
            payout={<>Payout to <span className="font-semibold text-[var(--ink)]">{cfg.payout}</span></>}
          />

          <div>
            <p className="text-[14px] font-semibold text-[var(--ink)] mb-[10px] px-[2px]">How to transfer to {cfg.short}</p>
            <StepList steps={cfg.steps} />
          </div>

          <BaseOnlyNotice />

          <Card className="p-[16px] space-y-[12px]">
            <p className="text-[16px] text-[var(--ink)]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Your {cfg.short} transfer address</p>
            <div className="space-y-[6px]">
              <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
                <div aria-hidden className={`absolute inset-0 rounded-[12px] border pointer-events-none ${address && !addrValid ? "border-[var(--danger)]" : "border-[var(--border-strong)]"}`} />
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder={`Paste your ${cfg.short} address`}
                  className="flex-1 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none w-full" />
                {address && (
                  <button onClick={() => setAddress("")} className="pr-[12px] text-[var(--text-muted)] hover:text-[var(--ink)]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {address && !addrValid && <p className="text-[12px] text-[var(--danger)] leading-[18px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Doesn't look like a valid wallet address.</p>}
            </div>
            <div className="space-y-[6px]">
              <p className="font-semibold text-[14px] text-[var(--ink)]">Amount</p>
              <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
                <div aria-hidden className="absolute inset-0 rounded-[12px] border border-[var(--border-strong)] pointer-events-none" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  className="flex-1 min-w-0 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none" />
                <button onClick={() => setAmount(String(LOAN_USDC))} className="text-[12px] text-[var(--accent)] font-semibold pr-[10px] shrink-0 hover:underline">Max</button>
                <span className="pr-[16px] text-[14px] font-semibold text-[var(--text-muted)] shrink-0">USDC</span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)] leading-[18px]">Available: {LOAN_USDC} USDC</p>
            </div>
          </Card>

          <PrimaryBtn disabled={!canSend} onClick={handleSend}>
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in your wallet…</>
              : <>Send {amount || "0"} USDC to {cfg.short} <ArrowRight className="w-4 h-4" /></>}
          </PrimaryBtn>
        </>
      )}

      {/* After it arrives — always expanded */}
      <Card className="overflow-hidden">
        <button onClick={() => setShowCashOut(v => !v)} className="w-full flex items-center gap-[12px] px-[16px] py-[14px] text-left">
          <div className="w-[36px] h-[36px] rounded-[11px] bg-[var(--green-bg)] flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-[18px] h-[18px] text-[var(--green-2)]" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.4px]">After it arrives</p>
            <p className="text-[15px] text-[var(--ink)] tracking-[-0.3px]" style={{ fontWeight: 590 }}>{cfg.cashOutTitle}</p>
          </div>
          <ChevronRight className={`w-[18px] h-[18px] text-[var(--border-strong)] shrink-0 transition-transform ${showCashOut ? "rotate-90" : ""}`} />
        </button>
        {showCashOut && (
          <div className="px-[16px] pb-[16px] pt-[2px] border-t border-[var(--surface-grey)]">
            <p className="text-[13px] leading-[19px] tracking-[-0.26px] text-[var(--text-muted)] pt-[12px] pb-[14px]">{cfg.cashOutIntro}</p>
            {cfg.cashOutVideo && (
              <div className="mb-[14px] rounded-[12px] overflow-hidden">
                <iframe className="w-full" height="195" src={`https://www.youtube.com/embed/${cfg.cashOutVideo}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen title="Cash-out guide" />
              </div>
            )}
            {cfg.cashOutSteps.map((s, i) => (
              <TimelineStep key={i} n={i + 1} last={i === cfg.cashOutSteps.length - 1} title={s.title}>
                {s.helper && <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">{s.helper}</p>}
                {s.danger && (
                  <div className="mt-[6px] bg-[var(--danger-bg)] rounded-[8px] px-[10px] py-[6px] border border-[var(--danger-border)]">
                    <p className="text-[12px] leading-[18px] tracking-[-0.24px] text-[var(--danger-text)]">{s.danger}</p>
                  </div>
                )}
              </TimelineStep>
            ))}
          </div>
        )}
      </Card>

    </div>
  );
}

/* ─── Flow configs ──────────────────────────────────────────────── */

const GCASH_HELP = "https://help.gcash.com/hc/en-us/articles/10203149752601-How-can-I-receive-crypto-using-GCrypto";
const GCASH_FLOW: AppFlowConfig = {
  name: "GCrypto",
  short: "GCrypto",
  receiveCurrency: "PHP",
  payout: "GCash balance",
  howItWorks: "Send USDC from your Moodeng wallet to your GCash GCrypto account. Once it arrives, sell it for pesos — it lands in your GCash wallet instantly.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open GCash → GCrypto", desc: "Tap Enjoy → GCrypto → Receive. Choose USDC and select Base as the network.", guide: { title: "How to open GCrypto in GCash", video: "m5-cD7v4SLg", link: { label: "Official GCash guide", url: GCASH_HELP }, steps: [
      "Open the GCash app and tap \"Enjoy\".",
      "Tap \"GCrypto\" — you need a fully-verified GCash account.",
      "Select USDC, then tap \"Receive\".",
      "Choose \"Base\" as the network.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your GCash address", desc: "Tap to copy the address shown on the screen.", guide: { title: "How to copy your GCrypto address", video: "m5-cD7v4SLg", link: { label: "Official GCash guide", url: GCASH_HELP }, steps: [
      "GCrypto shows your address.",
      "Tap to copy the address.",
      "Come back to Moodeng and paste it below.",
    ] } },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it below", desc: "Paste the address in the field below, then confirm and send." },
  ],
  cashOutTitle: "Cash out to pesos in GCash",
  cashOutIntro: "Once your USDC is in GCrypto, sell it for pesos — it lands in your GCash wallet in under a minute.",
  cashOutSteps: [
    { title: <>In GCrypto, tap <span className="font-bold">Sell</span></> },
    { title: "Choose USDC and enter the amount" },
    { title: "Confirm the sale — pesos go straight to your GCash balance" },
  ],
};

const PDAX_DEPOSIT_HELP = "https://support.pdax.ph/support/solutions/articles/1060000097399-how-to-deposit-cryptocurrency-into-your-pdax-wallet-";
const PDAX_FLOW: AppFlowConfig = {
  name: "PDAX",
  short: "PDAX",
  receiveCurrency: "PHP",
  payout: "Bank, GCash or Maya",
  howItWorks: "Send USDC from your Moodeng wallet to your PDAX account. Once it arrives, sell it for pesos and withdraw to your bank or e-wallet.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open PDAX → Portfolio → USDC → Receive", desc: "Select USDC, tap Receive, then choose Base as the network.", guide: { title: "How to find your PDAX receiving address", video: "q8F8H1UzBEU", link: { label: "Official PDAX guide", url: PDAX_DEPOSIT_HELP }, steps: [
      "Open the PDAX app and tap the Portfolio icon.",
      "Select USDC, then tap \"Receive\" (or Deposit).",
      "Choose \"Base\" as the network.",
      "Confirm it says Base before continuing.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your PDAX address", desc: "Tap to copy the address from the screen.", guide: { title: "How to copy your PDAX address", video: "q8F8H1UzBEU", link: { label: "Official PDAX guide", url: PDAX_DEPOSIT_HELP }, steps: [
      "PDAX shows your receiving address.",
      "Tap to copy the address.",
      "Come back to Moodeng and paste it below.",
    ] } },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it below", desc: "Paste the address in the field below, then confirm and send." },
  ],
  cashOutTitle: "Cash out to pesos with PDAX",
  cashOutIntro: "Once your USDC arrives in PDAX (usually under 1 minute), sell it for pesos and withdraw to your bank, GCash, or Maya.",
  cashOutSteps: [
    {
      title: <>In PDAX, go to <span className="font-bold">Trade → Sell</span></>,
      helper: "Tap the Trade tab at the bottom, then select Sell."
    },
    {
      title: <>Select <span className="font-bold">USDC → PHP</span> as the pair</>,
      helper: "Search for USDC and choose PHP as the currency you want to receive."
    },
    {
      title: "Enter the amount and confirm the sale",
      helper: "PDAX shows you the PHP amount you'll receive at the current rate. Tap Sell to confirm."
    },
    {
      title: <>Go to <span className="font-bold">Wallet → Withdraw PHP</span></>,
      helper: "Choose your payout destination: bank account, GCash, or Maya. PDAX withdrawals usually arrive within a few hours."
    },
  ],
};

const COINSPH_DEPOSIT_HELP = "https://support.coins.ph/hc/en-us/articles/26036127886873-How-to-deposit-cryptocurrency-to-your-Coins-ph-account";
const COINSPH_FLOW: AppFlowConfig = {
  name: "Coins.ph",
  short: "Coins.ph",
  receiveCurrency: "PHP",
  payout: "Bank or GCash",
  howItWorks: "Send USDC from your Moodeng wallet to your Coins.ph account. Once it arrives, sell it for pesos and cash out to your bank or GCash.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open Coins.ph → Portfolio → USDC → Receive", desc: "Go to your Portfolio, select USDC, then tap Receive. Choose Base as the network.", guide: { title: "How to receive funds on Coins.ph", link: { label: "Official Coins.ph guide", url: COINSPH_DEPOSIT_HELP }, steps: [
      "Open the Coins.ph app and go to your Portfolio.",
      "Select USDC, then tap \"Receive\".",
      "Choose Base as the network.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your Coins.ph address", desc: "Tap to copy the address shown on screen." },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it below", desc: "Paste the address in the field below, then confirm and send." },
  ],
  cashOutTitle: "Cash out to pesos with Coins.ph",
  cashOutIntro: "Once your USDC arrives (usually under 1 minute), sell it for pesos and send directly to your bank or e-wallet.",
  cashOutVideo: "mlxowanx6j4",
  cashOutSteps: [
    {
      title: <>Tap <span className="font-bold">Trade → Sell</span>, then select <span className="font-bold">USDC</span></>,
      helper: "Enter the amount and tap Sell Now. Your PHP balance updates instantly."
    },
    {
      title: <>Go to <span className="font-bold">Portfolio → Withdraw / Cash Out</span></>,
      helper: "Tap the Withdraw or Cash Out button from your portfolio screen."
    },
    {
      title: "Choose your destination: bank account or e-wallet",
      helper: "You can send to your Union Bank, BDO, BPI, or any PH bank — or to GCash or Maya."
    },
    {
      title: <>Select transfer type: <span className="font-bold">InstaPay</span> or <span className="font-bold">PESONet</span></>,
      helper: "InstaPay is faster (minutes, ₱50,000 limit per transaction). PESONet clears by end of day for larger amounts."
    },
    {
      title: "Enter your bank details, then confirm with the OTP",
      helper: "Coins.ph sends a one-time code to your registered phone number to authorize the transfer.",
      danger: "Double-check your account number before confirming — wrong transfers can't be reversed."
    },
  ],
};

/* ─── Binance flow (custom — has P2P cash-out guide with video) ──── */
function BinanceFlow() {
  const { available: LOAN_USDC, isPreview, send } = useWithdrawData();
  const region = useRegion();
  const isPH = region !== "other";
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [showP2P, setShowP2P] = useState(false);
  const { status: sentStatus, txHash, onSent } = useSendStatus(isPreview);
  const addrValid = isValidAddress(address);
  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= LOAN_USDC;
  const canSend = addrValid && amtValid && !sending;

  async function handleSend() {
    if (!canSend) return;
    setSending(true);
    const hash = await send(address.trim(), String(amtNum));
    setSending(false);
    if (hash) onSent(hash);
  }

  return (
    <div className="space-y-[12px]">
      {sentStatus !== "idle" ? (
        <SentStatusCard exchange="Binance" amount={amtNum} status={sentStatus} txHash={txHash} isPreview={isPreview} />
      ) : (
        <>
          <AmountCard
            receive={<ReceiveEstimate currency="PHP" usdcAmount={amtValid ? amtNum : LOAN_USDC} />}
            payout={<>Payout to <span className="font-semibold text-[var(--ink)]">{isPH ? "GCash, Maya or Bank" : "your bank or local wallet"}</span></>}
          />

          <div>
            <p className="text-[14px] font-semibold text-[var(--ink)] mb-[10px] px-[2px]">How to transfer to Binance</p>
            <StepList steps={[
              { title: "Open Binance → Wallet → Receive", desc: "Tap Wallet, then Receive. Search for USDC and choose Base as the network.", guide: { title: "How to find your Binance receiving address", video: "KAuoySzS0Mc", steps: [
                "Open the Binance app and sign in.",
                "Tap \"Wallet\" in the bottom bar.",
                "Tap \"Receive\" (or Deposit → Deposit Crypto).",
                "Search and select USDC (not USDT).",
                "Choose \"Base\" as the network — not BEP20, ERC20, or TRC20.",
              ] } },
              { title: "Copy your Binance address", desc: "Tap Copy Address to copy it.", guide: { title: "How to copy your Binance address", video: "I-IYLoBTdEQ", steps: [
                "On the Binance receive screen, you'll see a long address.",
                "Tap \"Copy Address\".",
                "Come back to Moodeng and paste it below.",
              ] } },
              { title: "Paste it below", desc: "Paste the address in the field below, then send." },
            ]} />
          </div>

          <BaseOnlyNotice />

          <Card className="p-[16px] space-y-[12px]">
            <p className="text-[16px] text-[var(--ink)]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Your Binance transfer address</p>
            <div className="space-y-[6px]">
              <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
                <div aria-hidden className={`absolute inset-0 rounded-[12px] border pointer-events-none ${address && !addrValid ? "border-[var(--danger)]" : "border-[var(--border-strong)]"}`} />
                <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Paste your Binance address"
                  className="flex-1 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none w-full" />
                {address && (
                  <button onClick={() => setAddress("")} className="pr-[12px] text-[var(--text-muted)] hover:text-[var(--ink)]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {address && !addrValid && <p className="text-[12px] text-[var(--danger)] leading-[18px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Doesn't look like a valid wallet address.</p>}
            </div>
            <div className="space-y-[6px]">
              <p className="font-semibold text-[14px] text-[var(--ink)]">Amount</p>
              <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
                <div aria-hidden className="absolute inset-0 rounded-[12px] border border-[var(--border-strong)] pointer-events-none" />
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0"
                  className="flex-1 min-w-0 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none" />
                <button onClick={() => setAmount(String(LOAN_USDC))} className="text-[12px] text-[var(--accent)] font-semibold pr-[10px] shrink-0 hover:underline">Max</button>
                <span className="pr-[16px] text-[14px] font-semibold text-[var(--text-muted)] shrink-0">USDC</span>
              </div>
              <p className="text-[12px] text-[var(--text-muted)] leading-[18px]">Available: {LOAN_USDC} USDC</p>
            </div>
          </Card>

          <PrimaryBtn disabled={!canSend} onClick={handleSend}>
            {sending
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Confirm in your wallet…</>
              : <>Send {amount || "0"} USDC to Binance <ArrowRight className="w-4 h-4" /></>}
          </PrimaryBtn>
        </>
      )}

      <Card className="overflow-hidden">
        <button onClick={() => setShowP2P(v => !v)} className="w-full flex items-center gap-[12px] px-[16px] py-[14px] text-left">
          <BinanceAppIcon className="w-[36px] h-[36px] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.4px]">After it arrives</p>
            <p className="text-[15px] text-[var(--ink)] tracking-[-0.3px]" style={{ fontWeight: 590 }}>{isPH ? "Cash out to pesos with Binance P2P" : "Cash out to local currency with Binance P2P"}</p>
          </div>
          <ChevronRight className={`w-[18px] h-[18px] text-[var(--border-strong)] shrink-0 transition-transform ${showP2P ? "rotate-90" : ""}`} />
        </button>
        {showP2P && (
          <div className="px-[16px] pb-[16px] pt-[2px] border-t border-[var(--surface-grey)]">
            <div className="rounded-[14px] overflow-hidden aspect-video bg-black mt-[14px]">
              <iframe className="w-full h-full" src="https://www.youtube-nocookie.com/embed/cld4bNfixTc"
                title="Binance P2P walkthrough" loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <p className="text-[13px] leading-[19px] tracking-[-0.26px] text-[var(--text-muted)] pt-[12px] pb-[14px]">
              Once your {amount || LOAN_USDC} USDC shows in Binance, sell it for {isPH ? "pesos" : "local currency"} to a verified buyer — Binance holds the crypto in escrow until you're paid.
            </p>
            <TimelineStep n={1} title={<>Open <span className="font-bold">P2P Trading → Sell → USDC</span></>} />
            <TimelineStep n={2} title={isPH ? <>Choose <span className="font-bold">PHP</span> and your payout method</> : <>Choose your <span className="font-bold">local currency</span> and payout method</>}>
              <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">{isPH ? "GCash, Maya, or bank transfer (BDO, BPI, etc.)." : "Bank transfer or local payment method."}</p>
            </TimelineStep>
            <TimelineStep n={3} title="Pick a trustworthy buyer">
              <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">Prefer a <span className="font-semibold text-[var(--ink)]">95%+ completion rate</span> and many completed trades.</p>
            </TimelineStep>
            <TimelineStep n={4} title="Enter the amount and place the order" />
            <TimelineStep n={5} last title={isPH ? "Release USDC only after pesos arrive" : "Release USDC only after payment arrives"}>
              <div className="bg-[var(--danger-bg)] rounded-[8px] px-[10px] py-[6px] border border-[var(--danger-border)]">
                <p className="text-[12px] leading-[18px] tracking-[-0.24px] text-[var(--danger-text)]"><span className="font-bold">Never</span> tap "Release" until the {isPH ? "peso payment is actually in your GCash/bank" : "payment is actually in your account"}. Check it yourself first.</p>
              </div>
            </TimelineStep>
          </div>
        )}
      </Card>

    </div>
  );
}

/* Telegram / Viber / WhatsApp icons for Moneybees */
function TelegramIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#229ED9" />
      <path fill="#fff" d="M5.5 11.8 17.2 7.3c.54-.2 1.01.13.84.95l-2 9.43c-.14.66-.53.82-1.08.51l-2.99-2.2-1.44 1.39c-.16.16-.3.3-.6.3l.21-3.06 5.56-5.02c.24-.21-.05-.33-.38-.12L8.1 13.2l-2.96-.92c-.64-.2-.66-.64.14-.95z" />
    </svg>
  );
}
function ViberIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="24" fill="#7360F2" />
      <path fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
        d="M18 12 H31 A7 7 0 0 1 38 19 V24 A7 7 0 0 1 31 31 H17 L10.5 35.5 L11 27.5 V19 A7 7 0 0 1 18 12 Z" />
      <path fill="#fff" d="M21 17.4c-.8.1-1.4.9-1.3 1.7.6 4.6 4.3 8.3 8.9 8.9.8.1 1.6-.5 1.7-1.3l.2-1.9c.1-.6-.3-1.2-.9-1.5l-2.1-.9c-.5-.2-1.1-.1-1.5.3l-.7.7c-1.5-.8-2.7-2-3.5-3.5l.7-.7c.4-.4.5-1 .3-1.5l-.9-2.1c-.3-.6-.9-1-1.5-.9z" />
      <path fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"
        d="M26.6 16.9a3.4 3.4 0 0 1 3.2 3.2M27.3 14.5a5.6 5.6 0 0 1 5.2 5.2" />
    </svg>
  );
}
function WhatsappIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path fill="#fff" d="M16.9 13.9c-.27-.14-1.58-.78-1.83-.87-.24-.09-.42-.13-.6.14-.17.26-.68.86-.83 1.04-.15.17-.3.2-.57.07-.27-.14-1.13-.42-2.16-1.33-.8-.71-1.34-1.59-1.49-1.86-.16-.27-.02-.41.12-.55.12-.12.27-.31.4-.47.13-.16.18-.27.27-.45.09-.18.04-.34-.02-.48-.07-.14-.6-1.45-.83-1.99-.22-.52-.44-.45-.6-.46l-.51-.01c-.18 0-.47.07-.71.34-.24.27-.94.92-.94 2.24 0 1.32.96 2.6 1.1 2.78.13.18 1.89 2.88 4.58 4.04.64.28 1.14.44 1.53.57.64.2 1.23.18 1.69.11.52-.08 1.58-.65 1.81-1.27.22-.62.22-1.16.16-1.27-.07-.11-.25-.18-.52-.32z" />
    </svg>
  );
}

/* ─── Moneybees flow ─────────────────────────────────────────────── */
function MoneybeesFlow() {
  const { available: LOAN_USDC } = useWithdrawData();
  const [phase, setPhase] = useState<"form" | "pending" | "done">("form");

  const steps: FlowStep[] = [
    { icon: <CreditCard className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Complete Moneybees KYC", desc: "A one-time ID check on their secure page." },
    { icon: <MessageCircle className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Get assisted by chat", desc: "Via Telegram, Viber, or WhatsApp.", extra: (
      <div className="flex items-center gap-[8px] mt-[9px]">
        <TelegramIcon className="w-[28px] h-[28px]" />
        <ViberIcon className="w-[28px] h-[28px]" />
        <WhatsappIcon className="w-[28px] h-[28px]" />
      </div>
    ) },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm your payout", desc: "They lock in the rate and payout method." },
    { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Send only after instructions", desc: "Send USDC only once Moneybees confirms the details." },
  ];

  return (
    <div className="space-y-[12px]">
      <AmountCard
        receive={<>
          <p className="text-[19px] font-semibold text-[var(--ink)] tracking-[-0.4px] mt-[4px]">PHP</p>
          <p className="text-[11px] text-[var(--text-faint)] leading-[15px] mt-[2px]">Rate set by Moneybees</p>
        </>}
        payout={<>Payout to <span className="font-semibold text-[var(--ink)]">Bank</span>, <span className="font-semibold text-[var(--ink)]">GCash</span>, or <span className="font-semibold text-[var(--ink)]">Maya</span></>}
      />

      <HowThisWorks>Moneybees is a BSP/AMLC-registered cash-out provider. They handle KYC, exchange rate, transaction details, and PHP payout directly with you.</HowThisWorks>

      <div>
        <p className="text-[16px] text-[var(--ink)] mb-[8px]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Your cash-out steps</p>
        <StepList steps={steps} />
      </div>

      {phase === "done" ? (
        <div className="rounded-[14px] bg-[var(--green-bg)] border border-[var(--green-border)] p-[16px] flex gap-[12px]">
          <CheckCircle2 className="w-[22px] h-[22px] text-[var(--green-2)] shrink-0" />
          <div>
            <p className="text-[14px] font-semibold text-[var(--green-text-2)] leading-[19px]">You're all set</p>
            <p className="text-[13px] text-[var(--green-text)] leading-[19px] mt-[2px]">Moneybees will message you on your chosen chat app to confirm the rate and complete your {LOAN_USDC} USDC cash-out.</p>
          </div>
        </div>
      ) : phase === "pending" ? (
        <div className="space-y-[10px]">
          <div className="bg-[var(--amber-bg-2)] rounded-[12px] px-[14px] py-[12px] flex gap-[8px]">
            <Clock className="w-[15px] h-[15px] text-[var(--amber-icon)] shrink-0 mt-[2px]" />
            <p className="text-[13px] leading-[19px] tracking-[-0.26px] text-[var(--amber-text)]">Finish verifying on the Moneybees page that opened, then tap below. Once Moneybees confirms your identity, they'll reach out by chat.</p>
          </div>
          <PrimaryBtn onClick={() => setPhase("done")}>I've completed Moneybees KYC</PrimaryBtn>
          <button onClick={() => setPhase("pending")} className="w-full text-[13px] text-[var(--accent)] font-semibold tracking-[-0.26px] py-[4px] text-center hover:underline">Reopen Moneybees verification</button>
        </div>
      ) : (
        <>
          <PrimaryBtn onClick={() => setPhase("pending")}>Continue to Moneybees KYC <ArrowRight className="w-4 h-4" /></PrimaryBtn>
          <SecondaryBtn onClick={() => setPhase("done")}>I already have Moneybees KYC</SecondaryBtn>
        </>
      )}
    </div>
  );
}

/* ─── Withdraw screen wrapper ────────────────────────────────────── */
const PROVIDER_TITLES: Record<Provider, string> = {
  moneybees: "Cash out with Moneybees",
  binance: "Send to Binance",
  coinsph: "Send to Coins.ph",
  gcash: "Send to GCrypto",
  pdax: "Send to PDAX",
};

function WithdrawScreen({ provider, onBack }: { provider: Provider; onBack: () => void }) {
  return (
    <div className="absolute inset-0 bg-[var(--app-bg)] flex flex-col pt-[env(safe-area-inset-top,0px)] w-full">
      <div className="sticky top-0 z-20 bg-[var(--app-bg)]/80 backdrop-blur-md px-[24px] pt-[20px] pb-[16px] shrink-0 mt-[10px]">
        <div className="relative flex items-center justify-center">
          <button
            onClick={onBack}
            className="absolute left-0 w-[40px] h-[40px] flex items-center justify-center rounded-full bg-[var(--surface)] border border-[var(--border-card-2)] hover:bg-[var(--surface-grey)] transition-colors"
            style={{ boxShadow: "0px 2px 8px rgba(27,28,29,0.04)" }}
          >
            <ChevronLeft className="w-[20px] h-[20px] text-[var(--ink)]" strokeWidth={2.5} />
          </button>
          <p className="text-[18px] font-bold leading-[1.2] tracking-[-0.4px] text-[var(--ink)] px-[44px] text-center truncate">
            {PROVIDER_TITLES[provider]}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-[40px]">
        <div className="px-[16px] pt-[12px]">
          {provider === "moneybees" ? <MoneybeesFlow />
            : provider === "binance" ? <BinanceFlow />
            : provider === "gcash" ? <AppFlow cfg={GCASH_FLOW} />
            : provider === "pdax" ? <AppFlow cfg={PDAX_FLOW} />
            : <AppFlow cfg={COINSPH_FLOW} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Screen switcher (celebrate → withdraw) ─────────────────────── */
function WithdrawFlow() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("celebrate");
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [provider, setProvider] = useState<Provider>("moneybees");

  function goWithdraw(p: Provider) {
    setProvider(p);
    setScreen("withdraw");
    requestAnimationFrame(() => requestAnimationFrame(() => setWithdrawVisible(true)));
  }

  return (
    <>
      {screen === "withdraw" && (
        <div
          className="transition-opacity duration-300 flex-1 min-h-0 flex flex-col relative z-0"
          style={{ opacity: withdrawVisible ? 1 : 0 }}
        >
          <WithdrawScreen provider={provider} onBack={() => {
            setWithdrawVisible(false);
            setTimeout(() => setScreen("celebrate"), 50);
          }} />
        </div>
      )}

      {screen === "celebrate" && (
        <div className="absolute inset-0 bg-[var(--app-bg)] flex items-end justify-center z-10">
          <CelebrateScreen onWithdraw={goWithdraw} onLater={() => navigate("/dashboard")} />
        </div>
      )}
    </>
  );
}

/* ─── Root — provides real on-chain data to the flow ─────────────── */
const PREVIEW_ADDRESS = "0x1234aBCd5678Ef901234abcd5678ef901234ABcd";

export default function Withdraw() {
  const location = useLocation();
  const account = useAccount();
  const { Transfer } = useWallet();
  const user = useSelector((state: RootState) => state.auth.user);
  const loans = useSelector((state: RootState) => state.loans.loans.gloans);

  const isPreview = useMemo(() => {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    const previewHost = ["127.0.0.1", "localhost"].includes(host) || host.endsWith(".vercel.app");
    return previewHost && location.pathname === "/withdraw-preview";
  }, [location.pathname]);

  useLoanData({ userId: user.id, enabled: Boolean(user.id) && !isPreview });
  // Touch geo so the edge function is warmed for the in-flow region copy.
  useGeoCheck(isPreview);

  // The borrower's funded loans = the disbursed USDC they can now cash out.
  const fundedLoans = useMemo(
    () => loans.filter((loan) => loan.borrowerUser === user.id && loan.loanStatus === "Lent"),
    [loans, user.id]
  );
  const primaryLoan = useMemo(
    () => [...fundedLoans].sort((a, b) => parseDateSafely(a.dueDate).getTime() - parseDateSafely(b.dueDate).getTime())[0],
    [fundedLoans]
  );

  const walletAddress = getBaseWalletLockStatus(user).address ?? account.address ?? (isPreview ? PREVIEW_ADDRESS : "");

  const { data: usdcBalanceRaw } = useReadContract({
    abi: erc20Abi,
    address: BASE_USDC_ADDRESS,
    functionName: "balanceOf",
    args: walletAddress ? [walletAddress as `0x${string}`] : undefined,
    chainId: ALLOWED_CHAIN_ID,
    query: { enabled: Boolean(walletAddress) && !isPreview, refetchInterval: 30000 }
  });

  const fundedTotal = fundedLoans.reduce((sum, loan) => sum + Number(loan.loanAmount || 0), 0);
  const onChainBalance = typeof usdcBalanceRaw === "bigint" ? Number(usdcBalanceRaw) / 1e6 : null;
  const available = isPreview ? 50 : Math.round((onChainBalance ?? fundedTotal) * 100) / 100;

  const data = useMemo<WithdrawData>(() => ({
    available,
    repayUsdc: isPreview ? 55 : primaryLoan ? Math.round(Number(primaryLoan.totalRepaymentAmount) * 100) / 100 : null,
    dueDate: isPreview
      ? "July 18, 2026"
      : primaryLoan
        ? parseDateSafely(primaryLoan.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
        : null,
    walletAddress,
    isPreview,
    send: async (toAddress: string, amount: string) => {
      if (isPreview) {
        await new Promise((r) => setTimeout(r, 1500));
        return "0xpreview";
      }
      return await Transfer(toAddress.trim(), amount, primaryLoan?.id ?? "withdraw", "USDC");
    }
  }), [available, isPreview, primaryLoan, walletAddress, Transfer]);

  return (
    <WithdrawDataContext.Provider value={data}>
      <div style={{ fontFamily: FONT, backgroundColor: "var(--app-bg)" }} className="withdraw-flow fixed inset-0 z-50 overflow-hidden flex justify-center">
        <div className="relative h-full w-full max-w-[440px] flex flex-col">
          <WithdrawFlow />
        </div>
      </div>
    </WithdrawDataContext.Provider>
  );
}
