import { getNetworkBgColor } from '@/utils/networkColors';
import { getNetworkIcon } from '@/utils/networkIcons';

interface NetworkIconProps {
   network: string;
   className?: string;
}

export function NetworkIcon({ network, className = '' }: NetworkIconProps) {
   const bgColor = getNetworkBgColor(network);
   const icon = getNetworkIcon(network);

   return (
      <button aria-label={`${network} network icon`} className={`${bgColor} rounded-md px-3 py-2 ${className}`}>
         {icon}
      </button>
   );
}
