import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type BottomNavPrimaryAction = {
   ariaLabel: string;
   disabled: boolean;
   icon: string;
   id: string;
   isProcessing?: boolean;
   label: string;
   onClick: () => void;
   path: string;
};

type BottomNavActionContextValue = {
   primaryAction: BottomNavPrimaryAction | null;
   setPrimaryAction: Dispatch<SetStateAction<BottomNavPrimaryAction | null>>;
};

const BottomNavActionContext = createContext<BottomNavActionContextValue | null>(null);

const isSamePrimaryAction = (left: BottomNavPrimaryAction | null, right: BottomNavPrimaryAction | null) => {
   if (left === right) return true;
   if (!left || !right) return false;

   return (
      left.id === right.id &&
      left.path === right.path &&
      left.ariaLabel === right.ariaLabel &&
      left.disabled === right.disabled &&
      left.icon === right.icon &&
      left.isProcessing === right.isProcessing &&
      left.label === right.label &&
      left.onClick === right.onClick
   );
};

export function BottomNavActionProvider({ children }: { children: ReactNode }) {
   const [primaryAction, setPrimaryAction] = useState<BottomNavPrimaryAction | null>(null);
   const location = useLocation();
   const value = useMemo(() => ({ primaryAction, setPrimaryAction }), [primaryAction]);

   useEffect(() => {
      setPrimaryAction((current) => {
         if (!current || current.path === location.pathname) return current;
         return null;
      });
   }, [location.pathname]);

   return <BottomNavActionContext.Provider value={value}>{children}</BottomNavActionContext.Provider>;
}

export function useBottomNavActionState() {
   const context = useContext(BottomNavActionContext);
   if (!context) return { primaryAction: null, setPrimaryAction: () => undefined };

   return { primaryAction: context.primaryAction, setPrimaryAction: context.setPrimaryAction };
}

export function useBottomNavPrimaryAction(action: BottomNavPrimaryAction | null) {
   const context = useContext(BottomNavActionContext);
   const location = useLocation();
   const setPrimaryAction = context?.setPrimaryAction;

   useEffect(() => {
      if (!setPrimaryAction) return undefined;

      if (!action) {
         setPrimaryAction((current) => (current ? null : current));
         return undefined;
      }

      if (action.path !== location.pathname) {
         setPrimaryAction((current) => (current?.id === action.id ? null : current));
         return undefined;
      }

      setPrimaryAction((current) => (isSamePrimaryAction(current, action) ? current : action));

      return () => {
         setPrimaryAction((current) => (current?.id === action.id ? null : current));
      };
   }, [action, location.pathname, setPrimaryAction]);
}
