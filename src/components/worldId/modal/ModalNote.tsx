import { type FC } from 'react';

import { noteConfig } from '@/components/worldId/modal/verificationModalConfig';

export const ModalNote: FC = () => {
   return (
      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600">
         <p>
            <strong className="font-semibold text-gray-700">{noteConfig.title}</strong> {noteConfig.content}
         </p>
      </div>
   );
};
