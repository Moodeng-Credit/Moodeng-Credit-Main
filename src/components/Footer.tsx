

import { Link } from 'react-router-dom';

export default function Footer() {
   return (
      <footer className="flex overflow-hidden flex-col justify-center items-center px-4 md:px-8 lg:px-16 py-8 md:py-16 lg:py-32 w-full bg-indigo-500">
         <div className="w-full max-w-[1215px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
               {/* Logo and Info */}
               <div className="flex flex-col col-span-1 md:col-span-2 lg:col-span-1">
                  <Link to="/">
                     <div className="flex gap-1 justify-start items-center text-2xl font-extrabold leading-none mb-4">
                        <img
                           loading="lazy"
                           src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/ddc1516152425ac430ab66d1f7edd9dfeb66a8cba30f3f35194b98af38cd8bf4?apiKey=e485b3dc4b924975b4554885e21242bb"
                           alt="Moodeng Credit logo"
                           className="object-contain shrink-0 aspect-[0.87] w-[34px]"
                           width={100}
                           height={100}
                        />
                        <span className="text-white">Moodeng Credit</span>
                     </div>
                  </Link>
                  <p className="text-sm md:text-base leading-tight text-neutral-100 mb-4">FUTURE OF ONCHAIN CREDIT</p>
                  <div className="flex gap-3 mb-4">
                     <img
                        className="object-contain aspect-square w-[30px] hover:opacity-80 transition-opacity cursor-pointer"
                        alt="Social Link"
                        src="https://c.animaapp.com/VPWnEuWR/img/link.svg"
                        width={30}
                        height={30}
                     />
                     <img
                        className="object-contain aspect-square w-[30px] hover:opacity-80 transition-opacity cursor-pointer"
                        alt="Social Link"
                        src="https://c.animaapp.com/VPWnEuWR/img/link---svg.svg"
                        width={30}
                        height={30}
                     />
                     <img
                        className="object-contain aspect-square w-[30px] hover:opacity-80 transition-opacity cursor-pointer"
                        alt="Social Link"
                        src="https://c.animaapp.com/VPWnEuWR/img/link---svg-1.svg"
                        width={30}
                        height={30}
                     />
                     <img
                        className="object-contain aspect-square w-[30px] hover:opacity-80 transition-opacity cursor-pointer"
                        alt="Social Link"
                        src="https://c.animaapp.com/VPWnEuWR/img/link-1.svg"
                        width={30}
                        height={30}
                     />
                  </div>
                  <small className="text-xs tracking-normal leading-relaxed">
                     Copyright © 2025 Moodeng Credit | All rights reserved
                  </small>
               </div>

               {/* Platform Links */}
               <div className="flex flex-col">
                  <h3 className="text-base md:text-lg font-semibold leading-tight text-white mb-4">Platform</h3>
                  <nav className="flex flex-col gap-3 text-sm md:text-base">
                     <Link to="/dashboard" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Dashboard
                     </Link>
                     <Link to="/benefits" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Benefits
                     </Link>
                     <Link to="/guide" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Guide
                     </Link>
                     <Link to="/whylend" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Why Lend
                     </Link>
                  </nav>
               </div>

               {/* Company Links */}
               <div className="flex flex-col">
                  <h3 className="text-base md:text-lg font-semibold leading-tight text-white mb-4">Company</h3>
                  <nav className="flex flex-col gap-3 text-sm md:text-base">
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        About
                     </Link>
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Contact
                     </Link>
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Privacy Policy
                     </Link>
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Terms of Service
                     </Link>
                  </nav>
               </div>

               {/* Support Links */}
               <div className="flex flex-col">
                  <h3 className="text-base md:text-lg font-semibold leading-tight text-white mb-4">Support</h3>
                  <nav className="flex flex-col gap-3 text-sm md:text-base">
                     <a href="mailto:support@moodeng.app" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Contact Support
                     </a>
                     <Link to="/faq" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        FAQ
                     </Link>
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Documentation
                     </Link>
                     <Link to="/#" className="text-neutral-100 hover:text-blue-300 transition-colors">
                        Community
                     </Link>
                  </nav>
               </div>
            </div>
         </div>
      </footer>
   );
}
