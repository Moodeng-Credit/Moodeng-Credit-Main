

import type { ReactNode } from 'react';
import { createContext, useCallback, useMemo, useReducer } from 'react';

import { TOAST_SETTINGS } from '@/components/ToastSystem/config/toastConfig';
import { TOAST_TYPES, type ToastPropsType } from '@/components/ToastSystem/types';

import { signalSupportProblem } from '@/lib/support/liveChat';

interface ToastState {
   toasts: ToastPropsType[];
}

interface ToastContextType {
   toasts: ToastPropsType[];
   addToast: (toastData: Omit<ToastPropsType, 'id'>) => void;
   removeToast: (toastId: number) => void;
   clearAllToasts: () => void;
   updateToast: (toastId: number, updates: Partial<ToastPropsType>) => void;
   autoRemoveToast: (toastId: number, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

type ToastAction =
   | { type: 'ADD_TOAST'; payload: Omit<ToastPropsType, 'id'> }
   | { type: 'REMOVE_TOAST'; payload: number }
   | { type: 'CLEAR_ALL_TOASTS' }
   | { type: 'UPDATE_TOAST'; payload: { id: number; updates: Partial<ToastPropsType> } };

const toastReducer = (state: ToastState, action: ToastAction): ToastState => {
   switch (action.type) {
      case 'ADD_TOAST': {
         // Collapse duplicates: if an identical toast (same type + title + message) is already
         // on screen, don't stack another. Background/late sources — the Base-pay reconciler
         // confirming a fund the live flow already toasted, a re-render re-firing the same
         // message — otherwise pop the same toast twice and read as "random". Auto-close then
         // clears the single toast normally.
         const isDuplicate = state.toasts.some(
            (toast) =>
               toast.toastType === action.payload.toastType &&
               toast.title === action.payload.title &&
               toast.message === action.payload.message
         );
         if (isDuplicate) return state;

         let toasts = state.toasts;
         if (toasts.length >= TOAST_SETTINGS.MAX_TOASTS) {
            toasts = toasts.slice(1);
         }
         return {
            ...state,
            toasts: [...toasts, { ...action.payload, id: Date.now() + Math.random() }]
         };
      }

      case 'REMOVE_TOAST':
         return {
            ...state,
            toasts: state.toasts.filter((toast) => toast.id !== action.payload)
         };

      case 'CLEAR_ALL_TOASTS':
         return {
            ...state,
            toasts: []
         };

      case 'UPDATE_TOAST':
         return {
            ...state,
            toasts: state.toasts.map((toast) => (toast.id === action.payload.id ? { ...toast, ...action.payload.updates } : toast))
         };

      default:
         return state;
   }
};

const initialState: ToastState = {
   toasts: []
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
   const [state, dispatch] = useReducer(toastReducer, initialState);

   const addToast = useCallback((toastData: Omit<ToastPropsType, 'id'>) => {
      // An error toast = the user just hit a problem → make sure the support chat
      // is loaded and its launcher visible, so "message a human" is one tap away
      // at the exact moment they need it rather than after the idle-load lands.
      if (toastData.toastType === TOAST_TYPES.ERROR) signalSupportProblem();
      dispatch({ type: 'ADD_TOAST', payload: toastData });
   }, []);

   const removeToast = useCallback((toastId: number) => {
      dispatch({ type: 'REMOVE_TOAST', payload: toastId });
   }, []);

   const clearAllToasts = useCallback(() => {
      dispatch({ type: 'CLEAR_ALL_TOASTS' });
   }, []);

   const updateToast = useCallback((toastId: number, updates: Partial<ToastPropsType>) => {
      dispatch({ type: 'UPDATE_TOAST', payload: { id: toastId, updates } });
   }, []);

   const autoRemoveToast = useCallback(
      (toastId: number, duration?: number) => {
         const timeoutDuration = duration ?? TOAST_SETTINGS.DEFAULT_DURATION;
         setTimeout(() => {
            removeToast(toastId);
         }, timeoutDuration);
      },
      [removeToast]
   );

   const value: ToastContextType = useMemo(
      () => ({
         toasts: state.toasts,
         addToast,
         removeToast,
         clearAllToasts,
         updateToast,
         autoRemoveToast
      }),
      [state.toasts, addToast, removeToast, clearAllToasts, updateToast, autoRemoveToast]
   );

   return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
};

export default ToastContext;
