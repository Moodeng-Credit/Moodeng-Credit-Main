'use client';

import '@/components/loading/Loading.scss';

const Loading = () => {
   return (
      <div className="loading">
         <div className="loading-root">
            <div className="pl">
               <div className="pl__coin">
                  <div className="pl__coin-flare"></div>
                  <div className="pl__coin-flare"></div>
                  <div className="pl__coin-flare"></div>
                  <div className="pl__coin-flare"></div>
                  <div className="pl__coin-layers">
                     <div className="pl__coin-layer">
                        <div className="pl__coin-inscription"></div>
                     </div>
                     <div className="pl__coin-layer"></div>
                     <div className="pl__coin-layer"></div>
                     <div className="pl__coin-layer"></div>
                     <div className="pl__coin-layer">
                        <div className="pl__coin-inscription"></div>
                     </div>
                  </div>
               </div>
               <div className="pl__shadow"></div>
            </div>
         </div>
      </div>
   );
};

export default Loading;
