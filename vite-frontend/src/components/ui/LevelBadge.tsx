interface LevelBadgeProps {
   status: 'current' | 'next' | 'locked';
   className?: string;
}

const STATUS_COLORS = {
   current: {
      outerFill: '#059669',
      innerFill: '#10B981'
   },
   next: {
      outerFill: '#2563EB',
      innerFill: '#3B82F6'
   },
   locked: {
      outerFill: '#4B5563',
      innerFill: '#6B7280'
   }
};

export function LevelBadge({ status, className = '' }: LevelBadgeProps) {
   const colors = STATUS_COLORS[status];

   return (
      <svg viewBox="0 0 40 40" className={`w-10 h-10 ${className}`}>
         <path d="M20 2L4 8v12c0 11 13 18 16 20 3-2 16-9 16-20V8L20 2z" fill={colors.outerFill} />
         <path d="M20 4L6 9.4v10.2C6 29 17.5 35.2 20 37c2.5-1.8 14-8 14-17.4V9.4L20 4z" fill={colors.innerFill} />
         <path d="M20 8l2.5 5 5.5.8-4 3.9.9 5.3-4.9-2.6-4.9 2.6 1-5.3-4-3.9 5.5-.8L20 8z" fill="#E5E7EB" />
      </svg>
   );
}
