// Admin → Users → one person's page: what they verified with on Didit and the photos Didit kept
// (ID front/back, ID portrait, selfie). Didit's photo links are signed and expire after a few hours,
// so they are fetched fresh each time the page opens and never stored. Served by admin-messenger
// ({ action: 'didit_media', userId }) because the project is at the edge function cap.

// deno-lint-ignore no-explicit-any
type Svc = any;
type Obj = Record<string, unknown>;

export type DiditPhoto = { label: string; url: string };
export type DiditSessionMedia = {
   sessionId: string;
   status: string | null;
   createdAt: string | null;
   features: string[];
   method: string | null;
   documentType: string | null;
   issuingCountry: string | null;
   faceMatchScore: number | null;
   livenessScore: number | null;
   warnings: string[];
   photos: DiditPhoto[];
   error?: string;
};

const MAX_SESSIONS = 4;

const asObj = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const asArr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => asObj(x)) as Obj[]) : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const warningText = (w: unknown): string | null => {
   const o = asObj(w);
   if (!o) return str(w);
   return str(o.short_description) ?? str(o.risk) ?? str(o.description) ?? null;
};

/** One Didit decision → what the team needs to see. Pure. */
export const summariseDecision = (sessionId: string, d: Obj): DiditSessionMedia => {
   const photos: DiditPhoto[] = [];
   const add = (label: string, url: unknown) => {
      const u = str(url);
      if (u && !photos.some((p) => p.url === u)) photos.push({ label, url: u });
   };
   const warnings: string[] = [];
   const idv = asArr(d.id_verifications)[0] ?? null;
   if (idv) {
      add('ID front', idv.full_front_image ?? idv.front_image);
      add('ID back', idv.full_back_image ?? idv.back_image);
      add('ID photo', idv.portrait_image);
      for (const w of asArr(idv.warnings)) {
         const t = warningText(w);
         if (t) warnings.push(t);
      }
   }
   const fm = asArr(d.face_matches)[0] ?? null;
   if (fm) add('Selfie', fm.source_image);
   let livenessScore: number | null = null;
   for (const lc of asArr(d.liveness_checks)) {
      add('Liveness', lc.reference_image ?? lc.portrait_image ?? lc.image);
      livenessScore ??= num(lc.score);
      for (const w of asArr(lc.warnings)) {
         const t = warningText(w);
         if (t) warnings.push(t);
      }
   }
   return {
      sessionId,
      status: str(d.status),
      createdAt: str(d.created_at),
      features: Array.isArray(d.features) ? (d.features.filter((f) => typeof f === 'string') as string[]) : [],
      method: idv ? str(idv.verification_method) : null,
      documentType: idv ? str(idv.document_type) : null,
      issuingCountry: idv ? (str(idv.issuing_state_name) ?? str(idv.issuing_state)) : null,
      faceMatchScore: fm ? num(fm.score) : null,
      livenessScore,
      warnings: [...new Set(warnings)].slice(0, 10),
      photos
   };
};

/** Every Didit session we know for this person (newest first), each with its photos. */
export const loadDiditMedia = async (svc: Svc, userId: string): Promise<{ sessions: DiditSessionMedia[]; error?: string }> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return { sessions: [], error: 'DIDIT_API_KEY not configured' };
   const apiBase = (Deno.env.get('DIDIT_API_BASE')?.trim() || 'https://verification.didit.me/v3').replace(/\/$/, '');

   const [{ data: user }, { data: kyc }] = await Promise.all([
      svc.from('users').select('didit_session_id, liveness_session_id, wallet_face_session_id').eq('id', userId).maybeSingle(),
      svc
         .from('kyc_identities')
         .select('session_id, session_created_at')
         .eq('user_id', userId)
         .order('session_created_at', { ascending: false })
         .limit(MAX_SESSIONS)
   ]);
   const ids = [
      ...((kyc ?? []) as Array<{ session_id: string | null }>).map((k) => k.session_id),
      user?.didit_session_id,
      user?.liveness_session_id,
      user?.wallet_face_session_id
   ].filter((id): id is string => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id));
   const unique = [...new Set(ids)].slice(0, MAX_SESSIONS);

   const sessions = await Promise.all(
      unique.map(async (id): Promise<DiditSessionMedia> => {
         try {
            const res = await fetch(`${apiBase}/session/${id}/decision/`, { headers: { 'x-api-key': apiKey, Accept: 'application/json' } });
            if (!res.ok) throw new Error(`Didit ${res.status}`);
            return summariseDecision(id, ((await res.json()) ?? {}) as Obj);
         } catch (err) {
            return {
               sessionId: id,
               status: null,
               createdAt: null,
               features: [],
               method: null,
               documentType: null,
               issuingCountry: null,
               faceMatchScore: null,
               livenessScore: null,
               warnings: [],
               photos: [],
               error: err instanceof Error ? err.message : 'Could not load'
            };
         }
      })
   );
   sessions.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
   return { sessions };
};
