import { type JSX } from 'react';

/**
 * Dismissable-by-default (collapsed) help block shown under the Connect button on the
 * wallet-connect screen. Turns our support troubleshooting script into self-serve product
 * copy, cutting the most common "I can't connect my Base wallet" tickets:
 *   - people downloading the separate Base app instead of using the connect popup
 *   - the "connection is not private" cert warning from a wrong device clock / bad network
 * Static text only — it does not touch the connect logic.
 */
export default function WalletConnectHelp(): JSX.Element {
   return (
      <details className="group mt-md-4 w-full max-w-[360px] rounded-[12px] border border-md-neutral-600 bg-md-neutral-200 text-left [&_summary::-webkit-details-marker]:hidden">
         <summary className="flex cursor-pointer list-none items-center justify-between gap-md-2 px-md-3 py-md-3 text-md-b2 font-semibold text-md-heading">
            Trouble connecting?
            <span
               aria-hidden="true"
               className="block size-5 bg-md-slate-600 transition-transform group-open:rotate-90"
               style={{
                  WebkitMaskImage: "url('/icons/chevron-right.svg')",
                  maskImage: "url('/icons/chevron-right.svg')",
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain'
               }}
            />
         </summary>
         <ul className="flex flex-col gap-md-3 px-md-3 pb-md-3 text-md-b2 font-medium leading-6 text-md-neutral-700">
            <li>
               <span className="font-semibold text-md-heading">Use the popup that opens when you tap Connect.</span> You don&apos;t
               need to download a separate Base app from the app store — creating an account there won&apos;t connect here.
            </li>
            <li>
               <span className="font-semibold text-md-heading">Seeing a &ldquo;connection is not private&rdquo; warning?</span> Your
               phone&apos;s clock is probably off. In Settings, set date &amp; time to automatic, then tap Connect again.
            </li>
            <li>
               <span className="font-semibold text-md-heading">Still stuck?</span> Switch between Wi‑Fi and mobile data, make sure
               your browser is up to date, and reconnect.
            </li>
         </ul>
      </details>
   );
}
