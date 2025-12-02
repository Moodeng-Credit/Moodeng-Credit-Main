import { Poppins } from 'next/font/google';
import { type ReactNode } from 'react';

import { type Metadata } from 'next';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';

import Footer from '@/components/Footer';
import Header from '@/components/Header/Header';
import { Providers } from '@/components/providers';

import '@/app/globals.css';
import '@/lib/startup';

const poppins = Poppins({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900']
});

// eslint-disable-next-line react-refresh/only-export-components
export const metadata: Metadata = {
   title: 'Moodeng - Decentralized Microfinance Platform',
   description: 'A decentralized microfinance platform built on Web3 technology'
};

export default function RootLayout({ children }: { children: ReactNode }) {
   return (
      <html lang="en">
         <body className={poppins.className}>
            <Providers>
               <Header />
               <main>{children}</main>
               <Footer />
            </Providers>
         </body>
      </html>
   );
}
