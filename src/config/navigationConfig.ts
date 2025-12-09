export const logoImageSrc = 'https://c.animaapp.com/VPWnEuWR/img/file--4--1@2x.png';

export type NavLink = {
   text: string;
   href: string;
   isExternal?: boolean;
};

export const headerLinks: NavLink[] = [
   {
      text: 'Guide',
      href: '/guide'
   },
   {
      text: 'Why Lend?',
      href: '/whylend'
   },
   {
      text: 'Benefits',
      href: '/benefits'
   },
   {
      text: 'Docs',
      href: 'https://moodeng-credit.gitbook.io/moodeng-credit',
      isExternal: true
   }
];
