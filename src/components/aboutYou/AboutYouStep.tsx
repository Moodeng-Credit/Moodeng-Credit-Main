import { useEffect, useState } from 'react';

import { Loader2 } from 'lucide-react';
import posthog from 'posthog-js';

import { useLocalization } from '@/i18n/LocalizationProvider';
import type { LocaleCode } from '@/i18n/translations';
import { type AboutGender, MAX_AGE, MIN_AGE, parkAboutYou, saveAboutYou } from '@/lib/aboutYou';
import { ConnectHero, PrimaryButton } from '@/views/dashboard/components/connectKit';

const ART = {
   family: '/hippos/about-you/family.webp',
   female: '/hippos/about-you/girl.webp',
   male: '/hippos/about-you/boy.webp'
} as const;

const COPY = {
   en: {
      title: 'About you',
      subtitle: '3 quick taps.',
      female: 'Woman',
      male: 'Man',
      age: 'Your age',
      kids: 'Kids',
      tooYoung: 'You must be 18 or older.',
      next: 'Continue',
      error: 'Couldn’t save. Try again.'
   },
   fil: {
      title: 'Tungkol sa’yo',
      subtitle: '3 mabilis na tap.',
      female: 'Babae',
      male: 'Lalaki',
      age: 'Edad mo',
      kids: 'Anak',
      tooYoung: 'Dapat 18 pataas ka.',
      next: 'Tuloy',
      error: 'Hindi na-save. Subukan ulit.'
   },
   id: {
      title: 'Tentang kamu',
      subtitle: '3 ketukan cepat.',
      female: 'Perempuan',
      male: 'Laki-laki',
      age: 'Umur kamu',
      kids: 'Anak',
      tooYoung: 'Kamu harus 18 tahun ke atas.',
      next: 'Lanjut',
      error: 'Gagal menyimpan. Coba lagi.'
   },
   th: {
      title: 'เกี่ยวกับคุณ',
      subtitle: 'แตะแค่ 3 ครั้ง',
      female: 'หญิง',
      male: 'ชาย',
      age: 'อายุของคุณ',
      kids: 'ลูก',
      tooYoung: 'ต้องอายุ 18 ปีขึ้นไป',
      next: 'ต่อไป',
      error: 'บันทึกไม่สำเร็จ ลองอีกครั้ง'
   },
   vi: {
      title: 'Về bạn',
      subtitle: '3 lần chạm nhanh.',
      female: 'Nữ',
      male: 'Nam',
      age: 'Tuổi của bạn',
      kids: 'Con',
      tooYoung: 'Bạn phải từ 18 tuổi.',
      next: 'Tiếp tục',
      error: 'Không lưu được. Thử lại.'
   }
} satisfies Record<LocaleCode, Record<string, string>>;

const KIDS = [0, 1, 2, 3, 4, 5] as const; // 5 = "5+"

const track = (action: 'shown' | 'answered' | 'save_failed', source: string, extra?: Record<string, unknown>) => {
   try {
      posthog.capture('about_you_step', { action, source, ...extra });
   } catch {
      // Analytics must never block the step.
   }
};

const label = 'text-[14px] font-bold text-[#594d65] dark:text-[#d9cfe8]';
const chip = (on: boolean) =>
   `transition active:scale-[0.97] ${
      on
         ? 'border-[#6b55f7] bg-[#f3ecff] shadow-[0_0_0_3px_rgba(107,85,247,0.15)] dark:bg-[#2a1740]'
         : 'border-[#e2dcee] bg-white dark:border-[#3a2d4f] dark:bg-[#1b1526]'
   }`;

/**
 * "About you" — one card after "Who invited you?" on sign-up and pre-screening: Woman / Man (hippo
 * tiles), age (number), kids (0–5+). Signed out the answers are parked and saved after sign-up;
 * signed in they're saved now — a failed save never blocks them (they can go on).
 */
export default function AboutYouStep({ source, signedIn, onDone }: { source: 'signup' | 'screen'; signedIn: boolean; onDone: () => void }) {
   const { locale } = useLocalization();
   const copy = COPY[locale] ?? COPY.en;
   const [gender, setGender] = useState<AboutGender | null>(null);
   const [ageText, setAgeText] = useState('');
   const [kids, setKids] = useState<number | null>(null);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [failedOnce, setFailedOnce] = useState(false);

   useEffect(() => track('shown', source), [source]);

   const age = Number(ageText);
   const tooYoung = ageText.length === 2 && age < MIN_AGE;
   const ready = gender !== null && kids !== null && age >= MIN_AGE && age <= MAX_AGE;

   const finish = async () => {
      if (!ready || busy) return;
      const answers = { gender, age, kids };
      if (!signedIn) {
         parkAboutYou(answers);
      } else {
         setBusy(true);
         const ok = await saveAboutYou(answers);
         setBusy(false);
         // One retry shown; a second failure lets them go on (the card isn't worth losing a borrower).
         if (!ok && !failedOnce) {
            setFailedOnce(true);
            setError(copy.error);
            track('save_failed', source);
            return;
         }
      }
      track('answered', source, { gender, age, kids });
      onDone();
   };

   return (
      <div className="min-h-screen bg-dv2-page">
         <div className="mx-auto flex max-w-[440px] flex-col gap-4 px-4 pb-16 pt-4">
            <div className="flex items-center justify-center gap-2">
               <img alt="" className="size-7 rounded-full object-contain" src="/moodenglogo.png" />
               <span className="text-[16px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">Moodeng Credit</span>
            </div>

            <div className="flex flex-col gap-5 overflow-hidden rounded-[20px] bg-white px-5 py-5 dark:bg-dv2-card">
               <ConnectHero image={ART.family} subtitle={copy.subtitle} title={copy.title} />

               <div className="grid grid-cols-2 gap-3" role="radiogroup">
                  {(['female', 'male'] as const).map((g) => (
                     <button
                        aria-checked={gender === g}
                        className={`flex flex-col items-center gap-1 rounded-[18px] border-2 px-2 pb-3 pt-2 ${chip(gender === g)}`}
                        key={g}
                        onClick={() => setGender(g)}
                        role="radio"
                        type="button"
                     >
                        <img alt="" aria-hidden="true" className="size-[84px] object-contain" draggable={false} src={ART[g]} />
                        <span className="text-[17px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff]">{copy[g]}</span>
                     </button>
                  ))}
               </div>

               <label className="flex items-center justify-between gap-3">
                  <span className={label}>{copy.age}</span>
                  <input
                     aria-invalid={tooYoung}
                     className={`w-[96px] rounded-[14px] border-2 bg-white px-3 py-2.5 text-center text-[22px] font-extrabold text-[#3b2f4a] outline-none placeholder:text-[#c9bef9] focus:border-[#7661f9] dark:bg-[#1b1526] dark:text-[#f5f0ff] ${
                        tooYoung ? 'border-[#c2410c]' : 'border-[#e2dcee] dark:border-[#3a2d4f]'
                     }`}
                     enterKeyHint="done"
                     inputMode="numeric"
                     maxLength={2}
                     onChange={(event) => setAgeText(event.target.value.replace(/\D/g, '').slice(0, 2))}
                     pattern="[0-9]*"
                     placeholder="25"
                     value={ageText}
                  />
               </label>
               {tooYoung ? <p className="-mt-3 text-right text-[13px] font-semibold text-[#c2410c]">{copy.tooYoung}</p> : null}

               <div className="flex flex-col gap-2">
                  <span className={label}>{copy.kids}</span>
                  <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={copy.kids}>
                     {KIDS.map((n) => (
                        <button
                           aria-checked={kids === n}
                           className={`h-12 rounded-[14px] border-2 text-[18px] font-extrabold text-[#3b2f4a] dark:text-[#f5f0ff] ${chip(kids === n)}`}
                           key={n}
                           onClick={() => setKids(n)}
                           role="radio"
                           type="button"
                        >
                           {n === 5 ? '5+' : n}
                        </button>
                     ))}
                  </div>
               </div>

               {error ? <p className="text-center text-[14px] font-semibold text-[#c2410c]">{error}</p> : null}

               <PrimaryButton disabled={!ready || busy} onClick={() => void finish()}>
                  {busy ? <Loader2 className="mx-auto size-5 animate-spin" /> : copy.next}
               </PrimaryButton>
            </div>
         </div>
      </div>
   );
}
