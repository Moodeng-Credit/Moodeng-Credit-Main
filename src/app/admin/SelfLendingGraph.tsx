'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

import type { DetectionAccount, DetectionOverview } from './adminSupabase';

type LinkKind = 'loan' | 'wallet' | 'email' | 'ip' | 'subnet';

interface GNode {
   id: string;
   label: string;
   role: 'borrower' | 'lender' | 'unset';
   team: boolean;
   hotspot: boolean;
   x?: number;
   y?: number;
}

interface GLink {
   source: string;
   target: string;
   kind: LinkKind;
   circumstantial: boolean;
}

const ROLE_COLOR: Record<GNode['role'], string> = {
   borrower: '#4f8cff',
   lender: '#22c08a',
   unset: '#8a7fa8'
};

function linkColor(kind: LinkKind): string {
   if (kind === 'loan') return '#a855f7';
   if (kind === 'ip' || kind === 'subnet') return '#f5a524';
   return '#ff4d5e'; // wallet / email = strong
}

function roleOf(a: DetectionAccount): GNode['role'] {
   return a.role === 'borrower' || a.role === 'lender' ? a.role : 'unset';
}

// Turn the detection overview into a {nodes, links} graph. Accounts are nodes;
// shared wallet/email/IP/subnet and actual loans are edges. Any account that
// appears in a realized self-lending loan is flagged as a hotspot.
function buildGraph(data: DetectionOverview): { nodes: GNode[]; links: GLink[] } {
   const nodes = new Map<string, GNode>();
   const links = new Map<string, GLink>();

   const upsert = (a: DetectionAccount, hotspot = false) => {
      const existing = nodes.get(a.user_id);
      if (existing) {
         if (hotspot) existing.hotspot = true;
         if (a.role && existing.role === 'unset') existing.role = roleOf(a);
         return;
      }
      nodes.set(a.user_id, {
         id: a.user_id,
         label: a.username ?? a.user_id.slice(0, 8),
         role: roleOf(a),
         team: Boolean(a.whitelisted),
         hotspot
      });
   };

   const addLink = (s: string, t: string, kind: LinkKind) => {
      if (s === t) return;
      const [a, b] = s < t ? [s, t] : [t, s];
      const key = `${kind}:${a}:${b}`;
      if (links.has(key)) return;
      links.set(key, { source: s, target: t, kind, circumstantial: kind === 'ip' || kind === 'subnet' });
   };

   // Realized self-lending loans — strongest signal, both endpoints are hotspots.
   for (const loan of data.self_lending_loans) {
      upsert(loan.borrower, true);
      upsert(loan.lender, true);
      addLink(loan.borrower.user_id, loan.lender.user_id, 'loan');
      for (const link of loan.links) {
         if (link === 'shared_wallet' || link === 'same_wallet_on_loan') addLink(loan.borrower.user_id, loan.lender.user_id, 'wallet');
         else if (link === 'shared_email') addLink(loan.borrower.user_id, loan.lender.user_id, 'email');
         else if (link === 'shared_ip') addLink(loan.borrower.user_id, loan.lender.user_id, 'ip');
         else if (link === 'shared_subnet') addLink(loan.borrower.user_id, loan.lender.user_id, 'subnet');
      }
   }

   // Account clusters that share an identity — connect each cluster. Small
   // clusters get pairwise edges; larger ones star off the first account to
   // keep the edge count sane.
   const connectCluster = (accounts: DetectionAccount[], kind: LinkKind) => {
      accounts.forEach((a) => upsert(a));
      if (accounts.length <= 1) return;
      if (accounts.length <= 6) {
         for (let i = 0; i < accounts.length; i++)
            for (let j = i + 1; j < accounts.length; j++) addLink(accounts[i].user_id, accounts[j].user_id, kind);
      } else {
         const anchor = accounts[0].user_id;
         for (let i = 1; i < accounts.length; i++) addLink(anchor, accounts[i].user_id, kind);
      }
   };

   for (const c of data.shared_wallets) connectCluster(c.accounts, 'wallet');
   for (const c of data.email_collisions) connectCluster(c.accounts, 'email');
   for (const c of data.shared_ips) connectCluster(c.accounts, 'ip');
   for (const c of data.subnet_clusters) connectCluster(c.accounts, 'subnet');

   return { nodes: [...nodes.values()], links: [...links.values()] };
}

interface Props {
   data: DetectionOverview;
}

export default function SelfLendingGraph({ data }: Props) {
   const wrapRef = useRef<HTMLDivElement>(null);
   const [width, setWidth] = useState(640);
   const [showCirc, setShowCirc] = useState(true);

   useEffect(() => {
      const el = wrapRef.current;
      if (!el) return;
      const ro = new ResizeObserver((entries) => {
         const w = entries[0]?.contentRect.width;
         if (w) setWidth(Math.floor(w));
      });
      ro.observe(el);
      return () => ro.disconnect();
   }, []);

   const full = useMemo(() => buildGraph(data), [data]);
   const graphData = useMemo(() => {
      if (showCirc) return full;
      const links = full.links.filter((l) => !l.circumstantial);
      return { nodes: full.nodes, links };
   }, [full, showCirc]);

   const empty = graphData.nodes.length === 0;

   return (
      <div className="rounded-3xl border border-[#2a1453] bg-[#160a2e] p-4">
         <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
               <Legend swatch="#4f8cff" label="Borrower" />
               <Legend swatch="#22c08a" label="Lender" />
               <Legend swatch="#8a7fa8" label="Unset" />
               <Legend line="#ff4d5e" label="Wallet / email" />
               <Legend line="#f5a524" label="IP / subnet" />
               <Legend line="#a855f7" label="Loan" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-[#a89bb8]">
               <input type="checkbox" checked={showCirc} onChange={(e) => setShowCirc(e.target.checked)} />
               show circumstantial (IP/subnet)
            </label>
         </div>

         <div ref={wrapRef} className="overflow-hidden rounded-2xl">
            {empty ? (
               <div className="flex h-[300px] items-center justify-center text-2xl font-black text-[#6f6385]">
                  No linked accounts to plot.
               </div>
            ) : (
               <ForceGraph2D
                  graphData={graphData}
                  width={width}
                  height={460}
                  backgroundColor="rgba(0,0,0,0)"
                  cooldownTicks={120}
                  linkColor={(l) => linkColor((l as GLink).kind)}
                  linkWidth={(l) => ((l as GLink).kind === 'loan' ? 3 : (l as GLink).circumstantial ? 1.4 : 2.4)}
                  linkDirectionalArrowLength={(l) => ((l as GLink).kind === 'loan' ? 4 : 0)}
                  linkDirectionalArrowRelPos={1}
                  nodeLabel={(n) => {
                     const node = n as GNode;
                     return `${node.label}${node.team ? ' · team' : ''} · ${node.role}${node.hotspot ? ' · ⚠ hotspot' : ''}`;
                  }}
                  nodeCanvasObject={(n, ctx, scale) => {
                     const node = n as GNode;
                     const r = node.hotspot ? 7 : 5.5;
                     ctx.globalAlpha = node.team ? 0.45 : 1;
                     ctx.beginPath();
                     ctx.arc(node.x ?? 0, node.y ?? 0, r, 0, 2 * Math.PI);
                     ctx.fillStyle = ROLE_COLOR[node.role];
                     ctx.fill();
                     ctx.globalAlpha = 1;
                     if (node.hotspot) {
                        ctx.lineWidth = 2 / scale;
                        ctx.strokeStyle = '#ff4d5e';
                        ctx.stroke();
                     } else if (node.team) {
                        ctx.lineWidth = 1.2 / scale;
                        ctx.setLineDash([2 / scale, 2 / scale]);
                        ctx.strokeStyle = '#c9b8ff';
                        ctx.stroke();
                        ctx.setLineDash([]);
                     }
                     const fontSize = Math.max(9 / scale, 2.2);
                     ctx.font = `${fontSize}px system-ui, sans-serif`;
                     ctx.textAlign = 'center';
                     ctx.fillStyle = 'rgba(231,226,240,0.85)';
                     ctx.fillText(node.label, node.x ?? 0, (node.y ?? 0) - r - fontSize * 0.4);
                  }}
                  nodePointerAreaPaint={(n, color, ctx) => {
                     const node = n as GNode;
                     ctx.beginPath();
                     ctx.arc(node.x ?? 0, node.y ?? 0, 9, 0, 2 * Math.PI);
                     ctx.fillStyle = color;
                     ctx.fill();
                  }}
               />
            )}
         </div>
         <p className="mt-3 px-1 text-xs font-medium text-[#a89bb8]">
            Each clump shares an identity. A node ringed in <span className="font-bold text-[#ff6b7a]">red</span> sits
            in a realized self-lending loan — investigate those first. Drag to pull clusters apart; scroll to zoom.
         </p>
      </div>
   );
}

function Legend({ swatch, line, label }: { swatch?: string; line?: string; label: string }) {
   return (
      <span className="inline-flex items-center gap-1.5 text-[#cfc6dd]">
         {swatch ? (
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: swatch }} />
         ) : (
            <span className="inline-block h-0 w-4 border-t-[3px]" style={{ borderColor: line }} />
         )}
         {label}
      </span>
   );
}
