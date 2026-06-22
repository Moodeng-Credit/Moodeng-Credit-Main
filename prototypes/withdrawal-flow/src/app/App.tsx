import { useState, useEffect, useRef, useMemo } from "react";
import {
  CheckCircle2, ChevronLeft, ChevronRight, Copy, Upload, Wallet, ArrowUpRight,
  AlertTriangle, Info, ShieldAlert, Clock, Check, X, ArrowRight, Sparkles, ScanLine, ArrowDownLeft, PlayCircle, PlusCircle, Download, CreditCard, MessageCircle, Send, Phone, Landmark, ClipboardCheck, Lock, Loader2, Sun, Moon
} from "lucide-react";
import jsQR from "jsqr";

const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Inter", sans-serif`;

type Screen = "celebrate" | "withdraw" | "dismissed";
type Provider = "moneybees" | "binance" | "coinsph" | "gcash" | "pdax" | "coinbase";
type PHDestination = "bank" | "maya" | "gcash" | "other";

const LOAN_USDC = 50;
const REPAY_USDC = 55;
const DUE_DATE = "July 18, 2026";
const REPAY_ADDRESS = "0x7f3aC2b1d4E8Moodeng...c291";

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

function SegmentedControl<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="bg-[var(--surface-grey)] rounded-[12px] p-[4px] flex gap-[4px]">
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-[8px] py-[8px] px-[4px] text-[14px] font-semibold leading-[21px] tracking-[-0.28px] transition-all ${
            value === opt.value ? "bg-[var(--surface)] text-[var(--ink-2)]" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
          }`}
          style={value === opt.value ? { boxShadow: "0px 4px 12px rgba(88,92,95,0.12)" } : undefined}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", suffix, error, success, hint }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; suffix?: string;
  error?: string; success?: string; hint?: string;
}) {
  return (
    <div className="space-y-[6px]">
      <p className="font-semibold text-[14px] leading-[21px] tracking-[-0.28px] text-[var(--ink)]">{label}</p>
      <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center"
        style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
        <div aria-hidden className={`absolute inset-0 rounded-[12px] border pointer-events-none ${error ? "border-[var(--danger)]" : "border-[var(--border-strong)]"}`} />
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="flex-1 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] font-normal focus:outline-none w-full" />
        {suffix && <span className="pr-[16px] text-[14px] font-semibold text-[var(--text-muted)] shrink-0">{suffix}</span>}
        {value && !suffix && (
          <button onClick={() => onChange("")} className="pr-[12px] text-[var(--text-muted)] hover:text-[var(--ink)]">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {error && <p className="text-[12px] text-[var(--danger)] leading-[18px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{error}</p>}
      {success && !error && <p className="text-[12px] text-[var(--green)] leading-[18px] flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" />{success}</p>}
      {hint && !error && !success && <p className="text-[12px] text-[var(--text-muted)] leading-[18px]">{hint}</p>}
    </div>
  );
}

function StepRow({ n, label, note }: { n: number; label: string; note?: string }) {
  return (
    <div className="flex gap-[10px]">
      <div className="w-[24px] h-[24px] rounded-full bg-[var(--surface-1)] text-[var(--accent)] text-[12px] font-semibold flex items-center justify-center shrink-0 mt-[1px]">
        {n}
      </div>
      <div className="space-y-[4px]">
        <p className="text-[14px] leading-[21px] tracking-[-0.28px] text-[var(--ink-2)] font-medium">{label}</p>
        {note && (
          <div className="bg-[var(--amber-bg-2)] rounded-[8px] px-[10px] py-[6px] border border-[var(--amber-border-2)]">
            <p className="text-[12px] leading-[18px] tracking-[-0.24px] text-[var(--text-2)]">{note}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* Connected numbered timeline — instruction steps and input steps share one rail,
   so the whole "do this in their app, then this in ours" flow reads as one path. */
type Guide = { title: string; steps: string[]; video?: string; link?: { label: string; url: string } };
type FlowStep = { icon: React.ReactNode; title: string; desc: string; guide?: Guide; extra?: React.ReactNode };

function TimelineStep({ n, title, last, done, guide, children }: {
  n: number; title: React.ReactNode; last?: boolean; done?: boolean; guide?: Guide; children?: React.ReactNode;
}) {
  return (
    <div className="flex gap-[14px]">
      <div className="flex flex-col items-center shrink-0">
        <div className={`w-[28px] h-[28px] rounded-full text-[13px] font-bold flex items-center justify-center z-10 transition-colors ${
          done ? "bg-[var(--green)] text-white" : "bg-[var(--primary)] text-white"
        }`}>
          {done ? <Check className="w-[15px] h-[15px]" strokeWidth={3} /> : n}
        </div>
        {!last && <div className="w-[2px] flex-1 bg-[var(--border-2)] min-h-[20px]" />}
      </div>
      <div className={`flex-1 min-w-0 ${last ? "pb-[2px]" : "pb-[20px]"}`}>
        <p className="text-[15px] font-semibold text-[var(--ink)] leading-[1.3] tracking-[-0.3px] pt-[4px]">{title}</p>
        {guide && <HowToButton guide={guide} />}
        {children && <div className="mt-[10px]">{children}</div>}
      </div>
    </div>
  );
}

/* "Show me how" — opens a step-by-step guide with a (placeholder) video/GIF slot.
   People lose funds on these flows, so every tricky action gets a hand-holding guide. */
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
        {/* Embedded YouTube walkthrough — falls back to a placeholder until a clip is set. */}
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

/* Numbered step timeline — a vertical rail with number badges so the instructions
   clearly read as an ordered sequence, not a stack of tappable buttons. The per-step
   icon is a small inline accent (no filled circle, which looked button-like). */
function StepList({ steps, bare = false }: { steps: FlowStep[]; bare?: boolean }) {
  const rows = steps.map((s, i) => (
    <div key={i} className="flex gap-[13px]">
      <div className="flex flex-col items-center shrink-0">
        <div className="w-[26px] h-[26px] rounded-full bg-[var(--primary)] text-white text-[12px] font-bold flex items-center justify-center">{i + 1}</div>
        {i < steps.length - 1 && <div className="w-[2px] flex-1 bg-[var(--divider-2)] min-h-[14px] my-[5px]" />}
      </div>
      <div className={`flex-1 min-w-0 ${i < steps.length - 1 ? "pb-[16px]" : ""}`}>
        <div className="flex items-center gap-[7px] pt-[2px]">
          <span className="shrink-0">{s.icon}</span>
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

/* Coin / network reference — a flat, non-interactive preview of what the borrower
   should look for in the exchange. Deliberately not card/button-styled so it doesn't
   read as tappable. */
function TokenChip({ label, sub, icon }: { label: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-[9px] cursor-default select-none">
      <div className="w-[22px] h-[22px] shrink-0 flex items-center justify-center">{icon}</div>
      <p className="text-[13px] tracking-[-0.26px]">
        <span className="font-semibold text-[var(--ink)]">{label}</span>
        {sub && <span className="text-[var(--text-faint)]"> · {sub}</span>}
      </p>
    </div>
  );
}

function WarnBox({ children, variant = "red" }: { children: React.ReactNode; variant?: "red" | "amber" | "blue" }) {
  const s = {
    red:   { bg: "var(--danger-bg)", border: "var(--danger-border)", icon: "var(--danger)", text: "var(--danger-text)" },
    amber: { bg: "var(--amber-bg)", border: "var(--amber-border)", icon: "var(--amber-icon)", text: "var(--amber-text)" },
    blue:  { bg: "var(--surface-1)", border: "var(--border-2)", icon: "var(--accent)", text: "var(--accent-text)" },
  }[variant];
  const Icon = variant === "blue" ? Info : AlertTriangle;
  return (
    <div className="rounded-[14px] px-[14px] py-[12px] flex gap-[10px]"
      style={{ background: s.bg, border: `1px solid ${s.border}` }}>
      <Icon className="w-[15px] h-[15px] shrink-0 mt-[2px]" style={{ color: s.icon }} />
      <p className="text-[12px] leading-[18px] tracking-[-0.24px]" style={{ color: s.text }}>{children}</p>
    </div>
  );
}

function CopyButton({ value, className = "" }: { value: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText(value); } catch { /* clipboard unavailable */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`shrink-0 inline-flex items-center gap-[4px] text-[var(--accent)] ${className}`}>
      {copied ? <Check className="w-4 h-4 text-[var(--green)]" /> : <Copy className="w-4 h-4" />}
      {copied && <span className="text-[12px] font-semibold text-[var(--green)]">Copied</span>}
    </button>
  );
}

function ReviewModal({ exchange, amount, address, onClose }: {
  exchange: string; amount: number; address: string; onClose: () => void;
}) {
  const [phase, setPhase] = useState<"review" | "sending" | "sent">("review");
  // A realistic-looking Base tx hash for the simulated confirmation.
  const txHash = useMemo(
    () => "0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""),
    []
  );

  function send() {
    setPhase("sending");
    setTimeout(() => setPhase("sent"), 1700);
  }

  return (
    <div className="absolute inset-0 bg-black/40 flex items-end justify-center z-50" onClick={phase === "sending" ? undefined : onClose}>
      <div className="w-full h-auto bg-[var(--surface)] rounded-t-[24px] p-[20px] space-y-[16px] pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ boxShadow: "var(--sheet-shadow)" }}
        onClick={e => e.stopPropagation()}>

        {phase === "sent" ? (
          <>
            <div className="flex flex-col items-center text-center pt-[6px]">
              <div className="w-[64px] h-[64px] rounded-full bg-[var(--green-bg)] flex items-center justify-center mb-[14px]">
                <CheckCircle2 className="w-[34px] h-[34px] text-[var(--green-2)]" />
              </div>
              <p className="text-[20px] font-semibold tracking-[-0.6px] text-[var(--ink)]">Sent to {exchange}</p>
              <p className="text-[14px] text-[var(--text-muted)] leading-[20px] mt-[5px] px-[6px]">
                {amount} USDC is on its way on Base. It usually arrives in under a minute.
              </p>
            </div>
            <div className="bg-[var(--app-bg)] rounded-[12px] px-[14px] py-[12px] space-y-[4px]">
              <span className="text-[13px] text-[var(--text-muted)]">Transaction</span>
              <div className="flex items-center justify-between gap-[8px]">
                <span className="text-[12px] font-mono text-[var(--ink)] break-all leading-relaxed">{txHash.slice(0, 14)}…{txHash.slice(-8)}</span>
                <CopyButton value={txHash} />
              </div>
            </div>
            <PrimaryBtn onClick={onClose}>Done</PrimaryBtn>
          </>
        ) : phase === "sending" ? (
          <div className="flex flex-col items-center text-center py-[28px]">
            <Loader2 className="w-[40px] h-[40px] text-[var(--primary)] animate-spin mb-[16px]" />
            <p className="text-[18px] font-semibold tracking-[-0.4px] text-[var(--ink)]">Sending {amount} USDC…</p>
            <p className="text-[14px] text-[var(--text-muted)] leading-[20px] mt-[5px]">Broadcasting your transfer on Base.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[20px] font-semibold leading-[1.2] tracking-[-0.8px] text-[var(--ink)]">Review withdrawal</p>
              <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity">
                <X className="w-5 h-5 text-[var(--ink)]" />
              </button>
            </div>
            <div className="bg-[var(--app-bg)] rounded-[12px] divide-y divide-[var(--border-card-2)] overflow-hidden">
              {[["To", exchange], ["Amount", `${amount} USDC`], ["Network", "Base"]].map(([k, v]) => (
                <div key={k} className="flex justify-between items-center px-[14px] py-[10px]">
                  <span className="text-[14px] text-[var(--text-muted)] leading-[21px] tracking-[-0.28px]">{k}</span>
                  <span className={`text-[14px] font-semibold leading-[21px] tracking-[-0.28px] ${k === "Network" ? "text-[var(--accent)]" : "text-[var(--ink)]"}`}>{v}</span>
                </div>
              ))}
              <div className="px-[14px] py-[10px] space-y-[4px]">
                <span className="text-[14px] text-[var(--text-muted)] block">Address</span>
                <div className="flex items-center justify-between gap-[8px]">
                  <span className="text-[12px] font-mono text-[var(--ink)] break-all leading-relaxed">{address}</span>
                  <CopyButton value={address} />
                </div>
              </div>
            </div>
            <WarnBox variant="amber">
              Double-check that {exchange} shows <strong>USDC on Base</strong>. This cannot be undone.
            </WarnBox>
            <PrimaryBtn onClick={send}>Send USDC</PrimaryBtn>
            <p className="text-[12px] text-[var(--text-faint)] text-center">Moodeng cannot reverse this once sent.</p>
          </>
        )}
      </div>
    </div>
  );
}

function useCountdown(sec: number) {
  const [left, setLeft] = useState(sec);
  useEffect(() => {
    const t = setInterval(() => setLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return `${String(Math.floor(left / 60)).padStart(2, "0")}:${String(left % 60).padStart(2, "0")}`;
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

/* "You'll receive" estimate — always shows a computed fiat payout (live when available,
   otherwise an approximate fixed rate marked "est."). */
function ReceiveEstimate({ currency, usdcAmount }: { currency: string; usdcAmount: number }) {
  const cur = currency.toLowerCase() === "php" ? "php" : "usd";
  const symbol = cur === "php" ? "₱" : "$";
  const { value, live } = useUsdcRate(cur as "php" | "usd");
  const val = usdcAmount * value;
  return (
    <>
      <p className="text-[19px] font-semibold text-[var(--ink)] tracking-[-0.4px] mt-[4px]">≈ {symbol}{val.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
      <p className="text-[11px] text-[var(--text-faint)] leading-[15px] mt-[2px]">1 USDC ≈ {symbol}{value.toLocaleString(undefined, { maximumFractionDigits: 2 })} · {currency}{live ? "" : " (est.)"}</p>
    </>
  );
}

/* Extracts a 0x… EVM address from a scanned QR value (handles raw addresses and
   ethereum:0x…@8453 style URIs). */
function extractAddress(raw: string): string | null {
  const m = raw.match(/0x[0-9a-fA-F]{40}/);
  return m ? m[0] : null;
}

/* Camera QR scanner — decodes frames with jsQR (works in Safari, Firefox, Chrome — not
   just Chromium). On a hit it extracts the address; on camera failure it explains how
   to paste manually. */
function QrScanner({ onResult, onClose }: { onResult: (addr: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        const v = videoRef.current;
        if (v) { v.srcObject = stream; v.setAttribute("playsinline", "true"); await v.play(); }
        const tick = () => {
          if (stopped) return;
          const vid = videoRef.current, cvs = canvasRef.current;
          if (vid && cvs && vid.readyState >= 2 && vid.videoWidth) {
            cvs.width = vid.videoWidth; cvs.height = vid.videoHeight;
            const ctx = cvs.getContext("2d", { willReadFrequently: true });
            if (ctx) {
              ctx.drawImage(vid, 0, 0, cvs.width, cvs.height);
              const img = ctx.getImageData(0, 0, cvs.width, cvs.height);
              const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
              const hit = code ? extractAddress(code.data) : null;
              if (hit) { onResult(hit); return; }
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch {
        setError("Couldn't access the camera. Check permissions, or paste the address instead.");
      }
    })();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [onResult]);

  return (
    <div className="absolute inset-0 bg-black/70 flex items-end justify-center z-[70]" onClick={onClose}>
      <div className="w-full bg-[var(--surface)] rounded-t-[24px] p-[20px] space-y-[14px] pb-[max(20px,env(safe-area-inset-bottom))]"
        style={{ boxShadow: "var(--sheet-shadow)" }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-[18px] font-semibold tracking-[-0.4px] text-[var(--ink)]">Scan QR code</p>
          <button onClick={onClose} className="opacity-50 hover:opacity-100 transition-opacity"><X className="w-5 h-5 text-[var(--ink)]" /></button>
        </div>
        {error ? (
          <div className="rounded-[16px] bg-[var(--surface-1)] border border-[var(--border-3)] aspect-square flex flex-col items-center justify-center gap-[10px] text-center px-[26px]">
            <ScanLine className="w-[34px] h-[34px] text-[var(--accent)]" />
            <p className="text-[13px] text-[var(--text-2)] leading-[19px]">{error}</p>
          </div>
        ) : (
          <div className="relative rounded-[16px] overflow-hidden aspect-square bg-black">
            <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-[16%] border-2 border-white/85 rounded-[18px] pointer-events-none" />
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
        <p className="text-[12px] text-center text-[var(--text-faint)] leading-[16px]">Point your camera at the receiving-address QR in your exchange app.</p>
      </div>
    </div>
  );
}

/* ─── Brand / flag SVGs ──────────────────────────────────────────── */
function PHFlag({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 40" className={className} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <rect width="60" height="20" fill="#0038A8" />
      <rect y="20" width="60" height="20" fill="#CE1126" />
      <path d="M0 0 L26 20 L0 40 Z" fill="#FFFFFF" />
      <circle cx="8.6" cy="20" r="3.1" fill="#FCD116" />
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * Math.PI) / 4;
        return <line key={i} x1={8.6 + Math.cos(a) * 4} y1={20 + Math.sin(a) * 4} x2={8.6 + Math.cos(a) * 6.4} y2={20 + Math.sin(a) * 6.4} stroke="#FCD116" strokeWidth="1.1" strokeLinecap="round" />;
      })}
      <g fill="#FCD116">
        <circle cx="3.4" cy="3.8" r="1.1" />
        <circle cx="3.4" cy="36.2" r="1.1" />
        <circle cx="22.4" cy="20" r="1.1" />
      </g>
    </svg>
  );
}

/* Binance diamond mark — same path the Moodeng platform ships in networkIcons. */
function BinanceMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#FFFFFF" d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z" />
    </svg>
  );
}

/* Binance diamond in brand gold — for use on pale/light tiles. */
function BinanceMarkGold({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <path fill="#F3BA2F" d="m16.624 13.92 2.717 2.716-7.353 7.353-7.352-7.352 2.717-2.717 4.636 4.66 4.635-4.66zm4.637-4.636L24 12l-2.715 2.716L18.568 12l2.693-2.716zm-9.272 0 2.716 2.692-2.717 2.717L9.272 12l2.716-2.715zm-9.273 0L5.41 12l-2.692 2.692L0 12l2.716-2.716zM11.99.01l7.352 7.33-2.717 2.715-4.636-4.636-4.635 4.66-2.717-2.716L11.989.011z" />
    </svg>
  );
}

/* Moneybees brand mark — gold hexagon with the black/white box-and-chevrons "M". */
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
      {/* box lid */}
      <path d="M24 12.5 L33.7 18.1 L24 23.7 L14.3 18.1 Z" fill="#0A0A0A" />
      {/* white front faces */}
      <path d="M14.3 18.1 L24 23.7 L24 37.2 L14.3 31.6 Z" fill="#FFFFFF" />
      <path d="M33.7 18.1 L33.7 31.6 L24 37.2 L24 23.7 Z" fill="#FFFFFF" />
      {/* black downward double-chevron */}
      <path d="M18 24 L24 27.5 L30 24 L30 27.1 L24 30.6 L18 27.1 Z" fill="#0A0A0A" />
      <path d="M18 28.6 L24 32.1 L30 28.6 L30 31.7 L24 35.2 L18 31.7 Z" fill="#0A0A0A" />
    </svg>
  );
}

/* GCash GCrypto brand mark — blue C wrapping a navy G, with cyan signal arcs. */
function GCashMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      {/* Outer blue C — open on the right */}
      <path d="M64 22 A30 30 0 1 0 64 78" fill="none" stroke="#1C84FF" strokeWidth="11" strokeLinecap="round" />
      {/* Inner navy G — arc plus inward crossbar */}
      <path d="M56 35 A18 18 0 1 0 56 65 L56 50 L43 50" fill="none" stroke="#0A2FA8" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {/* Two cyan signal arcs */}
      <path d="M76 39 A16 16 0 0 1 76 61" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M85 31 A25 25 0 0 1 85 69" fill="none" stroke="#45C7FF" strokeWidth="6.5" strokeLinecap="round" />
    </svg>
  );
}

/* PDAX brand mark — navy circle with two parallel green slashes side by side. */
function PdaxMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="50" fill="#0E1A2B" />
      <g fill="#19D86F">
        {/* Left slash */}
        <path d="M34 30 H49 L37 70 H22 Z" />
        {/* Right slash */}
        <path d="M59 30 H74 L62 70 H47 Z" />
      </g>
    </svg>
  );
}

/* Coinbase brand mark — blue coin with a white ring. */
function CoinbaseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#0052FF" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#FFFFFF" strokeWidth="2.7" />
    </svg>
  );
}

/* Maya brand mark — green coin with a white M. */
function MayaMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="12" fill="#22C55E" />
      <text x="12" y="16.4" textAnchor="middle" fontSize="12" fontWeight="700" fill="#FFFFFF" fontFamily="sans-serif">M</text>
    </svg>
  );
}

/* ── App-icon tiles (rounded-square brand marks, like a phone home screen) ── */
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
function CoinbaseAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[#0052FF] flex items-center justify-center ${className}`}>
      <svg viewBox="0 0 24 24" className="w-[58%] h-[58%]"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" strokeWidth="3.4" /></svg>
    </div>
  );
}
function CoinsPhAppIcon({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-[16px] bg-[#1652F0] flex items-center justify-center ${className}`}>
      <span className="text-white font-bold leading-none" style={{ fontSize: "52%" }}>C<span className="text-[#7FE7D0]">.</span></span>
    </div>
  );
}

/* USDC mark — clean blue coin with a crisp white dollar glyph (matches the project's
   dollar-circle.svg style; the official usdc.svg glyph looked thin/odd at chip size). */
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

/* Base mark — the project's Base Account brand (public/icons/base-account.svg):
   a rounded blue square with a white circle and inner blue square. */
function BaseMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 512 512" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="96" fill="#0957FF" />
      <circle cx="256" cy="256" r="180" fill="#FFFFFF" />
      <rect x="198" y="198" width="116" height="116" rx="12" fill="#0957FF" />
    </svg>
  );
}

/* Compact "you're sending / you'll receive" summary with the payout footer. */
function AmountCard({ receive, payout }: { receive: React.ReactNode; payout: React.ReactNode }) {
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

/* Collapsible "How this works" — collapsed by default so the form and CTA are reachable
   without scrolling past a wall of text. Tap to expand the explanation. */
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

/* Combined "How this works" + steps — one collapsible (exchange flows): intro blurb
   followed by the numbered step list, all behind a single tap. */
function HowItWorks({ intro, steps }: { intro: React.ReactNode; steps: FlowStep[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-[10px] px-[16px] py-[14px] text-left">
        <Info className="w-[18px] h-[18px] text-[var(--accent)] shrink-0" />
        <p className="flex-1 text-[15px] text-[var(--ink)]" style={{ fontWeight: 590 }}>How this works</p>
        <ChevronRight className={`w-[18px] h-[18px] text-[var(--border-strong)] shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="px-[16px] pb-[16px] pt-[2px] border-t border-[var(--surface-grey)]">
          <p className="text-[13px] text-[var(--text-2)] leading-[19px] pt-[12px] pb-[14px]">{intro}</p>
          <StepList steps={steps} bare />
        </div>
      )}
    </Card>
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


/* ─── SCREEN 1: Withdraw your USDC — funded summary + cash-out picker ─── */
function CelebrateScreen({ onWithdraw, onLater }: { onWithdraw: (p: Provider) => void; onLater: () => void }) {
  const [selected, setSelected] = useState<Provider>("moneybees");

  const NAMES: Record<Provider, string> = {
    moneybees: "Moneybees", binance: "Binance", coinsph: "Coins.ph",
    gcash: "GCash", pdax: "PDAX", coinbase: "Coinbase",
  };

  const Row = ({ id, icon, name, line1, line2, recommended }: {
    id: Provider; icon: React.ReactNode; name: string; line1: string; line2: string; recommended?: boolean;
  }) => {
    const active = selected === id;
    return (
      <button onClick={() => setSelected(id)} className="relative w-full text-left outline-none">
        {recommended && (
          <div className="absolute -top-[9px] left-[14px] z-10 bg-[var(--primary)] rounded-full px-[7px] py-[2px] shadow-sm flex items-center justify-center">
            <span className="text-[8px] font-bold text-white uppercase tracking-[0.4px] leading-none">Recommended</span>
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
  };

  return (
    <div className="absolute inset-0 bg-[var(--surface)] flex flex-col">
      <div className="flex-1 overflow-y-auto px-[22px] pt-[max(44px,env(safe-area-inset-top))]">
        {/* Compact header */}
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
            {LOAN_USDC} USDC available · Repay <span className="font-semibold text-[var(--primary)]">{REPAY_USDC} USDC</span> by {DUE_DATE}
          </p>
        </div>

        {/* Picker */}
        <p className="text-[18px] text-[var(--ink)] mt-[10px] mb-[18px]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>How would you like to cash out?</p>
        <div className="space-y-[10px]">
          <Row id="moneybees" recommended icon={<MoneybeesAppIcon className="w-[46px] h-[46px]" />} name="Moneybees" line1="Assisted cash out" line2="Bank, GCash or Maya" />
          <Row id="binance" icon={<BinanceAppIcon className="w-[46px] h-[46px]" />} name="Binance" line1="Self-service" line2="Send to exchange" />
          <Row id="pdax" icon={<PdaxAppIcon className="w-[46px] h-[46px]" />} name="PDAX" line1="Self-service" line2="Send to app" />
          <Row id="gcash" icon={<GCashAppIcon className="w-[46px] h-[46px]" />} name="GCash" line1="Self-service" line2="Send to GCrypto" />
        </div>

        {/* Base-only note — self-service only (Moneybees handles rate/network for you) */}
        {selected !== "moneybees" && <BaseOnlyNotice className="mt-[12px]" />}
        <div className="h-[12px]" />
      </div>

      {/* Pinned CTA — always visible without scrolling */}
      <div className="px-[22px] pt-[12px] pb-[max(14px,env(safe-area-inset-bottom))] bg-[var(--surface)] border-t border-[var(--divider)] space-y-[6px]">
        <PrimaryBtn onClick={() => onWithdraw(selected)}>
          Continue with {NAMES[selected]} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
        <button onClick={onLater} className="w-full text-center text-[14px] font-semibold text-[var(--primary)] py-[8px] hover:underline">
          I'll do this later
        </button>
      </div>
    </div>
  );
}

/* ─── SCREEN 2: Withdrawal screen ───────────────────────────────── */

/* Reusable fintech-style self-serve flow — amount card, "How this works", numbered
   steps with icons, address/amount inputs, compact Base warning. Used for GCash
   GCrypto, PDAX, Coins.ph, and Coinbase. Framed as "add receiving address" not
   "enter deposit address" — fintech language, not crypto tutorial. */
type AppFlowConfig = {
  name: string;
  short: string;
  howItWorks: string;
  payout: string;
  receiveCurrency: string;
  steps: FlowStep[];
  cashOutTitle: string;
  cashOutIntro: string;
  cashOutSteps: { title: React.ReactNode; helper?: React.ReactNode }[];
};

function AppFlow({ cfg }: { cfg: AppFlowConfig }) {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showCashOut, setShowCashOut] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const addrValid = isValidAddress(address);
  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= LOAN_USDC;
  const canReview = addrValid && amtValid && confirmed;

  return (
    <div className="space-y-[12px]">
      {/* Amount card */}
      <AmountCard
        receive={<ReceiveEstimate currency={cfg.receiveCurrency} usdcAmount={amtValid ? amtNum : LOAN_USDC} />}
        payout={<>Payout to <span className="font-semibold text-[var(--ink)]">{cfg.payout}</span></>}
      />

      {/* How this works + steps — one collapsible, collapsed by default */}
      <HowItWorks intro={cfg.howItWorks} steps={cfg.steps} />

      {/* Base warning */}
      <BaseOnlyNotice />

      {/* Address + amount inputs */}
      <Card className="p-[16px] space-y-[12px]">
        <p className="text-[16px] text-[var(--ink)]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Add your {cfg.short} receiving address</p>
        <div className="space-y-[6px]">
          <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
            <div aria-hidden className={`absolute inset-0 rounded-[12px] border pointer-events-none ${address && !addrValid ? "border-[var(--danger)]" : "border-[var(--border-strong)]"}`} />
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder={`${cfg.short} receiving address`}
              className="flex-1 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none w-full" />
            <button onClick={() => setShowScan(true)}
              title="Scan QR code" className="pr-[14px] pl-[8px] text-[var(--accent)] hover:text-[var(--primary)] shrink-0">
              <ScanLine className="w-[20px] h-[20px]" />
            </button>
          </div>
          {address && !addrValid && <p className="text-[12px] text-[var(--danger)] leading-[18px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Doesn't look like a valid wallet address.</p>}
          {addrValid && <p className="text-[12px] text-[var(--green)] leading-[18px] flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" />Valid address. Confirm {cfg.short} shows USDC on Base.</p>}
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

      {/* Confirmation */}
      <label className="flex items-start gap-[10px] cursor-pointer">
        <div onClick={() => setConfirmed(!confirmed)}
          className={`w-[20px] h-[20px] rounded-[6px] border-2 flex items-center justify-center shrink-0 mt-[1px] transition-all ${confirmed ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-[var(--surface)] border-[var(--border-strong)]"}`}>
          {confirmed && <Check className="w-[12px] h-[12px] text-white" strokeWidth={3} />}
        </div>
        <p className="text-[14px] leading-[21px] tracking-[-0.28px] text-[var(--ink-2)]">I confirm this is my {cfg.short} receiving address for <span className="font-semibold">USDC on Base</span>.</p>
      </label>
      <PrimaryBtn disabled={!canReview} onClick={() => setShowReview(true)}>
        Send {amount || "0"} USDC to {cfg.short} <ArrowRight className="w-4 h-4" />
      </PrimaryBtn>

      {/* Cash out guide (after USDC arrives) */}
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
            {cfg.cashOutSteps.map((s, i) => (
              <TimelineStep key={i} n={i + 1} last={i === cfg.cashOutSteps.length - 1} title={s.title}>
                {s.helper && <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">{s.helper}</p>}
              </TimelineStep>
            ))}
          </div>
        )}
      </Card>

      {showReview && <ReviewModal exchange={cfg.name} amount={parseFloat(amount)} address={address} onClose={() => setShowReview(false)} />}
      {showScan && <QrScanner onResult={a => { setAddress(a); setShowScan(false); }} onClose={() => setShowScan(false)} />}
    </div>
  );
}

const GCASH_HELP = "https://help.gcash.com/hc/en-us/articles/10203149752601-How-can-I-receive-crypto-using-GCrypto";
const GCASH_FLOW: AppFlowConfig = {
  name: "GCash GCrypto",
  short: "GCash",
  receiveCurrency: "PHP",
  payout: "GCash balance",
  howItWorks: "Send USDC from your Moodeng wallet to your GCash GCrypto account. Once it arrives, sell it for pesos — it lands in your GCash wallet instantly.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open GCash GCrypto", desc: "Enjoy → GCrypto → Receive, network Base.", guide: { title: "How to open GCrypto in GCash", video: "m5-cD7v4SLg", link: { label: "Official GCash guide", url: GCASH_HELP }, steps: [
      "Open the GCash app and tap \"Enjoy\".",
      "Tap \"GCrypto\" — you need a fully-verified GCash account.",
      "Select USDC, then tap \"Receive\".",
      "Choose \"Base\" as the network.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your address", desc: "Copy your USDC-on-Base address.", guide: { title: "How to copy your GCrypto address", video: "m5-cD7v4SLg", link: { label: "Official GCash guide", url: GCASH_HELP }, steps: [
      "GCrypto shows your USDC-on-Base address with a QR code.",
      "Tap to copy the address, or screenshot the QR.",
      "Come back to Moodeng and paste it below.",
    ] } },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it here", desc: "Paste it in the field below." },
    { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm and send", desc: "We send it directly — arrives in ~1 min." },
  ],
  cashOutTitle: "Cash out to pesos in GCash",
  cashOutIntro: "Once your USDC is in GCrypto, sell it for pesos — it lands in your GCash wallet instantly.",
  cashOutSteps: [
    { title: <>In GCrypto, tap <span className="font-bold">Sell</span></> },
    { title: "Choose USDC and enter the amount" },
    { title: "Confirm — pesos go straight to your GCash balance" },
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
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open PDAX", desc: "Portfolio → USDC → Deposit, network Base.", guide: { title: "How to deposit crypto on PDAX", video: "q8F8H1UzBEU", link: { label: "Official PDAX guide", url: PDAX_DEPOSIT_HELP }, steps: [
      "Open the PDAX app and tap the Portfolio icon.",
      "Select USDC (USD Coin), then tap \"Deposit\".",
      "Choose \"Base\" as the network (shown as USDCBASE).",
      "Confirm it says Base before continuing.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your address", desc: "Copy your USDC-on-Base address.", guide: { title: "How to copy your PDAX address", video: "q8F8H1UzBEU", link: { label: "Official PDAX guide", url: PDAX_DEPOSIT_HELP }, steps: [
      "PDAX shows your USDC-on-Base deposit address and QR code.",
      "Tap to copy the address, or screenshot the QR.",
      "Come back to Moodeng and paste it below.",
    ] } },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it here", desc: "Paste it in the field below." },
    { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm and send", desc: "We send it directly — arrives in ~1 min." },
  ],
  cashOutTitle: "Cash out to pesos with PDAX",
  cashOutIntro: "Once your USDC is in PDAX, sell it for pesos and withdraw to your bank or e-wallet.",
  cashOutSteps: [
    { title: "Sell USDC for PHP in PDAX" },
    { title: "Withdraw the PHP to your bank or GCash / Maya" },
  ],
};

const COINSPH_FLOW: AppFlowConfig = {
  name: "Coins.ph",
  short: "Coins.ph",
  receiveCurrency: "PHP",
  payout: "Bank or GCash",
  howItWorks: "Send USDC from your Moodeng wallet to your Coins.ph account. Once it arrives, sell it for pesos and cash out to your bank or GCash.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open Coins.ph", desc: "Portfolio → USDC → Receive, check for Base.", guide: { title: "How to receive crypto on Coins.ph", link: { label: "Official Coins.ph guide", url: "https://support.coins.ph/hc/en-us/articles/26036127886873-How-to-deposit-cryptocurrency-to-your-Coins-ph-account" }, steps: [
      "Open the Coins.ph app and go to your Portfolio.",
      "Select USDC, then tap \"Receive\".",
    ] } },
    { icon: <AlertTriangle className="w-[19px] h-[19px] text-[var(--amber-icon-2)]" strokeWidth={2.2} />, title: "Confirm Base is supported", desc: "No Base in the network list? Stop — use GCash or PDAX.", guide: { title: "⚠️ Confirm Coins.ph shows Base", link: { label: "Coins.ph supported networks", url: "https://support.coins.ph/hc/en-us/articles/6133146885529-What-are-the-supported-networks-per-token-in-Coins-ph" }, steps: [
      "Coins.ph may not list Base for USDC (it shows Polygon, Arbitrum, etc.).",
      "If you do NOT see Base in the network list, STOP — do not send.",
      "Use GCash, PDAX, or Binance instead.",
      "Only continue if Coins.ph explicitly shows a Base address for USDC.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Get your receiving address", desc: "If Base shows, copy your address." },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it here", desc: "Paste it in the field below." },
    { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm and send", desc: "We send it directly — arrives in ~1 min." },
  ],
  cashOutTitle: "Cash out to pesos with Coins.ph",
  cashOutIntro: "Once your USDC arrives, sell it for pesos and cash out to your bank or e-wallet.",
  cashOutSteps: [
    { title: "Sell USDC for PHP in Coins.ph" },
    { title: "Cash out the PHP to your bank or GCash" },
  ],
};

const COINBASE_FLOW: AppFlowConfig = {
  name: "Coinbase",
  short: "Coinbase",
  receiveCurrency: "USD",
  payout: "Bank (ACH / SEPA)",
  howItWorks: "Send USDC from your Moodeng wallet to your Coinbase account. Coinbase runs Base, so deposits are free and instant. Then sell and withdraw to your bank.",
  steps: [
    { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open Coinbase", desc: "Send & Receive → Receive, network Base.", guide: { title: "How to receive USDC on Coinbase", link: { label: "Coinbase help", url: "https://help.coinbase.com/en/coinbase/trading-and-funding/cryptocurrency-trading-pairs/how-to-send-and-receive-cryptocurrency" }, steps: [
      "Open Coinbase and tap \"Send & Receive\", then \"Receive\".",
      "Search and select USD Coin (USDC).",
      "Choose \"Base\" as the network — deposits are free and fast.",
    ] } },
    { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your address", desc: "Copy your USDC-on-Base address." },
    { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it here", desc: "Paste it in the field below." },
    { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm and send", desc: "We send it directly — arrives in ~1 min." },
  ],
  cashOutTitle: "Cash out to your bank",
  cashOutIntro: "Once your USDC is in Coinbase, sell it and withdraw the cash to your bank.",
  cashOutSteps: [
    { title: "Sell USDC for your local currency" },
    { title: <>Withdraw to your bank via <span className="font-bold">ACH / SEPA</span> (often free)</> },
  ],
};

function BinanceFlow() {
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showP2P, setShowP2P] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const addrValid = isValidAddress(address);
  const amtNum = parseFloat(amount);
  const amtValid = !isNaN(amtNum) && amtNum > 0 && amtNum <= LOAN_USDC;
  const canReview = addrValid && amtValid && confirmed;

  return (
    <div className="space-y-[12px]">
      {/* Amount card */}
      <AmountCard
        receive={<ReceiveEstimate currency="PHP" usdcAmount={amtValid ? amtNum : LOAN_USDC} />}
        payout={<>Payout to <span className="font-semibold text-[var(--ink)]">GCash, Maya or Bank</span></>}
      />

      {/* How this works + steps — one collapsible, collapsed by default */}
      <HowItWorks intro="Send USDC from your Moodeng wallet to your Binance account. Once it arrives, sell it for pesos via Binance P2P — a peer-to-peer marketplace with escrow protection." steps={[
        { icon: <Download className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Open Binance", desc: "Wallet → Deposit → Crypto, USDC, network Base.", guide: { title: "How to find Deposit in Binance", video: "KAuoySzS0Mc", steps: [
          "Open the Binance app and sign in.",
          "Tap \"Wallet\" in the bottom bar.",
          "Tap \"Deposit\", then choose \"Deposit Crypto\".",
          "Search and select USDC (not USDT).",
          "Choose \"Base\" as the network — not BEP20, ERC20, or TRC20.",
        ] } },
        { icon: <Copy className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Copy your address", desc: "Copy your USDC-on-Base address.", guide: { title: "How to copy your deposit address", video: "I-IYLoBTdEQ", steps: [
          "On the Binance deposit screen, you'll see a long address and a QR code.",
          "Tap \"Copy Address\" — or take a screenshot of the QR code.",
          "Come back to Moodeng and paste it below.",
        ] } },
        { icon: <ClipboardCheck className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Paste it here", desc: "Paste it in the field below." },
        { icon: <Lock className="w-[19px] h-[19px] text-[var(--accent)]" strokeWidth={2.2} />, title: "Confirm and send", desc: "We send it directly — arrives in ~1 min." },
      ]} />

      {/* Base warning */}
      <BaseOnlyNotice />

      {/* Address + amount inputs */}
      <Card className="p-[16px] space-y-[12px]">
        <p className="text-[16px] text-[var(--ink)]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Add your Binance receiving address</p>
        <div className="space-y-[6px]">
          <div className="bg-[var(--surface)] rounded-[12px] relative overflow-hidden flex items-center" style={{ boxShadow: "0px 2px 4px rgba(27,28,29,0.04)" }}>
            <div aria-hidden className={`absolute inset-0 rounded-[12px] border pointer-events-none ${address && !addrValid ? "border-[var(--danger)]" : "border-[var(--border-strong)]"}`} />
            <input value={address} onChange={e => setAddress(e.target.value)} placeholder="Binance receiving address"
              className="flex-1 px-[16px] py-[12px] bg-transparent text-[16px] leading-[24px] tracking-[-0.32px] text-[var(--ink)] placeholder:text-[var(--text-muted)] focus:outline-none w-full" />
            <button onClick={() => setShowScan(true)}
              title="Scan QR code" className="pr-[14px] pl-[8px] text-[var(--accent)] hover:text-[var(--primary)] shrink-0">
              <ScanLine className="w-[20px] h-[20px]" />
            </button>
          </div>
          {address && !addrValid && <p className="text-[12px] text-[var(--danger)] leading-[18px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Doesn't look like a valid wallet address.</p>}
          {addrValid && <p className="text-[12px] text-[var(--green)] leading-[18px] flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" />Valid address. Confirm Binance shows USDC on Base.</p>}
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

      {/* Confirmation */}
      <label className="flex items-start gap-[10px] cursor-pointer">
        <div onClick={() => setConfirmed(!confirmed)}
          className={`w-[20px] h-[20px] rounded-[6px] border-2 flex items-center justify-center shrink-0 mt-[1px] transition-all ${confirmed ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-[var(--surface)] border-[var(--border-strong)]"}`}>
          {confirmed && <Check className="w-[12px] h-[12px] text-white" strokeWidth={3} />}
        </div>
        <p className="text-[14px] leading-[21px] tracking-[-0.28px] text-[var(--ink-2)]">I confirm this is my Binance receiving address for <span className="font-semibold">USDC on Base</span>.</p>
      </label>
      <PrimaryBtn disabled={!canReview} onClick={() => setShowReview(true)}>
        Send {amount || "0"} USDC to Binance <ArrowRight className="w-4 h-4" />
      </PrimaryBtn>

      {/* P2P cash-out guide */}
      <Card className="overflow-hidden">
        <button onClick={() => setShowP2P(v => !v)} className="w-full flex items-center gap-[12px] px-[16px] py-[14px] text-left">
          <BinanceAppIcon className="w-[36px] h-[36px] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.4px]">After it arrives</p>
            <p className="text-[15px] text-[var(--ink)] tracking-[-0.3px]" style={{ fontWeight: 590 }}>Cash out to pesos with Binance P2P</p>
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
              Once your {amount || LOAN_USDC} USDC shows in Binance, sell it for pesos to a verified buyer — Binance holds the crypto in escrow until you're paid.
            </p>
            <TimelineStep n={1} title={<>Open <span className="font-bold">P2P Trading → Sell → USDC</span></>} />
            <TimelineStep n={2} title={<>Choose <span className="font-bold">PHP</span> and your payout method</>}>
              <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">GCash, Maya, or bank transfer (BDO, BPI, etc.).</p>
            </TimelineStep>
            <TimelineStep n={3} title="Pick a trustworthy buyer">
              <p className="text-[13px] text-[var(--text-muted)] leading-[19px] tracking-[-0.26px]">Prefer a <span className="font-semibold text-[var(--ink)]">95%+ completion rate</span> and many completed trades.</p>
            </TimelineStep>
            <TimelineStep n={4} title="Enter the amount and place the order" />
            <TimelineStep n={5} last title="Release USDC only after pesos arrive">
              <div className="bg-[var(--danger-bg)] rounded-[8px] px-[10px] py-[6px] border border-[var(--danger-border)]">
                <p className="text-[12px] leading-[18px] tracking-[-0.24px] text-[var(--danger-text)]"><span className="font-bold">Never</span> tap "Release" until the peso payment is actually in your GCash/bank. Check it yourself first.</p>
              </div>
            </TimelineStep>
          </div>
        )}
      </Card>

      {showReview && <ReviewModal exchange="Binance" amount={parseFloat(amount)} address={address} onClose={() => setShowReview(false)} />}
      {showScan && <QrScanner onResult={a => { setAddress(a); setShowScan(false); }} onClose={() => setShowScan(false)} />}
    </div>
  );
}

/* Chat-app brand icons (Telegram, Viber, WhatsApp) for the Moneybees handoff. */
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
      {/* Single speech bubble — the bottom-left corner pulls down into the tail */}
      <path fill="none" stroke="#fff" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
        d="M18 12 H31 A7 7 0 0 1 38 19 V24 A7 7 0 0 1 31 31 H17 L10.5 35.5 L11 27.5 V19 A7 7 0 0 1 18 12 Z" />
      {/* Phone handset */}
      <path fill="#fff" d="M21 17.4c-.8.1-1.4.9-1.3 1.7.6 4.6 4.3 8.3 8.9 8.9.8.1 1.6-.5 1.7-1.3l.2-1.9c.1-.6-.3-1.2-.9-1.5l-2.1-.9c-.5-.2-1.1-.1-1.5.3l-.7.7c-1.5-.8-2.7-2-3.5-3.5l.7-.7c.4-.4.5-1 .3-1.5l-.9-2.1c-.3-.6-.9-1-1.5-.9z" />
      {/* Signal arcs */}
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

/* Moneybees — assisted (no deposit-address). KYC + chat handoff + consent. */
function MoneybeesFlow() {
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState<"form" | "pending" | "done">("form");
  const [showShare, setShowShare] = useState(false);

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
      {/* Amount card */}
      <AmountCard
        receive={<>
          <p className="text-[19px] font-semibold text-[var(--ink)] tracking-[-0.4px] mt-[4px]">PHP</p>
          <p className="text-[11px] text-[var(--text-faint)] leading-[15px] mt-[2px]">Rate set by Moneybees</p>
        </>}
        payout={<>Payout to <span className="font-semibold text-[var(--ink)]">Bank</span>, <span className="font-semibold text-[var(--ink)]">GCash</span>, or <span className="font-semibold text-[var(--ink)]">Maya</span></>}
      />

      {/* How this works */}
      <HowThisWorks>Moneybees is a BSP/AMLC-registered cash-out provider. They handle KYC, exchange rate, transaction details, and PHP payout directly with you.</HowThisWorks>

      {/* Your cash-out steps */}
      <div>
        <p className="text-[16px] text-[var(--ink)] mb-[8px]" style={{ fontWeight: 590, letterSpacing: "-0.02em" }}>Your cash-out steps</p>
        <StepList steps={steps} />
      </div>

      {/* Consent */}
      <label className="flex items-start gap-[10px] rounded-[14px] border border-[var(--border-card)] bg-[var(--surface)] p-[14px] cursor-pointer" style={{ boxShadow: "0px 1px 3px rgba(27,28,29,0.04)" }}>
        <div onClick={(e) => { e.preventDefault(); setConsent(!consent); }} className={`w-[20px] h-[20px] rounded-[6px] border-2 flex items-center justify-center shrink-0 mt-[1px] transition-all ${consent ? "bg-[var(--primary)] border-[var(--primary)]" : "bg-[var(--surface)] border-[var(--border-strong)]"}`}>
          {consent && <Check className="w-[12px] h-[12px] text-white" strokeWidth={3} />}
        </div>
        <div>
          <p className="text-[13px] text-[var(--ink-2)] leading-[18px]">I agree to share my name, contact info, and cash-out amount with Moneybees.</p>
          <button type="button" onClick={(e) => { e.preventDefault(); setShowShare(v => !v); }} className="text-[12px] text-[var(--primary)] font-semibold mt-[5px] inline-block hover:underline">
            {showShare ? "Hide details" : "Learn more about how we share data"}
          </button>
          {showShare && (
            <div className="mt-[8px] rounded-[10px] bg-[var(--app-bg)] border border-[var(--border-card)] p-[10px] space-y-[5px]">
              {["Your full name (as verified with Moodeng)", "Your contact details for the chat handoff", "This cash-out's USDC amount"].map(t => (
                <div key={t} className="flex gap-[7px]"><Check className="w-[13px] h-[13px] text-[var(--green)] shrink-0 mt-[2px]" /><p className="text-[12px] text-[var(--text-2)] leading-[17px]">{t}</p></div>
              ))}
              <p className="text-[11px] text-[var(--text-faint)] leading-[16px] pt-[2px]">Shared only for this request, only after you tap Continue. Nothing is shared if you don't proceed.</p>
            </div>
          )}
        </div>
      </label>

      {/* CTAs — self-contained KYC handoff → chat handoff */}
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
          <PrimaryBtn disabled={!consent} onClick={() => setPhase("pending")}>Continue to Moneybees KYC <ArrowRight className="w-4 h-4" /></PrimaryBtn>
          <SecondaryBtn onClick={() => setPhase("done")}>I already have Moneybees KYC</SecondaryBtn>
        </>
      )}
    </div>
  );
}

const PROVIDER_TITLES: Record<Provider, string> = {
  moneybees: "Cash out with Moneybees",
  binance: "Send to Binance",
  coinsph: "Send to Coins.ph",
  gcash: "Send to GCash",
  pdax: "Send to PDAX",
  coinbase: "Send to Coinbase",
};

function WithdrawScreen({ provider, onBack }: { provider: Provider; onBack: () => void }) {
  return (
    <div className="absolute inset-0 bg-[var(--app-bg)] flex flex-col pt-[env(safe-area-inset-top,0px)] w-full">
      {/* Nav */}
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
            : provider === "coinsph" ? <AppFlow cfg={COINSPH_FLOW} />
            : <AppFlow cfg={COINBASE_FLOW} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Root ───────────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState<Screen>("celebrate");
  const [withdrawVisible, setWithdrawVisible] = useState(false);
  const [provider, setProvider] = useState<Provider>("moneybees");
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("wf-theme");
    if (saved) return saved === "dark";
    return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    try { localStorage.setItem("wf-theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  function goWithdraw(p: Provider) {
    setProvider(p);
    setScreen("withdraw");
    // small tick so the element mounts before opacity transition fires
    requestAnimationFrame(() => requestAnimationFrame(() => setWithdrawVisible(true)));
  }

  function goDismissed() {
    setScreen("dismissed");
  }

  return (
    <div style={{ fontFamily: FONT }} className="min-h-screen sm:min-h-[100dvh] bg-[#1a1a1a] sm:bg-[#000] flex items-center justify-center sm:p-[40px]">
      <div className={`${dark ? "dark" : ""} w-full h-[100dvh] sm:h-[844px] sm:w-[390px] bg-[var(--app-bg)] sm:rounded-[44px] sm:shadow-[0_0_0_8px_#111,0_0_0_12px_#333,0_30px_60px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col`}>
        {/* Dynamic Island Notch for desktop only */}
        <div className="hidden sm:block absolute top-0 inset-x-0 h-[34px] z-[60] pointer-events-none">
          <div className="mx-auto w-[120px] h-[34px] bg-[#111] rounded-b-[20px]" />
        </div>

        {/* Theme toggle */}
        <button onClick={() => setDark(d => !d)} aria-label="Toggle dark mode"
          className="absolute top-[max(12px,env(safe-area-inset-top))] right-[14px] z-[70] w-[34px] h-[34px] rounded-full bg-[var(--surface)] border border-[var(--border-card-2)] flex items-center justify-center text-[var(--accent)] transition-colors hover:bg-[var(--surface-grey)]"
          style={{ boxShadow: "0px 2px 8px rgba(0,0,0,0.12)" }}>
          {dark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
        </button>

        {/* Selected provider's withdrawal flow */}
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

        {/* Combined funded + method picker overlays everything */}
        {screen === "celebrate" && (
          <div className="absolute inset-0 bg-[var(--app-bg)] flex items-end justify-center z-10">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 opacity-20">
              <div className="w-48 h-3 bg-[var(--border-strong)] rounded-full" />
              <div className="w-32 h-3 bg-[var(--border-strong)] rounded-full" />
            </div>
            <CelebrateScreen
              onWithdraw={goWithdraw}
              onLater={goDismissed}
            />
          </div>
        )}

        {/* After "I'll do this later" — placeholder + a button to re-open the picker */}
        {screen === "dismissed" && (
          <div className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50">
            <button
              onClick={() => setScreen("celebrate")}
              className="flex items-center gap-2 bg-[var(--primary)] text-white text-[14px] font-semibold px-[20px] py-[12px] rounded-full shadow-lg hover:bg-[var(--primary-hover)] transition-all active:scale-[0.97] whitespace-nowrap"
            >
              <ArrowRight className="w-4 h-4" /> Withdraw your USDC
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
