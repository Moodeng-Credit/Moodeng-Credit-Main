

interface TextWithLineProps {
   text: string;
   textColour: string;
   lineColour: string;
   sx?: string;
}

export default function TextWithLine({ text, textColour, lineColour, sx }: TextWithLineProps) {
   const styles = !sx ? 'flex items-center gap-3  pt-4' : sx;
   const bgColor = lineColour.replace('border-', 'bg-');
   return (
      <div className={styles}>
         <div className={`h-px flex-1 ${bgColor}`}></div>
         <span className={`text-sm ${textColour}`}>{text}</span>
         <div className={`h-px flex-1 ${bgColor}`}></div>
      </div>
   );
}
