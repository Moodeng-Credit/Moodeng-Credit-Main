export interface VerificationStep {
   stepNumber: number;
   title: string;
   description: string;
   icon: React.ReactNode;
   iconColor: string;
   bgColor: string;
}

export interface VerificationButton {
   id: string;
   variant: 'primary' | 'secondary' | 'outline';
   label: string;
   icon: React.ReactNode;
   action: 'externalLink' | 'verify' | 'checkStatus';
   externalIcon?: React.ReactNode;
   url?: string;
}
