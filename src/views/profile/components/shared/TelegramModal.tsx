interface TelegramModalProps {
   isOpen: boolean;
   onClose: () => void;
}

export default function TelegramModal({ isOpen, onClose }: TelegramModalProps) {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
         <button onClick={onClose} className="text-gray-600 hover:text-gray-800 fixed top-4 right-4 z-50">
            ✖
         </button>
         <main className="w-full border border-solid border-neutral-200 shadow-[0px_2px_8px_rgba(0,0,0,0.25)] flex overflow-hidden flex-col py-5 bg-white rounded-2xl max-w-[473px]">
            <section className="flex flex-col px-5 w-full">
               <h1 className="self-start text-2xl font-medium leading-none text-black">Telegram</h1>
               <p className="mt-5 text-sm leading-6 text-gray-500 text-opacity-60">Connect Telegram.</p>
               <div className="self-end">
                  <button
                     onClick={onClose}
                     className="mt-5 mr-2 overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] bg-white text-black border border-solid"
                  >
                     Cancel
                  </button>
                  <button
                     onClick={() => window.open(`https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`, '_blank')}
                     className="overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] bg-blue-500 text-white border border-solid"
                  >
                     Connect
                  </button>
               </div>
            </section>
         </main>
      </div>
   );
}
