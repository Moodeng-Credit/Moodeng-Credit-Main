import React, { useEffect, useRef } from 'react';

export function useClickOutside<T extends HTMLElement>(
   onOutsideClick: () => void,
   isActive: boolean = true,
   excludeRef?: React.RefObject<HTMLElement | null>
) {
   const ref = useRef<T>(null);
   const callbackRef = useRef(onOutsideClick);

   useEffect(() => {
      callbackRef.current = onOutsideClick;
   });

   useEffect(() => {
      if (!isActive) return;

      const handleClickOutside = (event: MouseEvent) => {
         if (excludeRef?.current?.contains(event.target as Node)) return;
         if (ref.current && !ref.current.contains(event.target as Node)) {
            callbackRef.current();
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, [isActive, excludeRef]);

   return ref;
}
