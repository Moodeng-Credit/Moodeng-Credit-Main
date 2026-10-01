import { useEffect, useMemo, useState } from 'react';

import { format, isValid, parseISO } from 'date-fns';

import AddToHomeScreenSteps from '@/components/funding/AddToHomeScreenSteps';
import LenderPopupShell, { LenderPopupButton, TurnOnButton } from '@/components/funding/LenderPopupShell';
import { useLenderPushTurnOn } from '@/components/funding/useLenderPushTurnOn';

import { usePushNotifications } from '@/hooks/usePushNotifications';

import { formatCurrency } from '@/utils/decimalHelpers';

import { type LocaleCode, useLocalization } from '@/i18n';
import { getPushPermission, isPushConfigured, isPushSupported, needsHomeScreenForPush } from '@/lib/push/webPushClient';

// This popup's own wording, for all 5 app languages. `repaysLine` takes the borrower's name, the
// already-formatted amount, and an optional already-formatted due date (kept in its existing
// English-abbreviated format, e.g. "Oct 12" — dates aren't localized anywhere in this app yet).
const POPUP_COPY: Record<
   LocaleCode,
   {
      fundedTitle: (name: string) => string;
      repaysLine: (name: string, amount: string, byDate: string | null) => string;
      enableHeading: string;
      enableCta: string;
      thanksHeading: string;
      doneCta: string;
      homeScreenGuideHeading: string;
      homeScreenGuideBody: string;
      gotItCta: string;
   }
> = {
   en: {
      fundedTitle: (name) => `You funded ${name}!`,
      repaysLine: (name, amount, byDate) => `${name} repays you $${amount}${byDate ? ` by ${byDate}` : ''}.`,
      enableHeading: 'Want to know when you’re repaid?',
      enableCta: 'Notify Me When Repaid',
      thanksHeading: 'Thanks for lending!',
      doneCta: 'Done',
      homeScreenGuideHeading: 'Add Moodeng to your Home Screen',
      homeScreenGuideBody: 'iPhones only send notifications from apps on your Home Screen.',
      gotItCta: 'Got It'
   },
   fil: {
      fundedTitle: (name) => `Napondohan mo si ${name}!`,
      repaysLine: (name, amount, byDate) => `Babayaran ka ni ${name} ng $${amount}${byDate ? ` pagsapit ng ${byDate}` : ''}.`,
      enableHeading: 'Gusto mo bang malaman kapag nabayaran ka na?',
      enableCta: 'Ipaalam Kapag Nabayaran Na',
      thanksHeading: 'Salamat sa pagpapautang!',
      doneCta: 'Tapos na',
      homeScreenGuideHeading: 'Idagdag ang Moodeng sa Home Screen mo',
      homeScreenGuideBody: 'Nagpapadala lang ng notification ang mga iPhone mula sa mga app na nasa Home Screen.',
      gotItCta: 'Sige'
   },
   id: {
      fundedTitle: (name) => `Kamu mendanai ${name}!`,
      repaysLine: (name, amount, byDate) => `${name} akan membayarmu $${amount}${byDate ? ` sebelum ${byDate}` : ''}.`,
      enableHeading: 'Mau tahu kapan kamu dibayar kembali?',
      enableCta: 'Beri Tahu Saat Dibayar Kembali',
      thanksHeading: 'Terima kasih sudah meminjamkan!',
      doneCta: 'Selesai',
      homeScreenGuideHeading: 'Tambahkan Moodeng ke Home Screen kamu',
      homeScreenGuideBody: 'iPhone hanya mengirim notifikasi dari aplikasi di Home Screen.',
      gotItCta: 'Oke'
   },
   th: {
      fundedTitle: (name) => `คุณปล่อยกู้ให้ ${name} แล้ว!`,
      repaysLine: (name, amount, byDate) => `${name} จะชำระคืนคุณ $${amount}${byDate ? ` ภายในวันที่ ${byDate}` : ''}`,
      enableHeading: 'อยากรู้ไหมว่าเมื่อไหร่คุณจะได้รับเงินคืน',
      enableCta: 'แจ้งเตือนเมื่อได้รับเงินคืน',
      thanksHeading: 'ขอบคุณที่ปล่อยกู้!',
      doneCta: 'เสร็จสิ้น',
      homeScreenGuideHeading: 'เพิ่ม Moodeng ไปยังหน้าจอโฮมของคุณ',
      homeScreenGuideBody: 'iPhone จะส่งการแจ้งเตือนเฉพาะจากแอปที่อยู่บนหน้าจอโฮมเท่านั้น',
      gotItCta: 'เข้าใจแล้ว'
   },
   vi: {
      fundedTitle: (name) => `Bạn đã cho ${name} vay!`,
      repaysLine: (name, amount, byDate) => `${name} sẽ trả bạn $${amount}${byDate ? ` trước ${byDate}` : ''}.`,
      enableHeading: 'Bạn có muốn biết khi nào được hoàn trả không?',
      enableCta: 'Báo Tôi Khi Được Hoàn Trả',
      thanksHeading: 'Cảm ơn bạn đã cho vay!',
      doneCta: 'Xong',
      homeScreenGuideHeading: 'Thêm Moodeng vào Màn hình chính của bạn',
      homeScreenGuideBody: 'iPhone chỉ gửi thông báo từ các ứng dụng trên Màn hình chính.',
      gotItCta: 'Đã hiểu'
   }
};

// Set the first time the push ask is shown on a device. It's a one-time ask: whether the lender turns
// push on or just closes the popup, we never ask again. They still get the repayment email, and can
// turn push on later from notification settings.
const SEEN_STORAGE_KEY = 'moodeng-repaid-push-card-seen';

const hasSeenAsk = () => {
   try {
      return window.localStorage.getItem(SEEN_STORAGE_KEY) === '1';
   } catch {
      return false;
   }
};

const markAskSeen = () => {
   try {
      window.localStorage.setItem(SEEN_STORAGE_KEY, '1');
   } catch {
      // Private-mode storage failure just means we may ask once more after a later funding.
   }
};

type PushAsk = 'enable' | 'home-screen' | null;

// Only ask when the answer is still open: the browser hasn't been asked yet, or it's iPhone Safari
// where push needs the app on the Home Screen first. Already allowed or blocked means no ask.
const pickPushAsk = (): PushAsk => {
   if (hasSeenAsk()) return null;
   if (isPushSupported() && isPushConfigured()) {
      return getPushPermission() === 'default' ? 'enable' : null;
   }
   return needsHomeScreenForPush() ? 'home-screen' : null;
};

interface Props {
   userId: string | null | undefined;
   borrowerName: string;
   totalRepayment: number;
   dueDate?: string | null;
   onClose: () => void;
}

/**
 * Shown to a lender right after they fund a loan. The moment they most want to know when the money
 * comes back, so it doubles as the one-time push ask: our own button first, so the browser's permission
 * dialog only appears after the lender has said yes (a dismissed or blocked browser dialog can cost us
 * the channel on that device for good). iPhones can't be switched on from here (push needs the app on
 * the Home Screen first), so there the button shows how instead.
 */
export default function LenderFundedPopup({ userId, borrowerName, totalRepayment, dueDate, onClose }: Props) {
   // Decided once on mount, so marking the ask seen below doesn't change the popup mid-screen.
   const pushAsk = useMemo(pickPushAsk, []);
   const push = usePushNotifications(userId, { autoPrompt: false });
   const [showSteps, setShowSteps] = useState(false);
   const { status: turnOnStatus, turnOn } = useLenderPushTurnOn(push.enable, onClose);
   const { locale } = useLocalization();
   const copy = POPUP_COPY[locale];

   useEffect(() => {
      if (pushAsk) markAskSeen();
   }, [pushAsk]);

   const due = dueDate ? parseISO(dueDate) : null;
   const repaysLine = copy.repaysLine(borrowerName, formatCurrency(totalRepayment), due && isValid(due) ? format(due, 'MMM d') : null);

   // Moodeng hugging a paid coin, not the bell: the bell belongs to the Home Screen Turn On popup, and
   // reusing it here made the two steps look like the same screen. iPhone gets the same ask as everyone
   // else; its button just leads to the Home Screen steps, since iOS won't turn push on from Safari.
   const content = pushAsk
      ? {
           heading: copy.enableHeading,
           body: repaysLine,
           art: '/icons/hippo-repaid-coin-3d.png',
           cta: copy.enableCta
        }
      : { heading: copy.thanksHeading, body: repaysLine, art: '/icons/check-3d.png', cta: copy.doneCta };

   const handleCta = () => {
      if (pushAsk === 'home-screen') setShowSteps(true);
      else onClose();
   };

   return (
      <LenderPopupShell title={copy.fundedTitle(borrowerName)} labelledBy="lender-funded-popup-title" onClose={onClose}>
         {showSteps ? (
            <>
               <div className="w-full text-[#594d65]">
                  <p id="lender-funded-popup-title" className="text-[24px] font-bold leading-6">
                     {copy.homeScreenGuideHeading}
                  </p>
                  <p className="mt-1 text-[16px] leading-[22px]">{copy.homeScreenGuideBody}</p>
               </div>
               <AddToHomeScreenSteps />
               <LenderPopupButton onClick={onClose}>{copy.gotItCta}</LenderPopupButton>
            </>
         ) : (
            <>
               <div className="w-full text-[#594d65] [overflow-wrap:anywhere]">
                  <p id="lender-funded-popup-title" className="text-[24px] font-bold leading-6">
                     {content.heading}
                  </p>
                  <p className="mt-1 text-[20px] leading-6">{content.body}</p>
               </div>
               <img src={content.art} alt="" className="h-[94px] w-[94px] object-contain" />
               {pushAsk === 'enable' ? (
                  <TurnOnButton label={content.cta} status={turnOnStatus} onTurnOn={() => void turnOn()} onDone={onClose} />
               ) : (
                  <LenderPopupButton onClick={handleCta}>{content.cta}</LenderPopupButton>
               )}
            </>
         )}
      </LenderPopupShell>
   );
}
