import '@/components/loading/Loading.scss';

const Loading = () => {
   return (
      <div className="loading" role="status" aria-live="polite" aria-label="Loading Moodeng">
         <div className="loading-card" aria-hidden="true">
            <img src="/brand/moodeng-logo.png" alt="" className="loading-logo" />
            <div className="loading-track">
               <span />
               <span />
               <span />
            </div>
         </div>
      </div>
   );
};

export default Loading;
