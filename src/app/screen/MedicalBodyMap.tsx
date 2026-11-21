// Pre-screening v2 medical question as a little game (George, 2026-11-21): who is sick → tap where on
// the hippo → a few words → "Oh no, we're so sorry to hear that". Friendlier than a blank box, so people
// tell us more honestly. It only builds the same plain-text answer the server already grades
// ("no", or "My mother — chest (heart, lungs) — heart problem since March"), so grading and the
// team card don't change.
import { AREA_PROBLEMS, DOCTOR, EMPTY_MEDICAL, type MedicalPick, medicalReady, type MedicalWho, MEDICINE, SINCE } from '@/lib/medicalPick';

const RELATIONS = ['Mother', 'Father', 'Child', 'Husband / wife', 'Brother / sister', 'Grandparent', 'Other family'];

// Tap spots on /hippos/body/hippo-body.webp, in % of the picture (checked against the image).
const SPOTS: Array<{ id: string; part: string; x: number; y: number }> = [
   { id: 'head', part: 'Head', x: 50, y: 15 },
   { id: 'chest', part: 'Chest (heart, lungs)', x: 50, y: 55 },
   { id: 'tummy', part: 'Tummy', x: 50, y: 77 },
   { id: 'arm_l', part: 'Arms', x: 14, y: 59 },
   { id: 'arm_r', part: 'Arms', x: 86, y: 59 },
   { id: 'leg_l', part: 'Legs', x: 38, y: 91 },
   { id: 'leg_r', part: 'Legs', x: 62, y: 91 }
];
// Things you can't point at on the front of the hippo. "Inside the body" is for sugar, high blood, cancer…
const CHIPS = ['Inside the body', 'Back', 'Skin', 'Feelings / stress'];

const pill = (on: boolean) =>
   `rounded-full border-2 px-3 py-1.5 text-[14px] font-semibold ${
      on
         ? 'border-[#7661f9] bg-[#7661f9] text-white'
         : 'border-[#e2dcee] bg-white text-[#594d65] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#d9cfe8]'
   }`;

const bigChoice = (on: boolean) =>
   `rounded-[14px] border-2 px-4 py-3 text-left text-[16px] font-semibold ${
      on
         ? 'border-[#7661f9] bg-[#f4f1fb] text-[#3b2f4a] dark:bg-[#2a2140] dark:text-[#f5f0ff]'
         : 'border-[#e2dcee] bg-white text-[#594d65] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#d9cfe8]'
   }`;

export default function MedicalBodyMap({ value, onChange }: { value: MedicalPick; onChange: (next: MedicalPick) => void }) {
   const set = (patch: Partial<MedicalPick>) => onChange({ ...value, ...patch });
   const togglePart = (part: string) =>
      value.parts.includes(part)
         ? set({ parts: value.parts.filter((p) => p !== part), conditions: value.conditions.filter((c) => !c.startsWith(`${part}: `)) })
         : set({ parts: [...value.parts, part] });
   const toggleCondition = (c: string) =>
      set({ conditions: value.conditions.includes(c) ? value.conditions.filter((x) => x !== c) : [...value.conditions, c] });
   const whoReady = value.who === 'me' || (value.who === 'family' && !!value.relation);
   const whose = value.who === 'me' ? 'your' : value.relation ? `your ${value.relation.toLowerCase()}'s` : 'their';
   const sorry = medicalReady(value);

   return (
      <div className="flex flex-col gap-4">
         <div className="flex flex-col gap-2" role="radiogroup" aria-label="Who is sick?">
            {(
               [
                  ['no', 'No, we’re all okay 🙂'],
                  ['me', 'Yes, me'],
                  ['family', 'Yes, someone in my family']
               ] as Array<[MedicalWho, string]>
            ).map(([id, label]) => (
               <button
                  aria-checked={value.who === id}
                  className={bigChoice(value.who === id)}
                  key={id}
                  onClick={() => onChange(id === value.who ? value : { ...EMPTY_MEDICAL, who: id })}
                  role="radio"
                  type="button"
               >
                  {label}
               </button>
            ))}
         </div>

         {value.who === 'family' ? (
            <div className="flex flex-col gap-2">
               <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">Who is it?</p>
               <div className="flex flex-wrap gap-2">
                  {RELATIONS.map((r) => (
                     <button className={pill(value.relation === r)} key={r} onClick={() => set({ relation: r })} type="button">
                        {r}
                     </button>
                  ))}
               </div>
            </div>
         ) : null}

         {whoReady ? (
            <div className="flex flex-col gap-2">
               <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">
                  Where is the problem? <span className="font-medium text-[#8a7f99]">Tap the hippo</span>
               </p>
               <div className="relative mx-auto w-full max-w-[260px]">
                  <img alt="" className="w-full select-none" draggable={false} src="/hippos/body/hippo-body.webp" />
                  {SPOTS.map((s) => {
                     const on = value.parts.includes(s.part);
                     return (
                        <button
                           aria-label={s.part}
                           aria-pressed={on}
                           className={`absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[15px] font-black transition ${
                              on
                                 ? 'border-white bg-[#7661f9] text-white shadow-[0_0_0_6px_rgba(118,97,249,0.25)]'
                                 : 'animate-pulse border-white/90 bg-[#ff8fb1]/55 text-transparent'
                           }`}
                           key={s.id}
                           onClick={() => togglePart(s.part)}
                           style={{ left: `${s.x}%`, top: `${s.y}%` }}
                           type="button"
                        >
                           ✓
                        </button>
                     );
                  })}
               </div>
               <div className="flex flex-wrap justify-center gap-2">
                  {CHIPS.map((c) => (
                     <button className={pill(value.parts.includes(c))} key={c} onClick={() => togglePart(c)} type="button">
                        {c}
                     </button>
                  ))}
               </div>
               {value.parts.length ? (
                  <p className="text-center text-[14px] font-semibold text-[#7661f9] dark:text-[#b3a6ff]">{value.parts.join(' · ')}</p>
               ) : null}
            </div>
         ) : null}

         {whoReady && value.parts.length ? (
            <div className="flex flex-col gap-3">
               {value.parts.map((part) => (
                  <div className="flex flex-col gap-2" key={part}>
                     <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">
                        {part}: what is it? <span className="font-medium text-[#8a7f99]">Tap any</span>
                     </p>
                     <div className="flex flex-wrap gap-2">
                        {(AREA_PROBLEMS[part] ?? []).map((c) => (
                           <button
                              className={pill(value.conditions.includes(`${part}: ${c}`))}
                              key={c}
                              onClick={() => toggleCondition(`${part}: ${c}`)}
                              type="button"
                           >
                              {c}
                           </button>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         ) : null}

         {whoReady && value.parts.length ? (
            <div className="flex flex-col gap-3 rounded-[16px] bg-[#f8f5fd] px-3 py-3 dark:bg-[#1f182c]">
               {(
                  [
                     ['Since when?', SINCE, value.since, (v: string) => set({ since: v })],
                     [`Seeing a doctor for ${whose === 'your' ? 'it' : 'them'}?`, DOCTOR, value.doctor, (v: string) => set({ doctor: v })],
                     ['Medicine every month?', MEDICINE, value.medicine, (v: string) => set({ medicine: v })]
                  ] as Array<[string, string[], string | null, (v: string) => void]>
               ).map(([label, options, picked, pick]) => (
                  <div className="flex flex-col gap-2" key={label}>
                     <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">{label}</p>
                     <div className="flex flex-wrap gap-2">
                        {options.map((o) => (
                           <button className={pill(picked === o)} key={o} onClick={() => pick(o)} type="button">
                              {o}
                           </button>
                        ))}
                     </div>
                  </div>
               ))}
            </div>
         ) : null}

         {whoReady && value.parts.length ? (
            <div className="flex flex-col gap-2">
               <p className="text-[15px] font-bold text-[#3b2f4a] dark:text-[#f5f0ff]">
                  Anything else? <span className="font-medium text-[#8a7f99]">Optional</span>
               </p>
               <textarea
                  aria-label="About the problem"
                  className="min-h-[72px] resize-none rounded-[14px] border-2 border-[#e2dcee] bg-white px-4 py-3 text-[16px] text-[#3b2f4a] outline-none focus:border-[#7661f9] dark:border-[#3a2d4f] dark:bg-[#1b1526] dark:text-[#f5f0ff]"
                  maxLength={500}
                  onChange={(e) => set({ detail: e.target.value })}
                  placeholder={value.conditions.length ? 'Like what the doctor said' : 'What is it? Like what the doctor said'}
                  value={value.detail}
               />
            </div>
         ) : null}

         {sorry ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-[#fdf0f5] px-3 py-3 dark:bg-[#3a1f2c]">
               <img alt="" className="size-16 shrink-0 object-contain" src="/hippos/prescreen/medical.webp" />
               <p className="text-[15px] leading-[21px] text-[#5a2a3e] dark:text-[#ffd6e4]">
                  <b>Oh no, we’re so sorry to hear that 💜</b> Thank you for telling us. Many families go through this. It helps us
                  understand.
               </p>
            </div>
         ) : null}
      </div>
   );
}
