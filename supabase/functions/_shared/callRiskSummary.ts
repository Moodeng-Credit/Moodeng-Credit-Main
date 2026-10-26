// AI risk summary of a borrower's onboarding call (call_transcripts), shown on the admin call sheet.
// DeepSeek reads the Zoom transcript next to what the borrower told us in their bio and what the host
// wrote on the call sheet, and answers in plain JSON. It's a second pair of ears for the team, never a
// decision: nothing approves, rejects or prices a loan from it. Never throws; a failure is saved on the
// row (summary_error) so the sheet can say so.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const MODEL = 'deepseek-v4-pro';
const MAX_TRANSCRIPT_CHARS = 60_000;

export type CallRiskSummary = {
   summary: string;
   loan_use: string;
   repayment_plan: string;
   income_and_work: string;
   consistency_with_bio: string;
   red_flags: string[];
   positives: string[];
   risk_level: 'low' | 'medium' | 'high';
   follow_up_questions: string[];
};

const SYSTEM_PROMPT = `You review onboarding video calls for Moodeng Credit, which gives small USDC loans ($15–$100, about 30 days) to people in the Philippines and Indonesia who are building credit. A Moodeng host (George or Emma) talks with a new borrower before they can borrow.

You get: the borrower's own bio answers, the host's call-sheet notes, and the call transcript (speakers are named; the host is George or Emma, possibly with "Moodeng" in the name).

Judge only from what was said. Be fair to people with low or irregular incomes: small loans for bills, food, medicine or a pay gap are normal here and not a red flag by themselves. Red flags are things like: stories that contradict the bio or change during the call, someone else answering for them or coaching them, no idea how they will repay, plans to borrow elsewhere to repay, pressure or urgency that doesn't add up, unwillingness to show who they are, gambling or crypto trading as the use, or signs the account isn't theirs.

Reply with JSON only, in English, short and concrete:
{"summary": "2–3 sentences", "loan_use": "", "repayment_plan": "", "income_and_work": "", "consistency_with_bio": "matches / partly / contradicts — and why", "red_flags": [], "positives": [], "risk_level": "low|medium|high", "follow_up_questions": []}`;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}\n[…transcript cut for length]` : text);

export const summarizeCallTranscript = async (svc: SupabaseClient, transcriptId: string): Promise<boolean> => {
   const fail = async (message: string) => {
      console.error('callRiskSummary:', message);
      await svc.from('call_transcripts').update({ summary_error: message.slice(0, 500) }).eq('id', transcriptId);
      return false;
   };
   try {
      const apiKey = Deno.env.get('DEEPSEEK_API_KEY');
      if (!apiKey) return await fail('DEEPSEEK_API_KEY is not set');
      const { data: row } = await svc.from('call_transcripts').select('id, user_id, transcript, call_started_at').eq('id', transcriptId).maybeSingle();
      if (!row) return await fail('transcript not found');

      const [userRes, sheetRes] = await Promise.all([
         row.user_id
            ? svc
                 .from('users')
                 .select('display_name, profession, income_type, monthly_income, monthly_expenses, other_income, income_description, gap_reasons, location')
                 .eq('id', row.user_id)
                 .maybeSingle()
            : Promise.resolve({ data: null }),
         row.user_id
            ? svc.from('call_screenings').select('answers, notes, red_flags, score').eq('user_id', row.user_id).order('updated_at', { ascending: false }).limit(1).maybeSingle()
            : Promise.resolve({ data: null })
      ]);

      const user = {
         content: [
            `BORROWER BIO:\n${JSON.stringify(userRes.data ?? {}, null, 1)}`,
            `HOST CALL SHEET:\n${JSON.stringify(sheetRes.data ?? {}, null, 1)}`,
            `TRANSCRIPT:\n${clip(row.transcript ?? '', MAX_TRANSCRIPT_CHARS)}`
         ].join('\n\n'),
         role: 'user'
      };

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 90_000);
      let res: Response;
      try {
         res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            signal: ctrl.signal,
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
               model: MODEL,
               thinking: { type: 'disabled' },
               temperature: 0.2,
               max_tokens: 1200,
               response_format: { type: 'json_object' },
               messages: [{ role: 'system', content: SYSTEM_PROMPT }, user]
            })
         });
      } finally {
         clearTimeout(timer);
      }
      if (!res.ok) return await fail(`DeepSeek ${res.status}`);
      const body = await res.json();
      const parsed = JSON.parse(body?.choices?.[0]?.message?.content ?? '{}') as Partial<CallRiskSummary>;
      const risk = ['low', 'medium', 'high'].includes(String(parsed.risk_level)) ? parsed.risk_level : null;
      const { error } = await svc
         .from('call_transcripts')
         .update({ summary: parsed, risk_level: risk, summary_model: MODEL, summarized_at: new Date().toISOString(), summary_error: null })
         .eq('id', transcriptId);
      if (error) return await fail(`saving summary: ${error.message}`);
      return true;
   } catch (err) {
      return await fail(err instanceof Error ? err.message : String(err));
   }
};
