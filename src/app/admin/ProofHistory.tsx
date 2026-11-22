'use client';

import IncomeDocsSection from '@/app/admin/IncomeDocsSection';
import PreScreeningSection from '@/app/admin/PreScreeningSection';
import ProofRequestsSection from '@/app/admin/ProofRequestsSection';

/**
 * Everything one borrower ever sent us as proof, with the AI's read of each: proof of income (page or
 * Messenger), their pre-screening (answers, proof photos, score) and proof requests after a call.
 * Team only — on the Call sheet and their account in Admin → Users, so a case is decided with all of it.
 */
export default function ProofHistory({ userId }: { userId: string }) {
   return (
      <div className="space-y-5 rounded-2xl border border-[#2a1453] bg-[#14062b] p-4 text-white">
         <p className="text-base font-black text-white">🗂️ Proof history · team only</p>
         <IncomeDocsSection userId={userId} />
         <PreScreeningSection userId={userId} />
         <ProofRequestsSection userId={userId} />
      </div>
   );
}
