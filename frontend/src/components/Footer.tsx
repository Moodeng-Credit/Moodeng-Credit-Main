


import { Link } from 'react-router-dom';

export default function Footer() {
   return (
      <footer className="flex overflow-hidden flex-col justify-center items-center px-16 py-32 w-full bg-indigo-500 max-md:px-5 max-md:py-24 max-md:max-w-full">
         <div className="mb-0 w-full max-w-[1215px] max-md:mb-2.5 max-md:max-w-full">
            <div className="flex gap-5 max-md:flex-col">
               <div className="flex flex-col w-[40%] max-md:ml-0 max-md:w-full">
                  <div className="flex grow gap-2 items-end text-white max-md:mt-10">
                     <div className="flex flex-col items-start self-stretch">
                        <Link to="/">
                           <div className="flex gap-1 justify-center items-center self-start text-2xl font-extrabold leading-none">
                              <img
                                 loading="lazy"
                                 src="https://cdn.builder.io/api/v1/image/assets/e485b3dc4b924975b4554885e21242bb/ddc1516152425ac430ab66d1f7edd9dfeb66a8cba30f3f35194b98af38cd8bf4?apiKey=e485b3dc4b924975b4554885e21242bb"
                                 alt="Moodeng Credit logo"
                                 className="object-contain shrink-0 self-start aspect-[0.87] w-[34px]"
                                 width={100}
                                 height={100}
                              />
                              <span className="self-stretch my-auto text-white">Moodeng Credit</span>
                           </div>
                        </Link>
                        <p className="self-stretch mt-5 text-lg leading-tight text-neutral-100 max-md:mr-2.5">FUTURE OF ONCHAIN CREDIT</p>
                        <div className="flex gap-2 self-stretch text-xs tracking-normal leading-none text-neutral-100">
                           <img
                              className="object-contain mt-10 mr-5 aspect-square w-[30px]"
                              alt="Social Link"
                              src="https://c.animaapp.com/VPWnEuWR/img/link.svg"
                              width={100}
                              height={100}
                           />
                           <img
                              className="object-contain mt-10 mr-5 aspect-square w-[30px]"
                              alt="Social Link"
                              src="https://c.animaapp.com/VPWnEuWR/img/link---svg.svg"
                              width={100}
                              height={100}
                           />
                           <img
                              className="object-contain mt-10 mr-5 aspect-square w-[30px]"
                              alt="Social Link"
                              src="https://c.animaapp.com/VPWnEuWR/img/link---svg-1.svg"
                              width={100}
                              height={100}
                           />
                           <img
                              className="object-contain mt-10 mr-5 aspect-square w-[30px]"
                              alt="Social Link"
                              src="https://c.animaapp.com/VPWnEuWR/img/link-1.svg"
                              width={100}
                              height={100}
                           />
                        </div>
                        <small className="mt-10 text-xs tracking-normal leading-relaxed">
                           Copyright © 2025 Moodeng Credit | All rights reserved
                        </small>
                     </div>
                  </div>
               </div>

               <div className="flex flex-col ml-5 w-[20%] max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col text-white max-md:mt-10">
                     <h3 className="text-lg font-semibold leading-tight">Platform</h3>
                     <nav className="flex flex-col mt-5 text-base leading-relaxed">
                        <Link to="/dashboard" className="hover:text-blue-300 transition-colors">
                           Dashboard
                        </Link>
                        <Link to="/benefits" className="mt-3 hover:text-blue-300 transition-colors">
                           Benefits
                        </Link>
                        <Link to="/guide" className="mt-3 hover:text-blue-300 transition-colors">
                           Guide
                        </Link>
                        <Link to="/whylend" className="mt-3 hover:text-blue-300 transition-colors">
                           Why Lend
                        </Link>
                     </nav>
                  </div>
               </div>

               <div className="flex flex-col ml-5 w-[20%] max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col text-white max-md:mt-10">
                     <h3 className="text-lg font-semibold leading-tight">Company</h3>
                     <nav className="flex flex-col mt-5 text-base leading-relaxed">
                        <a href="#" className="hover:text-blue-300 transition-colors">
                           About
                        </a>
                        <a href="#" className="mt-3 hover:text-blue-300 transition-colors">
                           Contact
                        </a>
                        <a href="#" className="mt-3 hover:text-blue-300 transition-colors">
                           Privacy Policy
                        </a>
                        <a href="#" className="mt-3 hover:text-blue-300 transition-colors">
                           Terms of Service
                        </a>
                     </nav>
                  </div>
               </div>

               <div className="flex flex-col ml-5 w-[20%] max-md:ml-0 max-md:w-full">
                  <div className="flex flex-col text-white max-md:mt-10">
                     <h3 className="text-lg font-semibold leading-tight">Support</h3>
                     <nav className="flex flex-col mt-5 text-base leading-relaxed">
                        <a href="mailto:support@moodeng.app" className="hover:text-blue-300 transition-colors">
                           Contact Support
                        </a>
                        <Link to="/faq" className="mt-3 hover:text-blue-300 transition-colors">
                           FAQ
                        </Link>
                        <a href="#" className="mt-3 hover:text-blue-300 transition-colors">
                           Documentation
                        </a>
                        <a href="#" className="mt-3 hover:text-blue-300 transition-colors">
                           Community
                        </a>
                     </nav>
                  </div>
               </div>
            </div>
         </div>
      </footer>
   );
}
