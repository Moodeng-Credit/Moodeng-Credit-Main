import { Facebook, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

import { buildMessengerHandoffLink, MESSENGER_DESKTOP_CHAT_LINK, MESSENGER_PAGE_ID } from '@/config/contactVerification';

// ContactsStep on a computer: the m.me code never reaches our bot from a desktop browser, so the
// borrower scans a QR with their phone (MessengerHandoff opens Messenger there), or pastes the code
// into our chat on this computer. Either way the card turns green on its own when the bot confirms.
export default function DesktopMessengerCard({
   code,
   codeCopied,
   onCopy,
   onOpenChat,
   onPageLink
}: {
   code: string;
   codeCopied: boolean;
   onCopy: () => void;
   onOpenChat: () => void;
   onPageLink: () => void;
}) {
   return (
      <div
         aria-live="polite"
         className="flex w-full flex-col gap-3 rounded-[18px] border-2 border-[#c9bdf5] bg-[#f6f2ff] px-4 py-4 text-left"
      >
         <span className="text-[18px] font-bold leading-[22px] text-[#4c239f]">Scan with your phone</span>
         <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            {/* Always dark-on-white: phone cameras struggle with inverted codes, so no dark-mode remap. */}
            <div className="shrink-0 rounded-2xl bg-white p-2 shadow-[0_2px_8px_rgba(38,20,63,0.08)]" data-testid="messenger-qr">
               <QRCodeSVG
                  bgColor="#ffffff"
                  fgColor="#000000"
                  level="M"
                  marginSize={2}
                  size={168}
                  title="Scan to connect on Messenger"
                  value={buildMessengerHandoffLink(code)}
               />
            </div>
            <ol className="flex flex-col gap-1.5 text-[14px] leading-[19px] text-[#594d65]">
               <li className="flex gap-2">
                  <b>1.</b>
                  <span>Open your phone&apos;s camera and point it at the code.</span>
               </li>
               <li className="flex gap-2">
                  <b>2.</b>
                  <span>Tap the link that appears. Messenger opens and connects you.</span>
               </li>
               <li className="flex gap-2">
                  <b>3.</b>
                  <span>This page turns green on its own.</span>
               </li>
            </ol>
         </div>
         <div className="flex items-center gap-2 text-[14px] leading-[18px] text-[#6b5b86]">
            <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin text-[#6b55f7]" strokeWidth={2.5} />
            <span>Waiting for Messenger…</span>
         </div>

         <div className="mt-1 border-t border-[#e0d8f7] pt-3">
            <p className="text-[15px] font-bold text-[#4c239f]">No phone handy? Do it on this computer</p>
            <div className="mt-2 flex items-center gap-2">
               <code className="flex-1 rounded-lg bg-white px-3 py-2 text-center text-[18px] font-bold tracking-wide text-md-heading">
                  {code}
               </code>
               <button
                  className="rounded-lg border border-[#c9bdf5] bg-white px-3 py-2 text-[13px] font-bold text-[#6b55f7]"
                  onClick={onCopy}
                  type="button"
               >
                  {codeCopied ? 'Copied' : 'Copy'}
               </button>
            </div>
            <a
               className="mt-2 flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-[#0866FF] px-4 text-[15px] font-bold text-white"
               href={MESSENGER_DESKTOP_CHAT_LINK}
               onClick={onOpenChat}
               rel="noopener noreferrer"
               target="_blank"
            >
               <Facebook aria-hidden="true" className="size-5" strokeWidth={2.5} />
               Copy code & open our chat
            </a>
            <p className="mt-2 text-[13px] leading-[17px] text-[#877897]">
               Paste the code in the chat and press send. Asked to log in? Use your Facebook account, then send the code. Chat won&apos;t
               open?{' '}
               <a
                  className="font-semibold text-md-primary-1200 underline underline-offset-4"
                  href={`https://www.facebook.com/${MESSENGER_PAGE_ID}`}
                  onClick={onPageLink}
                  rel="noopener noreferrer"
                  target="_blank"
               >
                  Open our Facebook page
               </a>{' '}
               and tap Message.
            </p>
         </div>
         <p className="text-[13px] leading-[17px] text-[#877897]">Still stuck? We&apos;ll email you, and our team will help you finish.</p>
      </div>
   );
}
