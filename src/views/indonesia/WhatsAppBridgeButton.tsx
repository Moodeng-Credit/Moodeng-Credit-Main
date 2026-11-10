import { type JSX, useState } from 'react';

import posthog from 'posthog-js';

import { WHATSAPP_BUSINESS_NUMBER, WHATSAPP_BUSINESS_NUMBER_DISPLAY } from '@/config/contactVerification';
import { deviceOs } from '@/lib/telegramAppLogin';
import { idWaBridgeLink, idWaBridgeMessage, pick, useIdLang } from '@/views/indonesia/idFlow';
import { AppIcon, GoldLink, SoftLink } from '@/views/indonesia/ui';

/**
 * "Chat di WhatsApp" on /id — the way in from a Facebook post. It opens WhatsApp with a message already
 * typed; they tap send, and we lead them to the Telegram bot from there (_shared/idWaBridge.ts).
 *
 * A real link, so Facebook's browser hands it to WhatsApp. After the tap this page is not needed again:
 * people who leave Facebook's browser don't come back, so nothing here waits for them.
 */

const COPY = {
   id: {
      cta: 'Chat di WhatsApp',
      sentTitle: 'Di WhatsApp: tekan kirim ➤',
      sentBody: 'Kami balas di sana dan pandu kamu, langkah demi langkah.',
      again: 'Buka WhatsApp lagi',
      notOpening: 'WhatsApp tidak terbuka?',
      manual: 'Kirim pesan ini ke',
      copy: 'Salin pesan',
      copied: 'Tersalin ✓'
   },
   en: {
      cta: 'Chat on WhatsApp',
      sentTitle: 'In WhatsApp: tap send ➤',
      sentBody: 'We reply there and guide you, step by step.',
      again: 'Open WhatsApp again',
      notOpening: 'WhatsApp didn’t open?',
      manual: 'Send this message to',
      copy: 'Copy message',
      copied: 'Copied ✓'
   }
};

const track = (event: string, properties: Record<string, unknown>) => {
   try {
      posthog.capture(event, properties);
   } catch {
      // Analytics unavailable: the flow carries on.
   }
};

export default function WhatsAppBridgeButton({
   preview = false,
   onOpened
}: {
   /** Screenshots (dev builds): show the after-tap state. */
   preview?: boolean;
   /** They tapped the button (WhatsApp is opening). */
   onOpened?: () => void;
}): JSX.Element {
   const lang = useIdLang();
   const t = pick(lang, COPY);
   const os = deviceOs();
   const [opened, setOpened] = useState(preview);
   const [copied, setCopied] = useState(false);
   const href = idWaBridgeLink(WHATSAPP_BUSINESS_NUMBER, lang, os);
   const message = idWaBridgeMessage(lang, os);

   const copyMessage = async () => {
      try {
         await navigator.clipboard.writeText(message);
         setCopied(true);
         window.setTimeout(() => setCopied(false), 2000);
         track('id_wa_bridge_message_copied', { lang, os });
      } catch {
         // The message is on screen to type by hand.
      }
   };

   if (!opened) {
      return (
         <GoldLink
            className="min-h-[60px] text-[19px]"
            data-i18n-skip
            href={href}
            onClick={() => {
               setOpened(true);
               onOpened?.();
               track('id_wa_bridge_tapped', { lang, os });
            }}
            rel="noreferrer"
            target={os === 'other' ? '_blank' : undefined}
         >
            <AppIcon app="whatsapp" className="text-[30px]" />
            {t.cta}
         </GoldLink>
      );
   }

   return (
      <div className="flex flex-col gap-3" data-i18n-skip>
         <div className="rounded-[16px] border-2 border-[#bfe9cf] bg-[#effaf3] px-4 py-3 text-center dark:border-[#1f5a39] dark:bg-[#0f2318]">
            <p className="text-[19px] font-extrabold text-[#0f5a32] dark:text-[#9be7bb]">{t.sentTitle}</p>
            <p className="mt-1 text-[15px] text-[#2c6e49] dark:text-[#8fd0aa]">{t.sentBody}</p>
         </div>
         <SoftLink
            href={href}
            onClick={() => track('id_wa_bridge_reopened', { lang, os })}
            rel="noreferrer"
            target={os === 'other' ? '_blank' : undefined}
         >
            <AppIcon app="whatsapp" className="text-[22px]" />
            {t.again}
         </SoftLink>
         <details className="text-[14px] text-[#7a6a4f] dark:text-[#bfb29a]">
            <summary className="cursor-pointer font-semibold">{t.notOpening}</summary>
            <div className="mt-2 flex flex-col gap-2">
               <p>
                  {t.manual} <span className="font-bold">{WHATSAPP_BUSINESS_NUMBER_DISPLAY}</span>:
               </p>
               <p className="whitespace-pre-line rounded-[12px] bg-white px-3 py-2 font-semibold text-[#2b2116] dark:bg-[#1a1524] dark:text-[#f5efe3]">
                  {message}
               </p>
               <button type="button" onClick={() => void copyMessage()} className="self-start font-semibold underline">
                  {copied ? t.copied : t.copy}
               </button>
            </div>
         </details>
      </div>
   );
}
