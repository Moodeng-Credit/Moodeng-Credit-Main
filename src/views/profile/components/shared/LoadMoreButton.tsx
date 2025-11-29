interface LoadMoreButtonProps {
   currentCount: number;
   totalCount: number;
   onLoadMore: () => void;
}

export default function LoadMoreButton({ currentCount, totalCount, onLoadMore }: LoadMoreButtonProps) {
   if (currentCount >= totalCount) {
      return null;
   }

   return (
      <div className="flex justify-center mt-6 md:mt-8">
         <button
            onClick={onLoadMore}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md px-10 py-2 text-xs md:text-sm transition"
            type="button"
         >
            Load More...
         </button>
      </div>
   );
}
