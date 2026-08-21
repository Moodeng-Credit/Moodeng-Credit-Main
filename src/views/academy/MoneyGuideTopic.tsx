import { ArrowLeft, ExternalLink, PlayCircle, ShieldCheck } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { SUPPORTED_DIDIT_COUNTRIES } from '@/components/verification/CountryFlags';
import { usePageSeo } from '@/hooks/usePageSeo';
import { getMoneyGuideTopic } from '@/views/academy/moneyGuideTopics';

export default function MoneyGuideTopic() {
   const navigate = useNavigate();
   const { topic: topicId } = useParams<{ topic: string }>();
   const topic = getMoneyGuideTopic(topicId);

   usePageSeo({
      title: topic ? `${topic.title} — Moodeng Academy` : 'Moodeng Academy',
      description: topic?.summary ?? 'Money guides for Moodeng Credit.',
      canonicalPath: topic ? `/academy/money/${topic.id}` : '/academy/money'
   });

   if (!topic) return <Navigate to="/academy/money" replace />;

   const { Icon, iconWrap, iconColor, title, subtitle, intro, steps, options, video, callout } = topic;

   return (
      <div className="min-h-screen bg-md-neutral-200">
         <div className="mx-auto w-full max-w-modal md:max-w-2xl">
            {/* Hero */}
            <div className="relative overflow-hidden bg-md-primary-100 px-md-4 pb-md-5 pt-[max(20px,env(safe-area-inset-top))] md:rounded-md-xl md:px-md-5 md:pb-md-5 md:pt-md-5">
               <button
                  type="button"
                  onClick={() => navigate(-1)}
                  aria-label="Go back"
                  className="mb-md-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-md-primary-300 bg-md-neutral-100 text-md-heading"
               >
                  <ArrowLeft className="h-5 w-5" strokeWidth={2.2} />
               </button>
               <span className="block text-md-b3 font-semibold uppercase tracking-[0.08em] text-md-primary-1200">Moodeng Academy</span>
               <div className="mt-2 flex items-center gap-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md-md ${iconWrap} ${iconColor}`}>
                     <Icon className="h-7 w-7" strokeWidth={2} />
                  </span>
                  <div className="min-w-0">
                     <h1 className="text-md-h4 font-semibold leading-tight text-md-heading md:text-md-h3">{title}</h1>
                     <p className="mt-0.5 text-md-b2 font-medium text-md-neutral-800">{subtitle}</p>
                  </div>
               </div>
            </div>

            <div className="flex flex-col gap-md-3 px-md-4 py-md-4 md:px-md-5 md:py-md-5">
               {/* Intro */}
               <p className="text-md-b2 font-normal leading-[1.55] text-md-neutral-1200">{intro}</p>

               {/* Supported countries (verify only) */}
               {topic.id === 'verify' ? (
                  <div className="rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card">
                     <p className="mb-2 text-md-b3 font-semibold uppercase tracking-[0.06em] text-md-neutral-800">Supported countries</p>
                     <div className="flex flex-wrap gap-x-3 gap-y-2">
                        {SUPPORTED_DIDIT_COUNTRIES.map(({ code, name, Flag }) => (
                           <span key={code} className="inline-flex items-center gap-1.5">
                              <span className="h-3.5 w-[21px] overflow-hidden rounded-[2px] shadow-sm shadow-black/10">
                                 <Flag className="block h-full w-full" />
                              </span>
                              <span className="text-md-b3 font-medium text-md-heading">{name}</span>
                           </span>
                        ))}
                     </div>
                  </div>
               ) : null}

               {/* Video walkthrough */}
               {video ? (
                  <a
                     href={video.href}
                     target="_blank"
                     rel="noopener noreferrer"
                     className="flex items-center gap-3 rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card"
                  >
                     <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md-md bg-md-red-100 text-md-red-600">
                        <PlayCircle className="h-6 w-6" strokeWidth={2} />
                     </span>
                     <span className="min-w-0 flex-1 text-md-b2 font-semibold text-md-heading">{video.label}</span>
                     <ExternalLink className="h-4 w-4 shrink-0 text-md-neutral-800" />
                  </a>
               ) : null}

               {/* Steps */}
               {steps ? (
                  <div className="rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card">
                     <p className="mb-3 text-md-b3 font-semibold uppercase tracking-[0.06em] text-md-neutral-800">How it works</p>
                     <ol className="flex flex-col gap-3">
                        {steps.map((step, index) => (
                           <li key={step} className="flex items-start gap-3">
                              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-md-primary-100 text-md-b3 font-bold text-md-primary-1200">
                                 {index + 1}
                              </span>
                              <span className="text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">{step}</span>
                           </li>
                        ))}
                     </ol>
                  </div>
               ) : null}

               {/* Provider options */}
               {options ? (
                  <div className="rounded-md-lg border border-md-neutral-400 bg-md-neutral-100 p-md-3 shadow-md-card">
                     <p className="mb-3 text-md-b3 font-semibold uppercase tracking-[0.06em] text-md-neutral-800">{options.heading}</p>
                     <div className="flex flex-col gap-3">
                        {options.items.map((item) => {
                           const row = (
                              <div className="flex items-start gap-3">
                                 {item.logo ? (
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md-sm">
                                       {item.logo}
                                    </span>
                                 ) : (
                                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md-sm bg-md-neutral-300 text-md-b3 font-bold text-md-neutral-1200">
                                       {item.name.charAt(0)}
                                    </span>
                                 )}
                                 <div className="min-w-0">
                                    <p className="flex items-center gap-1 text-md-b2 font-semibold text-md-heading">
                                       {item.name}
                                       {item.href ? <ExternalLink className="h-3.5 w-3.5 text-md-neutral-800" /> : null}
                                    </p>
                                    <p className="mt-0.5 text-md-b2 font-normal leading-[1.5] text-md-neutral-1200">{item.text}</p>
                                 </div>
                              </div>
                           );
                           return item.href ? (
                              <a key={item.name} href={item.href} target="_blank" rel="noopener noreferrer" className="block">
                                 {row}
                              </a>
                           ) : (
                              <div key={item.name}>{row}</div>
                           );
                        })}
                     </div>
                  </div>
               ) : null}

               {/* Key-detail callout */}
               <div className="flex items-start gap-3 rounded-md-lg border border-md-primary-300 bg-md-primary-100 p-md-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-md-primary-1200" strokeWidth={2.2} />
                  <p className="text-md-b2 font-medium leading-[1.5] text-md-primary-1500">{callout}</p>
               </div>
            </div>
         </div>
      </div>
   );
}
