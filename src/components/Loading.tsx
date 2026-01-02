

import '@/components/loading/Loading.scss';

interface LoadingProps {
   fullPage?: boolean;
}

const Loading = ({ fullPage = true }: LoadingProps) => {
   return (
      <div className={fullPage ? 'loading' : ''}>
         <div className={fullPage ? 'root' : ''}>
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
