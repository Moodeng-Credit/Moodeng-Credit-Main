import { useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import type { DashboardV2Language } from '@/views/dashboard-v2/types';

// "How much do you earn a month?" (2026-11-27): borrowers who never answered got the default ladder. One
// tap saves users.monthly_income (same bands as the bio form), which sets a limit that fits them. Shown
// only while my_limit_ceiling says source 'sign_up' and answered false. Never labels anyone's ladder.

const BANDS = [
   { value: 'under_200', label: 'Under ₱12k' },
   { value: '200_400', label: '₱12k–23k' },
   { value: '400_700', label: '₱23k–41k' },
   { value: '700_plus', label: '₱41k+' }
] as const;

const COPY: Record<DashboardV2Language, { title: string; body: string; thanks: string }> = {
   en: { title: 'How much do you earn a month?', body: 'It helps us set a limit that fits you.', thanks: 'Thanks! Saved.' },
   fil: { title: 'Magkano ang kita mo kada buwan?', body: 'Para maitakda namin ang limit na bagay sa iyo.', thanks: 'Salamat! Na-save na.' }
};

export default function AddIncomeCard({ userId, language }: { userId: string; language: DashboardV2Language }) {
   const queryClient = useQueryClient();
   const [saved, setSaved] = useState(false);
   const [isSaving, setIsSaving] = useState(false);
   const copy = COPY[language] ?? COPY.en;

   const pick = async (band: string) => {
      setIsSaving(true);
      const { error } = await getSupabaseBrowserClient()
         .from('users')
         .update({ monthly_income: band } as Record<string, unknown>)
         .eq('id', userId);
      setIsSaving(false);
      if (error) return;
      setSaved(true);
      void queryClient.invalidateQueries({ queryKey: ['my-limit-ceiling'] });
   };

   if (saved) {
      return (
         <p className="mx-5 rounded-[20px] bg-white px-4 py-3 text-[14px] font-semibold text-[#2f8a4a] shadow-[var(--dv2-shadow)] dark:bg-dv2-card">
            {copy.thanks}
         </p>
      );
   }

   return (
      <section
         className="mx-5 flex flex-col gap-3 rounded-[20px] bg-white px-4 py-4 shadow-[var(--dv2-shadow)] dark:bg-dv2-card"
         aria-label={copy.title}
      >
         <div>
            <p className="text-[17px] font-semibold text-[#040033] dark:text-[#F0EAFF]">{copy.title}</p>
            <p className="mt-0.5 text-[14px] text-[#70617F] dark:text-[#A89BB8]">{copy.body}</p>
         </div>
         <div className="grid grid-cols-2 gap-2">
            {BANDS.map((band) => (
               <button
                  key={band.value}
                  type="button"
                  disabled={isSaving}
                  onClick={() => void pick(band.value)}
                  className="h-11 rounded-2xl bg-[#F3EEFB] text-[15px] font-semibold text-[#5640e0] transition-transform duration-150 active:scale-[0.96] disabled:opacity-60 dark:bg-[#2A2138] dark:text-[#c4b8ff]"
               >
                  {band.label}
               </button>
            ))}
         </div>
      </section>
   );
}
