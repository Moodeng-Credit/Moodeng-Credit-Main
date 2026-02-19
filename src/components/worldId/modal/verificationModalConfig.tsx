import { ExternalLink, Link as LinkIcon, MapPin, RefreshCw, Shield } from 'lucide-react';

import { type VerificationButton, type VerificationStep } from '@/components/worldId/modal/types';

export const verificationSteps: VerificationStep[] = [
   {
      stepNumber: 1,
      title: 'Get Verified with World ID',
      description: 'Find an Orb location, schedule an appointment, and complete your verification through the World ID app.',
      icon: <MapPin size={24} />,
      iconColor: 'bg-blue-100 text-blue-600',
      bgColor: 'bg-blue-50'
   },
   {
      stepNumber: 2,
      title: 'Connect to Our App',
      description: 'Once you\'re verified, use the "Connect World ID" button below to prove your human identity to our app.',
      icon: <LinkIcon size={24} />,
      iconColor: 'bg-purple-100 text-purple-600',
      bgColor: 'bg-purple-50'
   }
];

export const verificationButtons: VerificationButton[] = [
   {
      id: 'find-location',
      variant: 'primary',
      label: 'Find a Verification Location',
      icon: <MapPin size={20} />,
      action: 'externalLink',
      externalIcon: <ExternalLink size={16} />,
      url: 'https://worldcoin.org/find-orb'
   },
   {
      id: 'connect-world-id',
      variant: 'secondary',
      label: 'Connect World ID',
      icon: <Shield size={20} />,
      action: 'verify'
   },
   {
      id: 'check-status',
      variant: 'outline',
      label: 'Check Connection Status',
      icon: <RefreshCw size={20} />,
      action: 'checkStatus'
   }
];

export const dividerText = 'After completing verification at Orb';

export const sectionTitle = 'How It Works:';

export const modalHeaderConfig = {
   title: 'Verify Your Identity with World ID',
   description:
      'To protect our community and enable your loan request, you need to verify your identity. This is a one-time process done through our partner, World ID.'
};

export const noteConfig = {
   title: 'Note:',
   content:
      "All verification steps (scheduling, Orb visit, etc.) happen through the World ID app. We simply use World ID to confirm you're a verified human. After you're verified with World ID, connect your account to proceed with your loan application."
};
