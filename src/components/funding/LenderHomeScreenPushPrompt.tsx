import { useCallback, useEffect, useMemo, useState } from 'react';

import LenderPopupShell, { TurnOnButton } from '@/components/funding/LenderPopupShell';
import { useLenderPushTurnOn } from '@/components/funding/useLenderPushTurnOn';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { type LocaleCode, useLocalization } from '@/i18n';
import { getPushPermission, isIosHomeScreenApp, isPushConfigured, isPushSupported } from '@/lib/push/webPushClient';

const PROMPT_COPY: Record<LocaleCode, { title: string; heading: string; body: string; turnOn: string }> = {
   en: {
      title: 'You’re on the Home Screen!',
      heading: 'Turn on notifications',
      body: 'Get notified the moment a borrower repays you.',
      turnOn: 'Turn On'
   },
   fil: {
      title: 'Nasa Home Screen ka na!',
      heading: 'I-on ang mga notification',
      body: 'Makatanggap ng abiso sa sandaling bayaran ka ng isang borrower.',
      turnOn: 'I-on'
   },
   id: {
      title: 'Kamu sudah ada di Home Screen!',
      heading: 'Aktifkan notifikasi',
      body: 'Dapatkan notifikasi begitu seorang peminjam membayarmu kembali.',
      turnOn: 'Aktifkan'
   },
   th: {
      title: 'คุณอยู่บนหน้าจอโฮมแล้ว!',
      heading: 'เปิดการแจ้งเตือน',
      body: 'รับการแจ้งเตือนทันทีที่ผู้ยืมชำระคืนให้คุณ',
      turnOn: 'เปิด'
   },
   vi: {
      title: 'Bạn đã ở Màn hình chính!',
      heading: 'Bật thông báo',
      body: 'Nhận thông báo ngay khi người vay trả nợ cho bạn.',
      turnOn: 'Bật'
   }
};

// Home Screen web apps keep their own storage, separate from Safari, so this is "asked once in the
// Home Screen app", whatever happened in Safari before.
const SEEN_STORAGE_KEY = 'moodeng-lender-home-screen-push-seen';

const hasSeenPrompt = () => {
   try {
      return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markPromptSeen = () => {
   try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more on a later launch.
   }
};

const shouldPrompt = () =>
   isIosHomeScreenApp() && isPushSupported() && isPushConfigured() && getPushPermission() === 'default' && !hasSeenPrompt();

/**
 * The last step of the iPhone guide in LenderFundedPopup: a lender who has added Moodeng to the Home
 * Screen and opened it from there. iOS only shows the "Allow notifications?" dialog after a tap, never
 * on load, so this gives them the one tap it needs. Asked once.
 */
export default function LenderHomeScreenPushPrompt({ userId }: { userId: string }) {
   const eligible = useMemo(shouldPrompt, []);
   const [isOpen, setIsOpen] = useState(eligible);
   const push = usePushNotifications(userId, { autoPrompt: false });
   const { locale } = useLocalization();
   const copy = PROMPT_COPY[locale];

   const close = useCallback(() => setIsOpen(false), []);
   const { status, turnOn } = useLenderPushTurnOn(push.enable, close);

   useEffect(() => {
      if (eligible) markPromptSeen();
   }, [eligible]);

   if (!isOpen) return null;

   return (
      <LenderPopupShell title={copy.title} labelledBy="lender-home-screen-push-title" onClose={close}>
         <div className="w-full text-[#594d65]">
            <p id="lender-home-screen-push-title" className="text-[24px] font-bold leading-6">
               {copy.heading}
            </p>
            <p className="mt-1 text-[20px] leading-6">{copy.body}</p>
         </div>
         <img src="/icons/bell-ringing-3d.png" alt="" className="h-[94px] w-[94px] object-contain" />
         <TurnOnButton label={copy.turnOn} status={status} onTurnOn={() => void turnOn()} onDone={close} />
      </LenderPopupShell>
   );
}
