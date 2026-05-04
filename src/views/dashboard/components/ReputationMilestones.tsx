import { Link } from 'react-router-dom';

interface Milestone {
   id: string;
   title: string;
   description: string;
   status: 'next' | 'unlocked' | 'locked';
   rewardText?: string;
}

const DUMMY_MILESTONES: Milestone[] = [
   {
      id: 'milestone-next',
      title: 'Repay a loan on time',
      description: 'Increase your Trust Score',
      status: 'next',
   },
   {
      id: 'milestone-unlocked',
      title: 'On-time repayment completed',
      description: '',
      status: 'unlocked',
      rewardText: 'Trust Score increased · Up to $120',
   },
   {
      id: 'milestone-locked',
      title: 'Repay one more loan on time',
      description: 'Complete a full repayment to unlock',
      status: 'locked',
   },
];

const ICON_CONFIG: Record<Milestone['status'], { bg: string; icon: string }> = {
   next: { bg: 'bg-md-primary-900', icon: '/icons/milestone.svg' },
   unlocked: { bg: 'bg-[#32de83]', icon: '/icons/milestone_unlocked.svg' },
   locked: { bg: 'bg-[#9285a0]', icon: '/icons/locked.svg' },
};

function MilestoneIcon({ status }: { status: Milestone['status'] }) {
   const { bg, icon } = ICON_CONFIG[status];
   return (
      <div className={`w-10 h-10 rounded-full ${bg} flex items-center justify-center shrink-0`}>
         <img src={icon} alt="" className="w-5 h-5" />
      </div>
   );
}

function MilestoneCard({ milestone }: { milestone: Milestone }) {
   return (
      <div className="flex items-start gap-3 bg-md-neutral-200 border border-md-primary-100 rounded-[12px] p-3">
         <MilestoneIcon status={milestone.status} />

         <div className="flex-1 min-w-0">
            {milestone.status === 'next' && (
               <p className="text-md-b4 text-md-neutral-700 mb-0.5">Next milestone</p>
            )}
            {milestone.status === 'unlocked' && (
               <p className="text-md-b4 text-md-neutral-700 mb-0.5">Trust milestone reached</p>
            )}
            <p className="text-md-b2 font-semibold text-md-heading">{milestone.title}</p>
            {milestone.description && (
               <p className="text-md-b4 text-md-neutral-700">{milestone.description}</p>
            )}
            {milestone.rewardText && (
               <p className="text-md-b4 text-md-neutral-700 mt-0.5">{milestone.rewardText}</p>
            )}
         </div>

         <div className="shrink-0 self-center">
            {milestone.status === 'next' && (
               <Link
                  to="/milestones"
                  className="inline-flex items-center px-3 py-1.5 rounded-md-md bg-md-primary-900 text-white text-md-b4 font-medium"
               >
                  View Milestone
               </Link>
            )}
            {milestone.status === 'unlocked' && (
               <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md-md bg-md-green-100 text-md-green-800 text-md-b4 font-medium">
                  Unlocked
                  <img src="/icons/unlocked.svg" alt="" className="w-3.5 h-3.5" style={{ filter: 'brightness(0) saturate(100%) invert(38%) sepia(93%) saturate(437%) hue-rotate(101deg) brightness(95%) contrast(92%)' }} />
               </span>
            )}
            {milestone.status === 'locked' && (
               <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md-md bg-md-neutral-300 text-md-neutral-700 text-md-b4 font-medium">
                  Locked
                  <img src="/icons/locked.svg" alt="" className="w-3.5 h-3.5" style={{ filter: 'brightness(0) saturate(100%) invert(52%) sepia(8%) saturate(1206%) hue-rotate(236deg) brightness(93%) contrast(87%)' }} />
               </span>
            )}
         </div>
      </div>
   );
}

export default function ReputationMilestones() {
   return (
      <div className="bg-md-neutral-100 rounded-md-lg p-4 shadow-md-card">
         <div className="flex items-center justify-between mb-1">
            <h2 className="text-md-b1 font-semibold text-md-heading">Reputation Milestones</h2>
            <Link to="/milestones" className="text-md-b3 font-medium text-md-blue-600 underline">
               View All Milestones
            </Link>
         </div>
         <p className="text-md-b4 text-md-neutral-700 mb-2">
            Complete milestones to unlock higher loan levels.
         </p>

         <div className="flex flex-col gap-3">
            {DUMMY_MILESTONES.map((milestone) => (
               <MilestoneCard key={milestone.id} milestone={milestone} />
            ))}
         </div>

      </div>
   );
}
