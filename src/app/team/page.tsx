const leadTeam = [
   {
      name: 'George',
      role: 'Lead Co-Founder · Co-Project Lead',
      image: '/team/george.jpeg',
      bio: 'Repeat founder and product builder focused on turning messy early-stage ideas into disciplined, usable systems for real borrowers and lenders.',
      credentials: ['University of Edinburgh', 'Former Portfolio Manager', '1 Exit', '2 Prior Startups'],
      linkedIn: 'https://www.linkedin.com/in/george-l-25a4b844/'
   },
   {
      name: 'Emma',
      role: 'Lead Co-Founder · Co-Project Lead',
      image: '/team/emma-moodeng.jpeg',
      bio: 'Community builder helping Moodeng Credit turn borrower trust, education, and grassroots momentum into a clearer growth engine.',
      credentials: ['Ex. YC', 'Blockchain for Youth', 'Community Manager'],
      linkedIn: 'https://www.linkedin.com/in/cincharoensak/'
   }
];

const widerTeam = [
   {
      name: 'Yousef',
      role: 'Co-Founder',
      image: '/team/yousef.jpg',
      bio: 'Supports engineering across the Moodeng Credit buildout, helping turn product direction into working borrower and lender experiences.',
      showLinkedInPlaceholder: true
   },
   {
      name: 'Louis',
      role: 'Co-Founder',
      initial: 'L',
      bio: 'Experienced relationship builder helping shape partner conversations, lender outreach, and ecosystem growth.',
      linkedIn: 'https://www.linkedin.com/in/louis-philippe/'
   },
   {
      name: 'Ogunjana Adeleke',
      role: 'Co-Founder',
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

function CredentialPills({ items, light = false }: { items: string[]; light?: boolean }) {
   return (
      <ul className="flex flex-wrap justify-center gap-2">
         {items.map((item) => (
            <li
               key={item}
               className={`rounded-md-pill px-md-2 py-1 text-md-b3 font-semibold ${
                  light ? 'bg-[#fff9e8] text-[#0d2f6f]' : 'bg-[#f4d756] text-[#071b43]'
               }`}
            >
               {item}
            </li>
         ))}
      </ul>
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

function LinkedInButton({ href, className = '' }: { href: string; className?: string }) {
   return (
      <a
         href={href}
         target="_blank"
         rel="noreferrer"
         className={`inline-flex h-11 items-center justify-center rounded-md-pill border-2 border-[#f4d756] bg-[#0d2f6f] px-md-3 text-md-b2 font-bold text-[#fff9e8] shadow-[0_5px_0_rgba(13,47,111,0.28)] transition hover:-translate-y-0.5 hover:bg-[#16468f] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#0d2f6f] ${className}`}
      >
         LinkedIn Profile
      </a>
   );
}

function LinkedInPlaceholderButton({ className = '' }: { className?: string }) {
   return (
      <span
         aria-disabled="true"
         className={`inline-flex h-11 items-center justify-center rounded-md-pill border-2 border-[#f4d756]/70 bg-[#173f7d] px-md-3 text-md-b2 font-bold text-[#fff9e8]/85 shadow-[0_5px_0_rgba(7,27,67,0.22)] ${className}`}
      >
         LinkedIn Profile
      </span>
   );
}

export default function TeamPage() {
   return (
      <section className="team-page bg-[#f3d354] px-md-4 py-md-6 text-md-primary-2000 md:py-md-8">
         <div className="mx-auto flex max-w-[1120px] flex-col gap-md-5">
            <header className="relative overflow-hidden rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] px-md-5 py-md-5 text-center text-[#fff9e8] shadow-[0_18px_0_rgba(7,27,67,0.24)] md:px-md-6 md:py-md-6">
               <span className="inline-flex rounded-md-pill bg-[#f4d756] px-md-3 py-1 text-md-b2 font-bold text-[#071b43]">
                  Moodeng Credit
               </span>
               <h1 className="mt-md-2 font-serif text-[58px] font-bold leading-[0.88] md:text-[104px]">Core Team</h1>
               <p className="mx-auto mt-md-2 max-w-[660px] text-md-b1 font-medium text-[#fff9e8] md:text-md-h5">
                  Building a portable trust layer for borrowers who deserve fair credit and lenders who want transparent impact.
               </p>
               <div className="mx-auto mt-md-4 h-2 w-full max-w-[720px] rounded-t-md-pill bg-[#f4d756]" />
            </header>

            <div className="grid gap-md-4 md:grid-cols-2">
               {leadTeam.map((member) => (
                  <article
                     key={member.name}
                     className="relative overflow-hidden border-[5px] border-md-primary-1600 bg-[#fff8de]/90 p-md-4 text-center"
                  >
                     <h2 className="mb-md-3 text-left font-serif text-[46px] font-bold leading-none md:text-[64px]">{member.name}</h2>
                     <Portrait name={member.name} image={member.image} />
                     <p className="lead-team-role mx-auto mt-md-3 w-fit rounded-md-sm bg-md-primary-1600 px-md-3 py-md-1 font-serif text-md-h4 font-bold leading-tight text-[#fff9e8]">
                        {member.role}
                     </p>
                     <p className="mx-auto mt-md-3 max-w-[430px] text-md-b1 font-medium leading-relaxed text-md-primary-2000">
                        {member.bio}
                     </p>
                     <div className="mt-md-3">
                        <CredentialPills items={member.credentials} light={member.name === 'Emma'} />
                     </div>
                     <LinkedInButton href={member.linkedIn} className="mx-auto mt-md-3" />
                  </article>
               ))}
            </div>

            <div className="grid gap-md-3 md:grid-cols-3">
               {widerTeam.map((member) => (
                  <article
                     key={member.name}
                     className="rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] p-md-4 text-center text-[#fff9e8] shadow-[0_14px_0_rgba(7,27,67,0.24)]"
                  >
                     <Portrait name={member.name} image={member.image} initial={member.initial} />
                     <h2 className="mt-md-3 font-serif text-md-h3 font-bold leading-none">{member.name}</h2>
                     <p className="mx-auto mt-md-2 w-fit rounded-md-pill bg-[#f4d756] px-md-2 py-1 text-md-b2 font-bold text-[#071b43]">
                        {member.role}
                     </p>
                     <p className="mx-auto mt-md-2 max-w-[280px] text-md-b2 font-medium leading-relaxed text-[#fff9e8]/90">{member.bio}</p>
                     {'showLinkedInPlaceholder' in member && member.showLinkedInPlaceholder ? (
                        <LinkedInPlaceholderButton className="mx-auto mt-md-3" />
                     ) : 'linkedIn' in member && member.linkedIn ? (
                        <LinkedInButton href={member.linkedIn} className="mx-auto mt-md-3" />
                     ) : null}
                  </article>
               ))}
            </div>

            <section className="rounded-md-xl border-[5px] border-[#fff9e8] bg-[#0d2f6f] p-md-4 text-center text-[#fff9e8]">
               <h2 className="font-serif text-md-h2 font-bold">Advisors</h2>
               {advisors.map((advisor) => (
                  <article
                     key={advisor.name}
                     className="mx-auto mt-md-3 grid max-w-[820px] items-center gap-md-4 rounded-md-lg border-2 border-[#f4d756] bg-[#173f7d] p-md-4 text-center shadow-[0_10px_0_rgba(7,27,67,0.22)] md:grid-cols-[150px_minmax(0,1fr)] md:text-left"
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
                           <CredentialPills items={advisor.credentials} light />
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
