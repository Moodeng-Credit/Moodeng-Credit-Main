import { type JSX } from 'react';

import ActionButton from '@/components/ui/ActionButton';

import { verifyIdentityButtons } from '@/config/buttonConfig';

const listData = [
   {
      title: 'Blockchain-based identity verification'
   },

   {
      title: 'User-controlled data sharing'
   },
   {
      title: 'Enhances trust in peer-to-peer transactions'
   }
];

export default function VerifyIdentitySection(): JSX.Element {
   return (
      <div className="flex flex-col self-center px-10 py-8 mt-9 max-w-full text-white bg-blue-600 rounded-[29px] shadow-[0px_4px_6px_rgba(0,0,0,0.1)] w-[767px] max-md:px-5">
         <div className="pb-px text-2xl font-extrabold max-md:max-w-full">WorldId: On-Chain Identity Verification</div>
         <div className="pb-px mt-3.5 text-2xl max-md:max-w-full">
            WorldId is a decentralized identity company since 2017 that provides secure, on-chain verification of digital identities. As a
            third-party authenticator, WorldId ensures user privacy while enabling trusted interactions in the digital world.
         </div>
         <div className="flex flex-row items-end justify-between mt-3.5 max-md:flex-col">
            <ul className="flex flex-col pl-5 ml-[5%] text-lg list-disc max-md:max-w-full">
               {listData.map((item) => (
                  <li key={item.title} className="pb-px w-full max-md:max-w-full">
                     {item.title}
                  </li>
               ))}
            </ul>
            <ActionButton button={verifyIdentityButtons[0]} />
         </div>
      </div>
   );
}
