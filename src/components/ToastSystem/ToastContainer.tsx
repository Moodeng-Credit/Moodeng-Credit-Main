import { type FC, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import { handleToastAction } from '@/components/ToastSystem/config/utils';
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
   return (
      <div className="fixed bottom-4 right-4 z-[9999] max-w-sm">
         <div className="space-y-2">
            {toasts.map((toast: ToastPropsType) => (
               <Toast
                  key={toast.id}
                  id={toast.id}
                  toastType={toast.toastType as ToastType}
                  title={toast.title}
                  message={typeof toast.message === 'function' ? toast.message('') : toast.message}
                  buttonText={toast.buttonText}
                  buttonAction={toast.buttonAction}
                  emoji={toast.emoji}
                  customIcon={toast.customIcon}
                  customData={toast.customData}
                  duration={toast.duration}
                  autoClose={toast.autoClose}
                  onClose={removeToast}
                  onAction={onToastAction}
               />
            ))}
         </div>
      </div>
   );
};

export default ToastContainer;
