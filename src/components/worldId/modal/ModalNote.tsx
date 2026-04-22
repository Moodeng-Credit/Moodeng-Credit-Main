import { type FC } from 'react';

import { noteConfig } from '@/components/worldId/modal/verificationModalConfig';

export const ModalNote: FC = () => {
   return (
      <div className="px-4 text-xs font-sans text-gray-600 mb-3 sm:mb-5">
         <p className="font-semibold text-gray-500 ">{noteConfig.content}</p>
      </div>
   );
};
