import { useEffect, useRef } from 'react';

/**
 * Custom hook to handle clicking outside of a referenced element
 * @param onOutsideClick - Callback function to execute when clicking outside
 * @param isActive - Whether the click outside listener should be active (optional, defaults to true)
 * @returns A ref to attach to the element you want to detect clicks outside of
 */
export function useClickOutside<T extends HTMLElement>(onOutsideClick: () => void, isActive: boolean = true) {
   const ref = useRef<T>(null);

   useEffect(() => {
      if (!isActive) return;

      const handleClickOutside = (event: MouseEvent) => {
         if (ref.current && !ref.current.contains(event.target as Node)) {
            onOutsideClick();
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, [onOutsideClick, isActive]);

   return ref;
}
