/** Full-viewport loading state (bootstrap, persist rehydrate, auth confirm, etc.). */
const Loading = () => {
   return (
      <div
         className="flex min-h-dvh w-full items-center justify-center bg-gradient-to-b from-[#FBFAFD] to-[#FFFFFF]"
         role="status"
         aria-live="polite"
         aria-busy="true"
      >
         <span className="sr-only">Loading</span>
         <div
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-2 border-[#E8E5EF] border-t-[#6010D2]"
            aria-hidden
         />
      </div>
   );
};

export default Loading;
