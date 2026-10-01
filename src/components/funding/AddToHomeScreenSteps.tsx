import type { ReactNode } from 'react';

import { Compass, Ellipsis, Share, SquarePlus } from 'lucide-react';

import { type LocaleCode, useLocalization } from '@/i18n';
import { detectInAppBrowser, openInSafari } from '@/lib/inAppBrowser';

// iOS only allows web push from a site added to the Home Screen, and there's no API to add it for
// the user, so we show them how. Inside Facebook/Messenger/Instagram there's no Share → Add to Home
// Screen at all, so they first have to hop out to Safari: a button tries that for them (best effort,
// iOS doesn't honour it in every app), with the manual route written underneath.
const inlineIcon = 'mx-0.5 inline-block size-[18px] -translate-y-px align-middle text-[#6b55f7]';

// The connecting prose is translated; the bolded references to Safari's own UI (Share, Add to Home
// Screen, Add) and to our own "Turn On" button label stay as literal quoted labels — Safari's own
// labels are localized by the device's OS language rather than this app, and "Turn On" here must
// match what the lender actually sees on that button (see LenderHomeScreenPushPrompt's own copy).
const STEP_COPY: Record<
   LocaleCode,
   {
      openInSafariButton: string;
      openInSafariFallback: (appName: string | null) => ReactNode;
      share: (turnOnLabel: string) => ReactNode;
      addToHomeScreen: ReactNode;
      add: ReactNode;
      turnOn: (turnOnLabel: string) => ReactNode;
   }
> = {
   en: {
      openInSafariButton: 'Open in Safari',
      openInSafariFallback: (appName) => (
         <>
            Didn’t work? Tap <Ellipsis className={inlineIcon} aria-label="the ••• menu" />
            {appName ? ` in ${appName}` : ''} and choose <b>Open in Safari</b>.
         </>
      ),
      share: () => (
         <>
            Tap <b>Share</b> <Share className={inlineIcon} aria-hidden="true" /> at the bottom of Safari. On newer iPhones, tap{' '}
            <Ellipsis className={inlineIcon} aria-label="•••" /> first, then <b>Share</b>.
         </>
      ),
      addToHomeScreen: (
         <>
            Scroll down and tap <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />.
         </>
      ),
      add: (
         <>
            Tap <b>Add</b> in the top right.
         </>
      ),
      turnOn: (turnOnLabel) => (
         <>
            Open <b>Moodeng</b> from your Home Screen and tap <b>{turnOnLabel}</b>.
         </>
      )
   },
   fil: {
      openInSafariButton: 'Buksan sa Safari',
      openInSafariFallback: (appName) => (
         <>
            Hindi gumana? I-tap ang <Ellipsis className={inlineIcon} aria-label="ang menu na •••" />
            {appName ? ` sa ${appName}` : ''} tapos piliin ang <b>Open in Safari</b>.
         </>
      ),
      share: () => (
         <>
            I-tap ang <b>Share</b> <Share className={inlineIcon} aria-hidden="true" /> sa ibaba ng Safari. Sa mas bagong iPhone, i-tap muna
            ang <Ellipsis className={inlineIcon} aria-label="•••" />, tapos <b>Share</b>.
         </>
      ),
      addToHomeScreen: (
         <>
            Mag-scroll pababa at i-tap ang <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />.
         </>
      ),
      add: (
         <>
            I-tap ang <b>Add</b> sa kanang itaas.
         </>
      ),
      turnOn: (turnOnLabel) => (
         <>
            Buksan ang <b>Moodeng</b> mula sa Home Screen mo at i-tap ang <b>{turnOnLabel}</b>.
         </>
      )
   },
   id: {
      openInSafariButton: 'Buka di Safari',
      openInSafariFallback: (appName) => (
         <>
            Tidak berhasil? Ketuk <Ellipsis className={inlineIcon} aria-label="menu •••" />
            {appName ? ` di ${appName}` : ''} lalu pilih <b>Open in Safari</b>.
         </>
      ),
      share: () => (
         <>
            Ketuk <b>Share</b> <Share className={inlineIcon} aria-hidden="true" /> di bagian bawah Safari. Di iPhone yang lebih baru, ketuk{' '}
            <Ellipsis className={inlineIcon} aria-label="•••" /> dulu, lalu <b>Share</b>.
         </>
      ),
      addToHomeScreen: (
         <>
            Gulir ke bawah dan ketuk <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />.
         </>
      ),
      add: (
         <>
            Ketuk <b>Add</b> di kanan atas.
         </>
      ),
      turnOn: (turnOnLabel) => (
         <>
            Buka <b>Moodeng</b> dari Home Screen kamu dan ketuk <b>{turnOnLabel}</b>.
         </>
      )
   },
   th: {
      openInSafariButton: 'เปิดใน Safari',
      openInSafariFallback: (appName) => (
         <>
            ไม่สำเร็จใช่ไหม แตะ <Ellipsis className={inlineIcon} aria-label="เมนู •••" />
            {appName ? ` ใน ${appName}` : ''} แล้วเลือก <b>Open in Safari</b>
         </>
      ),
      share: () => (
         <>
            แตะ <b>Share</b> <Share className={inlineIcon} aria-hidden="true" /> ที่ด้านล่างของ Safari สำหรับ iPhone รุ่นใหม่ ให้แตะ{' '}
            <Ellipsis className={inlineIcon} aria-label="•••" /> ก่อน แล้วจึงแตะ <b>Share</b>
         </>
      ),
      addToHomeScreen: (
         <>
            เลื่อนลงแล้วแตะ <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />
         </>
      ),
      add: (
         <>
            แตะ <b>Add</b> ที่มุมขวาบน
         </>
      ),
      turnOn: (turnOnLabel) => (
         <>
            เปิด <b>Moodeng</b> จากหน้าจอโฮมแล้วแตะ <b>{turnOnLabel}</b>
         </>
      )
   },
   vi: {
      openInSafariButton: 'Mở trong Safari',
      openInSafariFallback: (appName) => (
         <>
            Không thành công? Nhấn <Ellipsis className={inlineIcon} aria-label="menu •••" />
            {appName ? ` trong ${appName}` : ''} rồi chọn <b>Open in Safari</b>.
         </>
      ),
      share: () => (
         <>
            Nhấn <b>Share</b> <Share className={inlineIcon} aria-hidden="true" /> ở cuối Safari. Trên iPhone đời mới, nhấn{' '}
            <Ellipsis className={inlineIcon} aria-label="•••" /> trước, sau đó <b>Share</b>.
         </>
      ),
      addToHomeScreen: (
         <>
            Cuộn xuống và nhấn <b>Add to Home Screen</b> <SquarePlus className={inlineIcon} aria-hidden="true" />.
         </>
      ),
      add: (
         <>
            Nhấn <b>Add</b> ở góc trên bên phải.
         </>
      ),
      turnOn: (turnOnLabel) => (
         <>
            Mở <b>Moodeng</b> từ Màn hình chính và nhấn <b>{turnOnLabel}</b>.
         </>
      )
   }
};

// Matches LenderHomeScreenPushPrompt's own translated button label, so step 5's quoted reference
// is accurate rather than always saying the English word.
const TURN_ON_LABEL: Record<LocaleCode, string> = {
   en: 'Turn On',
   fil: 'I-on',
   id: 'Aktifkan',
   th: 'เปิด',
   vi: 'Bật'
};

export default function AddToHomeScreenSteps() {
   const inApp = detectInAppBrowser();
   const { locale } = useLocalization();
   const copy = STEP_COPY[locale];
   const turnOnLabel = TURN_ON_LABEL[locale];

   const steps: { key: string; content: ReactNode }[] = [
      ...(inApp.isInApp
         ? [
              {
                 key: 'safari',
                 content: (
                    <>
                       <button
                          type="button"
                          onClick={() => openInSafari(window.location.href, inApp)}
                          className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#6b55f7] px-3.5 py-1.5 text-[15px] font-semibold text-white active:scale-[0.98]"
                       >
                          <Compass className="size-4" aria-hidden="true" />
                          {copy.openInSafariButton}
                       </button>
                       <span className="block text-[14px] leading-5 text-[#7b6b8c]">
                          {copy.openInSafariFallback(inApp.appName ?? null)}
                       </span>
                    </>
                 )
              }
           ]
         : []),
      { key: 'share', content: copy.share(turnOnLabel) },
      { key: 'add-to-home', content: copy.addToHomeScreen },
      { key: 'add', content: copy.add },
      { key: 'turn-on', content: copy.turnOn(turnOnLabel) }
   ];

   return (
      <ol className="w-full space-y-3 text-left">
         {steps.map((step, index) => (
            <li key={step.key} className="flex items-start gap-3 text-[16px] leading-[22px] text-[#594d65]">
               <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-[#efeaff] text-[14px] font-bold text-[#6b55f7]">
                  {index + 1}
               </span>
               <span className="pt-0.5">{step.content}</span>
            </li>
         ))}
      </ol>
   );
}
