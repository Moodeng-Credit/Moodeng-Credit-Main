'use client';

import { type FC, useCallback, useEffect, useState } from 'react';

import Image from 'next/image';

import { CheckCircle, Clock, Coins, Fingerprint, Lock, type LucideIcon, TriangleAlert, Wifi, X } from 'lucide-react';

import { TOAST_VARIANTS } from '@/components/ToastSystem/config/toastConfig';
import { type ToastData, type ToastPropsType } from '@/components/ToastSystem/types';

const LUCIDE_ICONS: Record<string, LucideIcon> = {
   Fingerprint,
   Wifi,
   Coins,
   Lock,
   CheckCircle,
   Clock,
   TriangleAlert
};

interface SvgIconProps {
   src: string;
   className?: string;
}

const SvgIcon: FC<SvgIconProps> = ({ src, className }) => {
   return <Image src={src} className={className} alt="icon" width={16} height={16} />;
};

interface ToastProps extends ToastPropsType {
   onClose: (id: number) => void;
   onAction?: (action: string, customData: ToastData) => void;
   duration?: number;
   autoClose?: boolean;
}

const Toast: FC<ToastProps> = ({
   id,
   toastType,
   title,
   message,
   buttonText,
   buttonAction,
   emoji,
   customIcon,
   customData,
   onClose,
   onAction,
   duration = 5000,
   autoClose = true
}) => {
   const [isVisible, setIsVisible] = useState(false);
   const [isLeaving, setIsLeaving] = useState(false);

   const variant = TOAST_VARIANTS[toastType as keyof typeof TOAST_VARIANTS] || TOAST_VARIANTS.info;
   const iconToUse = customIcon || variant.icon;

   // Get the icon component if it's a Lucide icon
   const isSvgIcon = typeof iconToUse === 'string' && iconToUse.endsWith('.svg');
   const IconComponent = !isSvgIcon && typeof iconToUse === 'string' ? LUCIDE_ICONS[iconToUse] : null;

   const handleClose = useCallback(() => {
      setIsLeaving(true);
      setTimeout(() => {
         onClose(id);
      }, 300);
   }, [onClose, id]);

   useEffect(() => {
      if (autoClose && duration > 0) {
         const timer = setTimeout(() => {
            handleClose();
         }, duration);

         return () => clearTimeout(timer);
      }
   }, [autoClose, duration, handleClose]);

   useEffect(() => {
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
   }, []);

   const handleAction = () => {
      if (onAction && buttonAction) {
         onAction(buttonAction, customData || {});
      }
      handleClose();
   };

   return (
      <div
         className={`
        relative flex shadow-lg rounded border border-gray-200 bg-white max-w-[320px] mb-4
        transform transition-all duration-300 ease-in-out
        ${isVisible && !isLeaving ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${isLeaving ? 'translate-x-full opacity-0' : ''}
      `}
      >
         <button aria-label="Close" className="absolute top-2 right-2 p-1 text-black hover:text-gray-700 z-10" onClick={handleClose}>
            <X size={12} />
         </button>

         <div className={`flex flex-col justify-center items-center ${variant.iconBg} w-10 relative rounded-l`}>
            <div className={variant.iconColor}>
               {isSvgIcon ? (
                  <SvgIcon src={iconToUse as string} className="w-4 h-4" />
               ) : IconComponent ? (
                  <IconComponent size={16} strokeWidth={2} />
               ) : null}
            </div>
         </div>

         <div className="p-4 flex-1 pr-8">
            <p className="font-extrabold text-[13px] leading-tight flex items-center gap-1">
               <span>{title}</span>
               {emoji ? <span>{emoji}</span> : null}
            </p>
            <p className="text-[13px] leading-tight font-normal">{message as string}</p>
            {buttonText ? (
               <p className={`text-[13px] font-bold ${variant.textColor} mt-1 cursor-pointer hover:underline`} onClick={handleAction}>
                  {buttonText}
               </p>
            ) : null}
         </div>
      </div>
   );
};

export default Toast;
