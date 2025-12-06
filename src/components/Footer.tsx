'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

export default function Footer() {
   const [email, setEmail] = useState('');

   const handleSubscribe = (e: React.FormEvent) => {
      e.preventDefault();
      // Handle newsletter subscription
      console.log('Subscribe:', email);
      setEmail('');
   };

   return (
      <footer className="w-full bg-[#0f172a]">
         {/* Top Section */}
         <div className="px-6 md:px-16 lg:px-24 py-12 md:py-16">
            <div className="max-w-7xl mx-auto">
               <div className="flex flex-col lg:flex-row gap-8 lg:gap-16">
                  {/* Links Section */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-16 flex-1">
                     {/* Product Column */}
                     <div>
                        <h3 className="text-sm font-semibold text-white mb-4">Product</h3>
                        <nav className="flex flex-col space-y-3">
                           <Link href="/benefits" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Features
                           </Link>
                           <Link href="/whylend" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Why Lend?
                           </Link>
                           <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Dashboard
                           </Link>
                           <Link href="/guide" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Guide
                           </Link>
                        </nav>
                     </div>

                     {/* Information Column */}
                     <div>
                        <h3 className="text-sm font-semibold text-white mb-4">Information</h3>
                        <nav className="flex flex-col space-y-3">
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Docs
                           </a>
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              FAQs
                           </a>
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Support
                           </a>
                        </nav>
                     </div>

                     {/* Company Column */}
                     <div>
                        <h3 className="text-sm font-semibold text-white mb-4">Company</h3>
                        <nav className="flex flex-col space-y-3">
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              About us
                           </a>
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Blogs
                           </a>
                           <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                              Contact us
                           </a>
                        </nav>
                     </div>
                  </div>

                  {/* Newsletter Section */}
                  <div className="bg-[#1e293b] rounded-lg p-8 lg:w-[320px] flex-shrink-0">
                     <h3 className="text-sm font-semibold text-white mb-4">Get the latest updates!</h3>
                     <form onSubmit={handleSubscribe} className="flex mb-4 w-full">
                        <input
                           type="email"
                           value={email}
                           onChange={(e) => setEmail(e.target.value)}
                           placeholder="your@email.com"
                           className="flex-1 min-w-0 px-4 py-3 bg-white text-gray-900 text-sm placeholder-gray-400 rounded-l-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                           type="submit"
                           className="px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-r-lg transition-colors flex-shrink-0"
                        >
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                           </svg>
                        </button>
                     </form>
                     <p className="text-xs text-gray-400 leading-relaxed">
                        Hello, we are Moodeng. We created a new kind of Lender to Borrower experience. No Escrow and No Middle-man. Borrow and Lend from <span className="underline">Each other</span>.
                     </p>
                  </div>
               </div>
            </div>
         </div>

         {/* Bottom Section */}
         <div className="border-t border-gray-700 px-6 md:px-16 lg:px-24 py-6">
            <div className="max-w-7xl mx-auto">
               <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  {/* Logo */}
                  <div className="flex items-center gap-2">
                     <Image
                        src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/ddc1516152425ac430ab66d1f7edd9dfeb66a8cba30f3f35194b98af38cd8bf4?apiKey=e485b3dc4b924975b4554885e21242bb"
                        alt="Moodeng Credit logo"
                        width={32}
                        height={32}
                        className="object-contain"
                     />
                     <span className="text-white font-semibold text-lg">Moodeng Credit</span>
                  </div>

                  {/* Legal Links */}
                  <nav className="flex items-center gap-8">
                     <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Terms
                     </a>
                     <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Privacy
                     </a>
                     <a href="#" className="text-sm text-gray-400 hover:text-white transition-colors">
                        Cookies
                     </a>
                  </nav>

                  {/* Social Icons */}
                  <div className="flex items-center gap-3">
                     {/* LinkedIn */}
                     <a
                        href="#"
                        className="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                        aria-label="LinkedIn"
                     >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                     </a>
                     {/* Facebook */}
                     <a
                        href="#"
                        className="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                        aria-label="Facebook"
                     >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                     </a>
                     {/* Twitter/X */}
                     <a
                        href="#"
                        className="w-10 h-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
                        aria-label="Twitter"
                     >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                           <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                     </a>
                  </div>
               </div>
            </div>
         </div>
      </footer>
   );
}
