import { type ReactNode } from 'react';

export interface VerificationStep {
   stepNumber: number;
   title: string;
   description: string;
   icon: ReactNode;
   iconColor: string;
   bgColor: string;
}

export interface VerificationButton {
   id: string;
   variant: 'primary' | 'secondary' | 'outline';
   label: string;
   icon: ReactNode;
   iconPosition?: 'left' | 'right';
   action: 'externalLink' | 'verify' | 'checkStatus';
   externalIcon?: ReactNode;
   url?: string;
}
