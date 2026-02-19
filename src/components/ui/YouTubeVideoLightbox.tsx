

import type { ReactElement } from 'react';

import 'lightgallery/css/lg-video.css';
import 'lightgallery/css/lightgallery.css';
import lgVideo from 'lightgallery/plugins/video';
import LightGallery from 'lightgallery/react';

interface YouTubeVideoLightboxProps {
   readonly videoId: string;
   readonly className?: string;
   readonly title?: string;
}

export default function YouTubeVideoLightbox({
   videoId,
   className = 'flex items-center text-blue-600 text-xs md:text-sm font-normal mt-4 sm:mt-0 space-x-1 hover:text-blue-700 transition-colors cursor-pointer bg-transparent border-none',
   title = 'Credit Levelling Guide'
}: YouTubeVideoLightboxProps): ReactElement {
   return (
      <LightGallery download={false} counter={false} closable plugins={[lgVideo]}>
         <a
            data-lg-size="1280-720"
            className={className}
            data-src={`https://www.youtube.com/watch?v=${videoId}?autoplay=1&mute=0&volume=1`}
            data-poster={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            data-sub-html={title}
            data-video='{"autoplay": true, "muted": false, "volume": 1}'
         >
            <i className="fas fa-play-circle"></i>
            <span>{title}!</span>
         </a>
      </LightGallery>
   );
}
