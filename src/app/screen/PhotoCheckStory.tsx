import HippoStory from '@/app/screen/HippoStory';

// While a job photo uploads and the AI looks at it: the hippo frames their photo (see HippoStory).
export default function PhotoCheckStory({ done = false }: { done?: boolean }) {
   return (
      <div className="absolute inset-0 flex items-center justify-center px-4">
         <HippoStory done={done} kind="photo" />
      </div>
   );
}
