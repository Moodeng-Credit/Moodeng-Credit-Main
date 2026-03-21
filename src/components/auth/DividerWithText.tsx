interface DividerWithTextProps {
   text?: string;
   className?: string;
   /** Line color - default #9285A0 per design */
   lineColor?: string;
   /** Text color - default #877897 per design */
   textColor?: string;
}

export function DividerWithText({
   text = 'OR',
   className = '',
   lineColor = '#9285A0',
   textColor = '#877897'
}: DividerWithTextProps) {
   return (
      <div className={`flex items-center gap-2 w-full ${className}`}>
         <div className="flex-1 h-px border-t" style={{ borderColor: lineColor }} />
         <span className="text-xs font-medium px-2 shrink-0" style={{ color: textColor }}>
            {text}
         </span>
         <div className="flex-1 h-px border-t" style={{ borderColor: lineColor }} />
      </div>
   );
}
