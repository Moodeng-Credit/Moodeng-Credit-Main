'use client';

// On-chain activity for the Moodeng admin/originator wallet and LoanManager
// contract on Base Mainnet, sourced from a Dune dashboard.
//
// This embeds Dune's per-chart "embed" iframes rather than the whole dashboard
// page: those /embeds/<query_id>/<viz_id>/<token> URLs are the endpoint Dune
// designed specifically for iframing (unlike dune.com itself, which is not
// meant to be framed), so the charts render without any extra auth here.
// The Dune dashboard was made public so these embeds resolve without a login.
//
// Dashboard (source of truth for queries/charts):
// https://dune.com/snak2e/moodeng-protocol-on-chain-base

const ADMIN_WALLET = '0xC1022456DFd3BF36af1dA553cd5631F9e76ca8D6';
const LOAN_MANAGER = '0x15c3999a6E00AEb2Dc41a82b894b5C81CaFE7C89';
const DASHBOARD_URL = 'https://dune.com/snak2e/moodeng-protocol-on-chain-base';

type ChartEmbed = {
   title: string;
   embedUrl: string;
   /** Taller charts (time series) vs. compact ones (counters, small tables). */
   height?: number;
};

// Query/viz IDs match src/../ (see memory: moodeng-dune-dashboard.md for the
// full list). Update here if a chart is regenerated on Dune with a new viz id.
const CHARTS: ChartEmbed[] = [
   {
      title: 'Total USDC disbursed',
      embedUrl: 'https://dune.com/embeds/8395564/12399730',
      height: 220
   },
   {
      title: 'Daily USDC in/out',
      embedUrl: 'https://dune.com/embeds/8395559/12399729',
      height: 420
   },
   {
      title: 'Admin wallet activity over time',
      embedUrl: 'https://dune.com/embeds/8394773/12399732',
      height: 420
   },
   {
      title: 'LoanManager calls & unique users',
      embedUrl: 'https://dune.com/embeds/8394777/12399733',
      height: 420
   },
   {
      title: 'Top counterparties',
      embedUrl: 'https://dune.com/embeds/8394776/12399735',
      height: 420
   },
   {
      title: 'Admin wallet ETH in/out',
      embedUrl: 'https://dune.com/embeds/8394774/12399749',
      height: 420
   },
   {
      title: 'Top ERC-20 tokens moved',
      embedUrl: 'https://dune.com/embeds/8394775/12399750',
      height: 420
   }
];

function shortAddr(address: string): string {
   return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function ChartCard({ chart }: { chart: ChartEmbed }) {
   return (
      <div className="overflow-hidden rounded-2xl border border-[#2a1453] bg-[#1c0a3a]">
         <div className="border-b border-[#2a1453] px-4 py-3">
            <p className="text-xs font-black uppercase tracking-wide text-[#a89bb8]">{chart.title}</p>
         </div>
         <iframe
            src={chart.embedUrl}
            title={chart.title}
            height={chart.height ?? 420}
            width="100%"
            style={{ border: 0 }}
            loading="lazy"
         />
      </div>
   );
}

export default function OnChainSection() {
   return (
      <div className="space-y-6">
         <div className="rounded-2xl border border-[#2a1453] bg-[#1c0a3a] p-5">
            <p className="text-sm text-[#a89bb8]">
               Base Mainnet activity for the admin/originator wallet{' '}
               <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#a06bff]">{shortAddr(ADMIN_WALLET)}</code> (a smart-contract wallet — its
               actions show up as internal calls, not top-level transactions) and the{' '}
               <code className="rounded bg-black/30 px-1.5 py-0.5 text-[#a06bff]">{shortAddr(LOAN_MANAGER)}</code> LoanManager contract.{' '}
               <strong className="text-white">USDC out</strong> ≈ loan disbursements, <strong className="text-white">USDC in</strong> ≈
               repayments/funding. On-chain volume is still early-stage — treat this as protocol monitoring, not business-scale reporting.
            </p>
            <a
               href={DASHBOARD_URL}
               target="_blank"
               rel="noreferrer"
               className="mt-3 inline-block text-xs font-black text-[#a06bff] hover:underline"
            >
               Open full dashboard on Dune ↗
            </a>
         </div>

         <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {CHARTS.map((chart) => (
               <ChartCard key={chart.embedUrl} chart={chart} />
            ))}
         </div>
      </div>
   );
}
