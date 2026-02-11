import { useEffect, useRef, useState } from 'react';

const ITEMS_PER_PAGE = 12;

interface UsePaginationOptions<T> {
   items: T[];
   itemsPerPage?: number;
   resetDependencies?: unknown[];
}

interface UsePaginationReturn<T> {
   displayedItems: T[];
   displayedCount: number;
   totalCount: number;
   handleLoadMore: () => void;
   hasMore: boolean;
}

export function usePagination<T>({
   items,
   itemsPerPage = ITEMS_PER_PAGE,
   resetDependencies = []
}: UsePaginationOptions<T>): UsePaginationReturn<T> {
   const [displayedCount, setDisplayedCount] = useState(itemsPerPage);
   const prevDepsRef = useRef<unknown[]>([]);

   // Reset displayed count when dependencies change
   useEffect(() => {
      const depsChanged = resetDependencies.some((dep, index) => dep !== prevDepsRef.current[index]);
      if (depsChanged || prevDepsRef.current.length !== resetDependencies.length) {
         setDisplayedCount(itemsPerPage);
         prevDepsRef.current = resetDependencies;
      }
   }, [itemsPerPage, resetDependencies]);

   const handleLoadMore = () => {
      setDisplayedCount((prev) => prev + itemsPerPage);
   };

   const displayedItems = items.slice(0, displayedCount);
   const hasMore = displayedCount < items.length;

   return {
      displayedItems,
      displayedCount,
      totalCount: items.length,
      handleLoadMore,
      hasMore
   };
}
