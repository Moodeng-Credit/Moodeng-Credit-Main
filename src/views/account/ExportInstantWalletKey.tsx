import { useCallback, useState } from 'react';

import { TOAST_TYPES } from '@/components/ToastSystem/types';
import { useToast } from '@/components/ToastSystem/hooks/useToast';

import { useOpenfort } from '@/lib/web3/openfort';

// Makes the "you fully own this wallet" promise real: an Openfort embedded wallet is
// self-custodial, and this reveals its private key so the borrower can import it into
// MetaMask/Trust and leave Moodeng entirely. The key is fetched only on an explicit tap,
// held in local state just long enough to copy, and cleared the moment the sheet closes —
// it is never logged, persisted, or sent anywhere.
export default function ExportInstantWalletKey() {
   const { exportPrivateKey } = useOpenfort();
   const { showToast } = useToast();
   const [stage, setStage] = useState<'idle' | 'confirm' | 'revealing' | 'revealed'>('idle');
   const [privateKey, setPrivateKey] = useState<string | null>(null);

   const close = useCallback(() => {
      setStage('idle');
      setPrivateKey(null); // drop the key from memory as soon as the sheet closes
   }, []);

   const reveal = useCallback(async () => {
      setStage('revealing');
      try {
         const key = await exportPrivateKey();
         setPrivateKey(key);
         setStage('revealed');
      } catch (err) {
         setStage('confirm');
         showToast(
            TOAST_TYPES.ERROR,
            "Couldn't export key",
            err instanceof Error ? err.message : 'Please try again in a moment.'
         );
      }
   }, [exportPrivateKey, showToast]);

   const copyKey = useCallback(async () => {
      if (!privateKey) return;
      try {
         await navigator.clipboard.writeText(privateKey);
         showToast(TOAST_TYPES.SUCCESS, 'Copied', 'Private key copied. Store it somewhere safe and never share it.');
      } catch {
         showToast(TOAST_TYPES.ERROR, 'Copy failed', 'Select the key and copy it manually.');
      }
   }, [privateKey, showToast]);

   return (
      <>
         <button
            type="button"
            onClick={() => setStage('confirm')}
            className="text-md-b2 font-semibold text-md-primary-1200 underline underline-offset-4 dark:text-md-primary-500"
         >
            Export wallet key
         </button>

         {stage !== 'idle' ? (
            <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 px-md-3 pb-md-4 sm:items-center" onClick={close}>
               <div
                  className="w-full max-w-modal rounded-md-lg bg-white p-md-4 shadow-md-card"
                  onClick={(e) => e.stopPropagation()}
               >
                  {stage === 'revealed' && privateKey ? (
                     <div className="flex flex-col gap-md-3">
                        <div className="flex flex-col gap-md-1">
                           <h3 className="text-md-h5 font-semibold text-md-heading">Your private key</h3>
                           <p className="text-md-b3 font-medium leading-5 text-md-red-500">
                              Anyone with this key controls your funds. Never share it or type it into any website. Moodeng will never
                              ask for it.
                           </p>
                        </div>
                        <code className="block w-full break-all rounded-md-md border border-md-neutral-600 bg-md-neutral-200 p-md-3 text-md-b3 font-mono text-md-heading">
                           {privateKey}
                        </code>
                        <div className="grid grid-cols-2 gap-md-2">
                           <button
                              type="button"
                              onClick={copyKey}
                              className="rounded-md-lg border border-md-primary-900 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-primary-900"
                           >
                              Copy key
                           </button>
                           <button
                              type="button"
                              onClick={close}
                              className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100"
                           >
                              I've saved it
                           </button>
                        </div>
                     </div>
                  ) : (
                     <div className="flex flex-col gap-md-3">
                        <div className="flex flex-col gap-md-1">
                           <h3 className="text-md-h5 font-semibold text-md-heading">Export your wallet key</h3>
                           <p className="text-md-b2 font-medium leading-6 text-md-neutral-1200">
                              This reveals the private key to your instant wallet so you can import it into another wallet app like
                              MetaMask or Trust. Make sure no one is looking at your screen.
                           </p>
                        </div>
                        <div className="grid grid-cols-2 gap-md-2">
                           <button
                              type="button"
                              onClick={close}
                              disabled={stage === 'revealing'}
                              className="rounded-md-lg border border-md-neutral-600 bg-md-neutral-100 px-md-3 py-md-2 text-md-b2 font-semibold text-md-heading disabled:opacity-60"
                           >
                              Cancel
                           </button>
                           <button
                              type="button"
                              onClick={reveal}
                              disabled={stage === 'revealing'}
                              className="rounded-md-lg bg-md-primary-1200 px-md-3 py-md-2 text-md-b2 font-semibold text-md-neutral-100 disabled:opacity-60"
                           >
                              {stage === 'revealing' ? 'Revealing…' : 'Reveal key'}
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         ) : null}
      </>
   );
}
