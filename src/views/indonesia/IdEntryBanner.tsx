import { useMemo } from 'react';

import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useGeoCheck } from '@/hooks/useGeoCheck';

import { ID_PATHS } from '@/lib/idTrack';
import { GOLD_GRADIENT, looksIndonesian, useIdTrackSwitch } from '@/views/indonesia/idFlow';

/**
 * On /sign-up and /sign-in: a visitor from Indonesia (IP country) is pointed to /id, the Indonesian
 * entry (Telegram sign-up, their own onboarding). The other sign-in methods stay available below it.
 * Shown only while the Indonesia track is open ('test' or 'on').
 */
export default function IdEntryBanner() {
   // Only phones set to Indonesia ask the server for the IP country (no extra call for everyone else).
   const likely = useMemo(looksIndonesian, []);
   const geo = useGeoCheck(!likely);
   const isIndonesia = likely && !geo.loading && geo.countryCode === 'ID';
   const track = useIdTrackSwitch(isIndonesia);
   if (!isIndonesia || !track.data || track.data === 'off') return null;
   return (
      <div data-i18n-skip className="sticky top-0 z-30 w-full px-3 pt-2">
         <Link
            to={ID_PATHS.landing}
            className="mx-auto flex min-h-[56px] w-full max-w-[440px] items-center gap-3 rounded-[18px] px-4 py-2 text-[#4a2a00] shadow-[0_4px_0_#d99a00,0_8px_18px_rgba(255,190,26,0.3)] active:translate-y-[1px]"
            style={{ backgroundImage: GOLD_GRADIENT }}
         >
            <span aria-hidden="true" className="text-[24px] leading-none">
               🇮🇩
            </span>
            <span className="min-w-0 flex-1 text-[17px] font-extrabold leading-[21px]">Dari Indonesia? Daftar lewat Telegram</span>
            <ChevronRight aria-hidden="true" className="size-6 shrink-0" strokeWidth={3} />
         </Link>
      </div>
   );
}
