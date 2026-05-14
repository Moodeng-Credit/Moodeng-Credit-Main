import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useEffect, useMemo, useState } from 'react';

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

export function BottomNavActionProvider({ children }: { children: ReactNode }) {
   const [primaryAction, setPrimaryAction] = useState<BottomNavPrimaryAction | null>(null);
   const value = useMemo(() => ({ primaryAction, setPrimaryAction }), [primaryAction]);

   return <BottomNavActionContext.Provider value={value}>{children}</BottomNavActionContext.Provider>;
}

export function useBottomNavActionState() {
   const context = useContext(BottomNavActionContext);
   if (!context) return { primaryAction: null };

   return { primaryAction: context.primaryAction };
}

export function useBottomNavPrimaryAction(action: BottomNavPrimaryAction | null) {
   const context = useContext(BottomNavActionContext);
   const setPrimaryAction = context?.setPrimaryAction;

   useEffect(() => {
      if (!setPrimaryAction) return undefined;

      setPrimaryAction(action);

      return () => {
         if (!action) return;
         setPrimaryAction((current) => (current?.id === action.id ? null : current));
      };
   }, [action, setPrimaryAction]);
}
