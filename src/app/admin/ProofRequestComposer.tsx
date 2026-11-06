'use client';

import { useState } from 'react';

import { createProofRequest } from '@/app/admin/adminSupabase';
import { customItemId, MAX_ITEMS, PROOF_PRESETS, type ProofItem, proofLink, proofLinkMessage, QUESTION_PRESETS } from '@/lib/proofRequests';

// "Ask for proof": pick what they said on the call (works at a company, visa abroad, business…), add
// any questions, write a short note, and get one link for them — sent on push / Messenger / Telegram
// right away, and ready to copy into the chat too. Used from the Call sheet and Admin → Proof requests.

const inputClass =
   'w-full rounded-md border border-[#e3e3e3] bg-white px-2.5 py-1.5 text-[14px] text-[#1f1f1f] placeholder:text-[#b3b3b3] focus:border-[#6b55f7] focus:outline-none focus:ring-2 focus:ring-[#6b55f7]/20';

type Custom = ProofItem & { draft: true };

function Tick({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint?: string | null }) {
   return (
      <button
         aria-pressed={on}
         className={`flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left text-[13px] leading-[17px] transition ${
            on ? 'border-[#6b55f7] bg-[#f4f1ff]' : 'border-[#e3e3e3] bg-white hover:bg-[#fafafa]'
         }`}
         onClick={onClick}
         type="button"
      >
         <span
            className={`mt-px grid size-[16px] shrink-0 place-items-center rounded border text-[10px] font-bold ${
               on ? 'border-[#6b55f7] bg-[#6b55f7] text-white' : 'border-[#d4d4d4]'
            }`}
         >
            {on ? '✓' : ''}
         </span>
         <span className="min-w-0">
            <span className="font-semibold text-[#1f1f1f]">{title}</span>
            {hint ? <span className="block text-[12px] text-[#8a8a8a]">{hint}</span> : null}
         </span>
      </button>
   );
}

export default function ProofRequestComposer({
   userId,
   name,
   firstName,
   onClose,
   onCreated
}: {
   userId: string;
   name: string;
   firstName?: string | null;
   onClose: () => void;
   onCreated?: () => void;
}) {
   const [picked, setPicked] = useState<string[]>([]);
   const [customs, setCustoms] = useState<Custom[]>([]);
   const [message, setMessage] = useState('');
   const [send, setSend] = useState(true);
   const [busy, setBusy] = useState(false);
   const [error, setError] = useState('');
   const [made, setMade] = useState<{ token: string } | null>(null);
   const [copied, setCopied] = useState<'link' | 'message' | null>(null);

   const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
   const addCustom = (kind: ProofItem['kind']) =>
      setCustoms((c) => [...c, { id: customItemId(kind), kind, label: '', hint: '', draft: true }]);
   const editCustom = (id: string, patch: Partial<Custom>) => setCustoms((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));

   const items: ProofItem[] = [
      ...PROOF_PRESETS.filter((p) => picked.includes(p.id)).map(({ id, kind, label, hint }) => ({ id, kind, label, hint })),
      ...customs
         .filter((c) => c.kind === 'proof' && c.label.trim())
         .map(({ id, kind, label, hint }) => ({ id, kind, label: label.trim(), hint: hint?.trim() || null })),
      ...QUESTION_PRESETS.filter((q) => picked.includes(q.id)),
      ...customs.filter((c) => c.kind === 'question' && c.label.trim()).map(({ id, kind, label }) => ({ id, kind, label: label.trim() }))
   ];
   const tooMany = items.length > MAX_ITEMS;

   const create = async () => {
      setBusy(true);
      setError('');
      try {
         const result = await createProofRequest({ userId, items, message: message.trim() || null, send });
         setMade({ token: result.token });
         onCreated?.();
      } catch (err) {
         setError(err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err));
      } finally {
         setBusy(false);
      }
   };

   const copy = async (what: 'link' | 'message') => {
      if (!made) return;
      await navigator.clipboard.writeText(what === 'link' ? proofLink(made.token) : proofLinkMessage(firstName ?? null, made.token));
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
   };

   return (
      <div
         aria-modal="true"
         className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-black/40 px-3 py-6 text-[#1f1f1f]"
         onClick={onClose}
         role="dialog"
      >
         <div className="w-full max-w-[640px] rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
               <div>
                  <h2 className="text-[18px] font-bold">Ask {name} for proof</h2>
                  <p className="text-[13px] text-[#7a7a7a]">
                     Pick what they told you on the call. They get one link — no sign-in, no automatic checks.
                  </p>
               </div>
               <button className="rounded-md border border-[#e3e3e3] px-2.5 py-1 text-[13px] font-semibold" onClick={onClose} type="button">
                  {made ? 'Done' : 'Cancel'}
               </button>
            </div>

            {made ? (
               <div className="mt-4 space-y-3">
                  <p className="rounded-md bg-[#eefbf2] p-3 text-[14px] font-semibold text-[#1f6b33]">
                     ✅ Link made{send ? ' — sending it to them on Messenger, Telegram and app notifications (whichever they have).' : '.'}
                  </p>
                  <div className="flex items-center gap-2">
                     <input className={`${inputClass} font-mono text-[13px]`} readOnly value={proofLink(made.token)} />
                     <button
                        className="shrink-0 rounded-md bg-[#1f1f1f] px-3 py-1.5 text-[13px] font-semibold text-white"
                        onClick={() => void copy('link')}
                        type="button"
                     >
                        {copied === 'link' ? 'Copied ✓' : 'Copy link'}
                     </button>
                  </div>
                  <div>
                     <p className="mb-1 text-[12px] font-semibold text-[#7a7a7a]">Or paste this in your Messenger chat with them:</p>
                     <textarea
                        className={`${inputClass} h-[92px] resize-none text-[13px]`}
                        readOnly
                        value={proofLinkMessage(firstName ?? null, made.token)}
                     />
                     <button
                        className="mt-1 rounded-md border border-[#e3e3e3] px-3 py-1 text-[13px] font-semibold"
                        onClick={() => void copy('message')}
                        type="button"
                     >
                        {copied === 'message' ? 'Copied ✓' : 'Copy message'}
                     </button>
                  </div>
                  <p className="text-[12px] text-[#9a9a9a]">
                     You’ll get a ping in the KYC Telegram group and Discord #kyc when they send it. Review in Admin → People → Proof
                     requests.
                  </p>
               </div>
            ) : (
               <div className="mt-4 space-y-4">
                  <section>
                     <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-[#6b55f7]">Proof to upload</p>
                     <div className="grid gap-1.5 sm:grid-cols-2">
                        {PROOF_PRESETS.map((p) => (
                           <Tick
                              hint={p.hint}
                              key={p.id}
                              on={picked.includes(p.id)}
                              onClick={() => toggle(p.id)}
                              title={`${p.emoji} ${p.label}`}
                           />
                        ))}
                     </div>
                     {customs
                        .filter((c) => c.kind === 'proof')
                        .map((c) => (
                           <div className="mt-1.5 grid grid-cols-[1fr_1fr_auto] gap-1.5" key={c.id}>
                              <input
                                 className={inputClass}
                                 maxLength={140}
                                 onChange={(e) => editCustom(c.id, { label: e.target.value })}
                                 placeholder="What to send, e.g. Your PRC license"
                                 value={c.label}
                              />
                              <input
                                 className={inputClass}
                                 maxLength={200}
                                 onChange={(e) => editCustom(c.id, { hint: e.target.value })}
                                 placeholder="Hint (optional)"
                                 value={c.hint ?? ''}
                              />
                              <button
                                 aria-label="Remove"
                                 className="px-2 text-[#9a9a9a]"
                                 onClick={() => setCustoms((x) => x.filter((y) => y.id !== c.id))}
                                 type="button"
                              >
                                 ✕
                              </button>
                           </div>
                        ))}
                     <button className="mt-1.5 text-[13px] font-semibold text-[#6b55f7]" onClick={() => addCustom('proof')} type="button">
                        + Something else to upload
                     </button>
                  </section>

                  <section>
                     <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-[#6b55f7]">Questions to answer</p>
                     <div className="grid gap-1.5 sm:grid-cols-2">
                        {QUESTION_PRESETS.map((q) => (
                           <Tick key={q.id} on={picked.includes(q.id)} onClick={() => toggle(q.id)} title={q.label} />
                        ))}
                     </div>
                     {customs
                        .filter((c) => c.kind === 'question')
                        .map((c) => (
                           <div className="mt-1.5 grid grid-cols-[1fr_auto] gap-1.5" key={c.id}>
                              <input
                                 className={inputClass}
                                 maxLength={140}
                                 onChange={(e) => editCustom(c.id, { label: e.target.value })}
                                 placeholder="Your question"
                                 value={c.label}
                              />
                              <button
                                 aria-label="Remove"
                                 className="px-2 text-[#9a9a9a]"
                                 onClick={() => setCustoms((x) => x.filter((y) => y.id !== c.id))}
                                 type="button"
                              >
                                 ✕
                              </button>
                           </div>
                        ))}
                     <button
                        className="mt-1.5 text-[13px] font-semibold text-[#6b55f7]"
                        onClick={() => addCustom('question')}
                        type="button"
                     >
                        + Your own question
                     </button>
                  </section>

                  <section>
                     <p className="mb-1.5 text-[13px] font-bold uppercase tracking-wide text-[#6b55f7]">
                        Note to them <span className="font-normal normal-case text-[#9a9a9a]">optional, shown at the top</span>
                     </p>
                     <textarea
                        className={`${inputClass} h-[64px] resize-none`}
                        maxLength={500}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="e.g. You said you work as a nurse in Dubai — please send your visa and a payslip so we can approve you."
                        value={message}
                     />
                  </section>

                  <label className="flex items-center gap-2 text-[14px]">
                     <input checked={send} onChange={(e) => setSend(e.target.checked)} type="checkbox" />
                     Send the link to them now (Messenger, Telegram, app notification)
                  </label>

                  {error ? <p className="rounded-md bg-[#fde8e8] p-2 text-[13px] font-semibold text-[#b42318]">{error}</p> : null}
                  {tooMany ? <p className="text-[13px] font-semibold text-[#b42318]">Max {MAX_ITEMS} things in one link.</p> : null}

                  <button
                     className="h-10 w-full rounded-md bg-[#6b55f7] text-[15px] font-bold text-white disabled:opacity-40"
                     disabled={busy || !items.length || tooMany}
                     onClick={() => void create()}
                     type="button"
                  >
                     {busy
                        ? 'Making the link…'
                        : items.length
                          ? `Make the link · ${items.length} ${items.length === 1 ? 'thing' : 'things'}`
                          : 'Pick at least one thing'}
                  </button>
               </div>
            )}
         </div>
      </div>
   );
}
