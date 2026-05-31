const coFounders = [
   {
      name: 'George',
      role: 'Project Co-Lead',
      image: '/team/george.jpeg',
      bio: 'Repeat founder and product builder focused on turning messy early-stage ideas into disciplined, usable systems for real borrowers and lenders.',
      credentials: ['University of Edinburgh', 'Ex-UNHCR Data Team Lead', 'Former Portfolio Manager', '1 Exit', '2 Prior Startups'],
      linkedIn: 'https://www.linkedin.com/in/george-l-25a4b844/'
   },
   {
      name: 'Emma',
      role: 'Project Co-Lead',
      image: '/team/emma-moodeng.jpeg',
      bio: 'Leads growth and community storytelling for Moodeng Credit, turning borrower education, social content, and campaign feedback into clearer trust-building moments.',
      credentials: ['Growth Marketing', 'Borrower Education', 'Community Campaigns'],
      linkedIn: 'https://www.linkedin.com/in/cincharoensak/'
   }
];

const foundingTeam = [
   {
      name: 'Yousef',
      role: 'Member of Technical Team',
      image: '/team/yousef.jpg',
      bio: 'Supports engineering across the Moodeng Credit buildout, helping turn product direction into working borrower and lender experiences.',
      showLinkedInPlaceholder: true
   },
   {
      name: 'Louis',
      role: 'Working on Partnerships',
      initial: 'L',
      bio: 'Experienced relationship builder helping shape partner conversations, lender outreach, and ecosystem growth.',
      credentials: ['Growth Hacking', 'Blockchain Analysis', 'Marketing Automation'],
      linkedIn: 'https://www.linkedin.com/in/louis-philippe/'
   },
   {
      name: 'Ogunjana Adeleke',
      role: 'Working on Building Community',
      image: '/team/ogunjana-adeleke.png',
      bio: 'Helps manage X/Twitter and other social channels, keeping the community active across regional conversations.',
      linkedIn: 'https://www.linkedin.com/in/ogunjana-adeleke-lexioneth-2a75b2238/'
   }
];

const advisors = [
   {
      name: 'Jon Brownstead',
      role: 'Advisor',
      image: '/team/jon-brownstead.jpeg',
      bio: 'Founder of Mercury Labs and a current US Army professional advising Moodeng Credit on marketing strategy, brand positioning, and disciplined growth as the network expands.',
      credentials: ['US Army', 'Founder, Mercury Labs', 'Marketing Strategy'],
      linkedIn: 'https://www.linkedin.com/in/johnhenrybrownstead'
   }
];

function CredentialPills({ items }: { items: string[] }) {
   return (
      <ul className="flex flex-wrap justify-center gap-2">
         {items.map((item) => (
            <li
               key={item}
               className="max-w-full rounded-md-pill bg-[#f4d756] px-md-2 py-1 text-center text-md-b3 font-semibold text-[#071b43]"
            >
               {item}
            </li>
         ))}
      </ul>
   );
}

function RoleBadge({ children, variant = 'filled' }: { children: string; variant?: 'filled' | 'outline' }) {
   const badgeClass =
      variant === 'filled' ? 'border-[#f4d756] bg-[#f4d756] text-[#071b43]' : 'border-[#f4d756] bg-transparent text-[#fff9e8]';

   return (
      <p
         className={`mx-auto inline-flex min-h-10 max-w-full items-center justify-center rounded-md-pill border-2 px-md-3 py-1 text-center text-md-b3 font-bold leading-tight md:text-md-b2 ${badgeClass}`}
      >
         {children}
      </p>
   );
}

function Portrait({ name, image, initial }: { name: string; image?: string; initial?: string }) {
   return (
      <div className="mx-auto grid aspect-[0.86] w-[min(250px,78%)] place-items-center overflow-hidden rounded-md-xl border-[6px] border-md-primary-1600 bg-[#fff8de]">
         {image ? (
            <img src={image} alt={name} className="h-full w-full object-cover" />
         ) : (
            <span className="grid size-20 place-items-center rounded-full bg-[#f4d756] font-serif text-md-h3 font-bold text-md-primary-2000">
               {initial}
            </span>
         )}
      </div>
   );
}

const linkedInButtonClass =
   'inline-flex h-12 w-[224px] max-w-full items-center justify-center rounded-md-pill border-2 border-[#f4d756] bg-[#0d2f6f] px-md-3 text-md-b2 font-bold text-[#fff9e8] shadow-[0_5px_0_rgba(13,47,111,0.28)]';

function LinkedInButton({ href, className = '' }: { href: string; className?: string }) {
   return (
      <a
         href={href}
         target="_blank"
         rel="noreferrer"
         className={`${linkedInButtonClass} transition hover:-translate-y-0.5 hover:bg-[#16468f] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0d2f6f] ${className}`}
      >
         LinkedIn Profile
      </a>
   );
}

function LinkedInPlaceholderButton({ className = '' }: { className?: string }) {
   return (
      <span aria-disabled="true" className={`${linkedInButtonClass} cursor-default ${className}`}>
         LinkedIn Profile
      </span>
   );
}

export default function TeamPage() {
   return (
      <section className="team-page bg-[#f3d354] px-md-3 py-md-4 text-md-primary-2000 md:px-md-4 md:py-md-8">
         <div className="mx-auto flex max-w-[1120px] flex-col gap-md-4 md:gap-md-6">
            <section aria-labelledby="co-founders-heading">
               <header className="team-blue-panel relative mb-md-4 overflow-hidden rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] px-md-3 py-md-4 text-center text-[#fff9e8] shadow-[0_18px_0_rgba(7,27,67,0.24)] md:mb-md-5 md:px-md-6 md:py-md-6">
                  <h1 id="co-founders-heading" className="font-serif text-[42px] font-bold leading-[0.9] md:text-[104px]">
                     Co-Founders
                  </h1>
                  <p className="mx-auto mt-md-2 max-w-[660px] text-md-b2 font-medium leading-relaxed text-[#fff9e8] md:text-md-h5">
                     Building a portable trust layer for borrowers who deserve fair credit and lenders who want transparent impact.
                  </p>
                  <div className="mx-auto mt-md-4 h-2 w-full max-w-[720px] rounded-t-md-pill bg-[#f4d756]" />
               </header>

               <div className="grid gap-md-4 md:grid-cols-2">
                  {coFounders.map((member) => (
                     <article
                        key={member.name}
                        className="relative flex h-full flex-col overflow-hidden border-[5px] border-md-primary-1600 bg-[#fff8de]/90 p-md-3 text-center text-[#071b43] md:min-h-[810px] md:p-md-4"
                     >
                        <div className="mb-md-2 flex items-end md:mb-md-3 md:min-h-[72px]">
                           <h2 className="text-left font-serif text-[40px] font-bold leading-none md:text-[64px]">{member.name}</h2>
                        </div>
                        <Portrait name={member.name} image={member.image} />
                        <div className="mt-md-2 flex items-center justify-center md:mt-md-3 md:min-h-[52px]">
                           <RoleBadge>{member.role}</RoleBadge>
                        </div>
                        <p className="mx-auto mt-md-2 flex max-w-[430px] items-center text-md-b2 font-medium leading-relaxed text-md-primary-2000 md:mt-md-3 md:min-h-[116px] md:text-md-b1">
                           {member.bio}
                        </p>
                        <div className="mt-md-2 flex items-center justify-center md:mt-md-3 md:min-h-[86px]">
                           <CredentialPills items={member.credentials} />
                        </div>
                        <div className="mt-auto pt-md-2 md:pt-md-3">
                           <LinkedInButton href={member.linkedIn} className="mx-auto" />
                        </div>
                     </article>
                  ))}
               </div>
            </section>

            <section aria-label="Additional team members" className="mt-md-1 border-t-[8px] border-[#0d2f6f] pt-md-4 md:mt-md-2 md:pt-md-6">
               <div className="grid gap-md-3 md:grid-cols-3">
                  {foundingTeam.map((member) => (
                     <article
                        key={member.name}
                        className="team-blue-panel flex h-full flex-col rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] p-md-3 text-center text-[#fff9e8] shadow-[0_14px_0_rgba(7,27,67,0.24)] md:min-h-[670px] md:p-md-4"
                     >
                        <Portrait name={member.name} image={member.image} initial={member.initial} />
                        <div className="mt-md-2 flex items-end justify-center md:mt-md-3 md:min-h-[86px]">
                           <h3 className="font-serif text-md-h3 font-bold leading-none">{member.name}</h3>
                        </div>
                        <div className="mt-md-2 flex items-center justify-center md:min-h-[52px]">
                           <RoleBadge variant="outline">{member.role}</RoleBadge>
                        </div>
                        <p className="mx-auto mt-md-2 flex max-w-[280px] items-center text-md-b2 font-medium leading-relaxed text-[#fff9e8]/90 md:min-h-[128px]">
                           {member.bio}
                        </p>
                        {'credentials' in member && member.credentials ? (
                           <div className="hidden w-full md:mt-md-2 md:block [&>ul]:justify-center">
                              <CredentialPills items={member.credentials} />
                           </div>
                        ) : null}
                        <div className="mt-auto pt-md-2 md:pt-md-3">
                           {'showLinkedInPlaceholder' in member && member.showLinkedInPlaceholder ? (
                              <LinkedInPlaceholderButton className="mx-auto" />
                           ) : 'linkedIn' in member && member.linkedIn ? (
                              <LinkedInButton href={member.linkedIn} className="mx-auto" />
                           ) : null}
                        </div>
                     </article>
                  ))}
               </div>
            </section>

            <section className="team-blue-panel rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] p-md-4 text-center text-[#fff9e8]">
               <h2 className="font-serif text-md-h2 font-bold">Advisors</h2>
               {advisors.map((advisor) => (
                  <article
                     key={advisor.name}
                     className="team-blue-panel mx-auto mt-md-3 grid max-w-[820px] items-center gap-md-4 rounded-md-lg border-2 border-[#f4d756] bg-[#173f7d] p-md-4 text-center shadow-[0_10px_0_rgba(7,27,67,0.22)] md:grid-cols-[150px_minmax(0,1fr)] md:text-left"
                  >
                     <div className="mx-auto size-[132px] overflow-hidden rounded-md-xl border-[5px] border-[#fff9e8] bg-[#f4d756] md:mx-0">
                        <img src={advisor.image} alt={advisor.name} className="h-full w-full object-cover" />
                     </div>
                     <div className="flex min-w-0 flex-col items-center md:items-start">
                        <h3 className="font-serif text-md-h3 font-bold">{advisor.name}</h3>
                        <p className="mt-2 inline-flex rounded-md-pill bg-[#f4d756] px-md-2 py-1 text-md-b2 font-bold text-md-primary-2000">
                           {advisor.role}
                        </p>
                        <p className="mt-md-2 text-md-b2 font-medium leading-relaxed text-[#fff9e8]/90">{advisor.bio}</p>
                        <div className="mt-md-2 w-full [&>ul]:justify-center md:[&>ul]:justify-start">
                           <CredentialPills items={advisor.credentials} />
                        </div>
                        <LinkedInButton href={advisor.linkedIn} className="mt-md-3" />
                     </div>
                  </article>
               ))}
            </section>
         </div>
      </section>
   );
}
