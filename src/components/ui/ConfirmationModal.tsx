import Modal from '@/components/ui/Modal';

interface ConfirmationModalProps {
   isOpen: boolean;
   onClose: () => void;
   onConfirm: () => void | Promise<void>;
   title: string;
   message: string;
   confirmText?: string;
   cancelText?: string;
   confirmButtonClass?: string;
}

export function ConfirmationModal({
   isOpen,
   onClose,
   onConfirm,
   title,
   message,
   confirmText = 'Confirm',
   cancelText = 'Cancel',
   confirmButtonClass = 'bg-red-500 text-white'
}: ConfirmationModalProps) {
   const handleConfirm = async () => {
      await onConfirm();
      onClose();
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} showCloseButton className="w-full max-w-[473px]">
         <main className="flex flex-col py-7 w-full bg-white rounded-3xl border border-solid border-neutral-200 shadow-[0px_2px_8px_rgba(0,0,0,0.25)] overflow-hidden">
            <section className="flex flex-col px-5 w-full">
               <h1 className="self-start text-2xl font-medium leading-none text-black">{title}</h1>
               <p className="mt-5 text-sm leading-6 text-gray-500 text-opacity-60">{message}</p>
               <div className="self-end mt-5">
                  <button
                     onClick={onClose}
                     className="mr-2 overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] bg-white text-black border border-solid transition-colors hover:bg-gray-50"
                  >
                     {cancelText}
                  </button>
                  <button
                     onClick={handleConfirm}
                     className={`overflow-hidden flex-auto gap-5 self-stretch px-5 py-3.5 rounded-lg min-h-[46px] border border-solid transition-opacity hover:opacity-90 ${confirmButtonClass}`}
                     type="button"
                  >
                     {confirmText}
                  </button>
               </div>
            </section>
         </main>
      </Modal>
   );
}
