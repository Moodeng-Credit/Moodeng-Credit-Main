

import { type JSX } from 'react';

import AuthFormSection from '@/views/login/sections/AuthFormSection';
import '@/views/login/styles/Login.css';

export default function Login(): JSX.Element {
   return (
      <>
         <div className="flex overflow-hidden flex-col bg-zinc-100 min-h-screen">
            <div className="flex flex-col items-center w-full min-h-full max-md:max-w-full">
               <AuthFormSection />
            </div>
         </div>
      </>
   );
}
