import { Input } from '@/components/shadcn/input';
import { Button } from '@/components/shadcn/button';

interface BrowseRequestsHeaderProps {
   searchValue: string;
   onSearchChange: (value: string) => void;
   onFilterClick: () => void;
}

export default function BrowseRequestsHeader({
   searchValue,
   onSearchChange,
   onFilterClick
}: BrowseRequestsHeaderProps) {
   return (
      <div className="mb-6">
         <h2 className="text-xl font-semibold text-foreground mb-4">Browse Latest Requests</h2>
         <div className="flex items-center gap-3">
            <div className="flex-1 relative">
               <span className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-4 text-muted-foreground pointer-events-none">
                  <svg
                     width="16"
                     height="16"
                     viewBox="0 0 24 24"
                     fill="none"
                     stroke="currentColor"
                     strokeWidth="2"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     className="shrink-0"
                  >
                     <circle cx="11" cy="11" r="8" />
                     <path d="m21 21-4.35-4.35" />
                  </svg>
               </span>
               <Input
                  type="text"
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search requests"
                  className="pl-9 h-11 rounded-lg border-input"
               />
            </div>
            <Button
               variant="outline"
               size="icon"
               className="h-11 w-11 rounded-lg shrink-0 text-[#6d57ff] border-input hover:bg-muted/50"
               onClick={onFilterClick}
               aria-label="Filter requests"
            >
               <svg
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
               >
                  <path
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     strokeWidth={2}
                     d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
               </svg>
            </Button>
         </div>
      </div>
   );
}
