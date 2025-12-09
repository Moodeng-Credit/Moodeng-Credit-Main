'use client';

import type { ReactNode } from 'react';

// import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { usePathname } from 'next/navigation';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';

import Footer from '@/components/Footer';
import Header from '@/components/Header/Header';
import { Providers } from '@/components/providers';

import '@/app/globals.css';
import '@/lib/startup';

const inter = Inter({ subsets: ['latin'] });

// export const metadata: Metadata = {
//    title: 'Moodeng - Decentralized Microfinance Platform',
//    description: 'A decentralized microfinance platform built on Web3 technology'
// };

export default function RootLayout({ children }: { children: ReactNode }) {
   const pathname = usePathname();
   const migrationPages = ['/dashboard2'];
   if (migrationPages.includes(pathname)) {
      return (
         <html lang="en">
            <body className={inter.className}>{children}</body>
         </html>
      );
   }

   return (
      <html lang="en">
         <body className={inter.className}>
            <Providers>
               <Header />
               <main>{children}</main>
               <Footer />
            </Providers>
         </body>
      </html>
   );
}
