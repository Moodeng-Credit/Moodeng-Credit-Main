import { type FC, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { handleToastAction, isToastActionAvailable } from '@/components/ToastSystem/config/utils';
import { useToastContext } from '@/components/ToastSystem/hooks/useToastContext';
import Toast from '@/components/ToastSystem/Toast';
import { type ToastData, type ToastPropsType, type ToastType } from '@/components/ToastSystem/types';

const ToastContainer: FC = () => {
   const { toasts, removeToast } = useToastContext();
   const navigate = useNavigate();

   const onToastAction = useCallback(
      (action: string, customData?: ToastData) => {
         handleToastAction(action, customData || {}, navigate);
      },
      [navigate]
   );

   if (toasts.length === 0) {
      return null;
   }

   // z-[9999]: above the loan modal (z-[70]) and its calendar (z-[90]) so error toasts are
   // never hidden behind an open card, but below the Mecha panel (z-[10001]).
   // On phones toasts sit at the top: bottom-right put them on top of the bottom nav and under the
   // support chat launcher/panel, which hid the very error a borrower needed to read.
   return (
      <div className="pointer-events-none fixed inset-x-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[9999] flex flex-col items-end sm:inset-x-auto sm:right-4 sm:top-auto sm:bottom-4 sm:max-w-sm">
         <div className="w-full max-w-[320px] space-y-2">
            {toasts.map((toast: ToastPropsType) => {
               const hasAction = isToastActionAvailable(toast.buttonAction, toast.customData);
               return (
                  <Toast
                     key={toast.id}
                     id={toast.id}
                     toastType={toast.toastType as ToastType}
                     title={toast.title}
                     message={typeof toast.message === 'function' ? toast.message('') : toast.message}
                     buttonText={hasAction ? toast.buttonText : undefined}
                     buttonAction={hasAction ? toast.buttonAction : undefined}
                     emoji={toast.emoji}
                     customIcon={toast.customIcon}
                     customData={toast.customData}
                     duration={toast.duration}
                     autoClose={toast.autoClose}
                     onClose={removeToast}
                     onAction={onToastAction}
                  />
               );
            })}
         </div>
      </div>
   );
};

export default ToastContainer;
