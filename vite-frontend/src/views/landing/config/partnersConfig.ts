import { type PartnerLogoType, type PartnerSection } from '@/views/landing/types';

// Re-export types for backward compatibility
export type { PartnerLogoType };

const partnersData: PartnerLogoType[] = [
   {
      name: 'WorldId.me',
      src: 'https://c.animaapp.com/VPWnEuWR/img/cupa2g0wnmx9mz6zckrnmdqg-png@2x.png',
      alt: 'WorldId.me Logo',

      className: 'opacity-70'
   },
   {
      name: 'OpenEdX',
      src: 'https://c.animaapp.com/VPWnEuWR/img/bjkyngncuergwayb0vmgcjnnhk-png@2x.png',
      alt: 'OpenEdX Logo',
      width: 120,
      className: 'opacity-[0.59]'
   },
   {
      name: 'Polygon Labs',
      src: '/polygon_labs.png',
      alt: 'Polygon Labs Logo',
      width: 200
   },
   {
      name: 'UNHCR',
      src: 'https://c.animaapp.com/VPWnEuWR/img/unhcr-1@2x.png',
      alt: 'Unhcr'
   }
];

const avatarImages = [
   'https://c.animaapp.com/VPWnEuWR/img/ellipse-150@2x.png',
   'https://c.animaapp.com/VPWnEuWR/img/ellipse-151.svg',
   'https://c.animaapp.com/VPWnEuWR/img/ellipse-152.svg',
   'https://c.animaapp.com/VPWnEuWR/img/ellipse-153.svg'
];

export const partnersConfig: PartnerSection = {
   title: 'TRUSTED BY PARTNERS AND INDIVIDUAL CREDIT BUILDERS',
   partners: partnersData,
   stats: {
      number: '1000+',
      label: 'More',
      avatars: avatarImages
   }
};
