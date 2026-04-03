import { ArrowRight, ExternalLink, Link as LinkIcon, MapPin, RefreshCw, Shield } from 'lucide-react';

import { type VerificationButton, type VerificationStep } from '@/components/worldId/modal/types';

export const verificationSteps: VerificationStep[] = [
   {
      stepNumber: 1,
      title: 'Click "Verify with World ID"',
      description: 'Opens the verification modal',
      icon: <span>1</span>,
      iconColor: 'bg-md-primary-1100 text-white',
      bgColor: 'bg-md-primary-100'
   },
   {
      stepNumber: 2,
      title: 'Scan QR with World App',
      description: 'Uses your phone camera',
      icon: <span>2</span>,
      iconColor: 'bg-md-primary-1100 text-white',
      bgColor: 'bg-md-primary-100'
   },
   {
      stepNumber: 3,
      title: 'Confirm & Complete ',
      description: 'Verified instantly',
      icon: <span>3</span>,
      iconColor: 'bg-md-primary-1100 text-white',
      bgColor: 'bg-md-primary-100'
   }
];

export const verificationButtons: VerificationButton[] = [
   // {
   //    id: 'find-location',
   //    variant: 'primary',
   //    label: 'Find a Verification Location',
   //    icon: <MapPin size={20} />,
   //    action: 'externalLink',
   //    externalIcon: <ExternalLink size={16} />,
   //    url: 'https://worldcoin.org/find-orb'
   // },
   {
      id: 'connect-world-id',
      variant: 'primary',
      label: 'Verify with World ID',
      icon: <ArrowRight size={20} />,
      iconPosition: 'right',
      action: 'verify'
   }
   // {
   //    id: 'check-status',
   //    variant: 'outline',
   //    label: 'Check Connection Status',
   //    icon: <RefreshCw size={20} />,
   //    action: 'checkStatus'
   // }
];

export const dividerText = 'After completing verification at Orb';

export const sectionTitle = 'How to Verify?';

export const modalHeaderConfig = {
   title: "Verify You're Human",
   description: "Prove you're a real person with World ID"
};

export const noteConfig = {
   title: 'Note:',
   content: 'Privacy-First proof of personhood. Verify without revealing your identity.'
};
