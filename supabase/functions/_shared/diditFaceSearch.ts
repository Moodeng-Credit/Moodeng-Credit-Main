// Didit 1:N face search + 1:1 face match, over the standalone REST endpoints.
//
// This is the mechanism the embedded-wallet gate actually needs: it works with NO document,
// so it dedupes lenders (who never KYC) as well as borrowers, across roles, off the face alone.
// The hosted wallet scan only has to prove liveness and capture a portrait; the dedup decision
// is made here by searching that portrait against every previously-approved Didit session.
//
//   POST {apiBase}/face-search/   (x-api-key)  — 1:N against all approved sessions. Free.
//   POST {apiBase}/face-match/    (x-api-key)  — 1:1 selfie-vs-reference. Used for the
//                                                 "wallet face must match the borrower's KYC" rule.
//
// Response matches each carry vendor_data (our Supabase user id) + similarity_percentage, which
// is exactly what lets us tell "this is the same person's own account" from "someone else's".

const DEFAULT_API_BASE = 'https://verification.didit.me/v3';

export type FaceSearchMatch = {
   vendorData: string | null;
   sessionId: string | null;
   similarity: number;
   isBlocklisted: boolean;
};

const apiBase = () => (Deno.env.get('DIDIT_API_BASE')?.trim() || DEFAULT_API_BASE).replace(/\/$/, '');

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const readField = (obj: unknown, keys: string[]): unknown => {
   if (!obj || typeof obj !== 'object') return undefined;
   const record = obj as Record<string, unknown>;
   for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key];
   }
   return undefined;
};

/**
 * Pull a usable face image URL out of a Didit session decision. A wallet scan is a
 * liveness/selfie session, but exactly which field holds the frame varies by workflow, so we
 * try the known spots in order rather than assume one. Returns the first signed URL found.
 */
export const extractPortraitUrl = (decision: unknown): string | null => {
   if (!decision || typeof decision !== 'object') return null;
   const d = decision as Record<string, unknown>;

   // 1:1 face-match source is the live selfie — the best face frame when present.
   for (const fm of asArray(d.face_matches)) {
      const src = readField(fm, ['source_image', 'target_image']);
      if (typeof src === 'string' && src) return src;
   }
   // Liveness reference/portrait frames.
   for (const lc of asArray(d.liveness_checks)) {
      const img = readField(lc, ['reference_image', 'portrait_image', 'image', 'frame_image']);
      if (typeof img === 'string' && img) return img;
   }
   // ID portrait (borrowers who came through a document step).
   for (const idv of asArray(d.id_verifications)) {
      const p = readField(idv, ['portrait_image']);
      if (typeof p === 'string' && p) return p;
   }
   const top = readField(d, ['portrait_image']);
   return typeof top === 'string' ? top : null;
};

const fetchImageBlob = async (url: string): Promise<Blob | null> => {
   try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
   } catch {
      return null;
   }
};

/**
 * 1:N search the given face against all previously-approved sessions.
 * `vendorData` tags the search to this user (informational). Returns [] on any failure — the
 * caller decides how to treat an inconclusive search (we fail SAFE by not auto-approving on it).
 */
export const faceSearch = async ({
   imageUrl,
   vendorData,
   threshold = 80
}: {
   imageUrl: string;
   vendorData?: string;
   threshold?: number;
}): Promise<{ ok: boolean; matches: FaceSearchMatch[] }> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) {
      console.error('[diditFaceSearch] DIDIT_API_KEY not configured');
      return { ok: false, matches: [] };
   }

   const blob = await fetchImageBlob(imageUrl);
   if (!blob) {
      console.error('[diditFaceSearch] could not fetch portrait image');
      return { ok: false, matches: [] };
   }

   const form = new FormData();
   form.append('user_image', blob, 'face.jpg');
   // Didit uses `image` on some versions; send both keys so we don't depend on one spelling.
   form.append('image', blob, 'face.jpg');
   if (vendorData) form.append('vendor_data', vendorData);
   form.append('similarity_threshold', String(threshold));

   let res: Response;
   try {
      res = await fetch(`${apiBase()}/face-search/`, {
         method: 'POST',
         headers: { 'x-api-key': apiKey, Accept: 'application/json' },
         body: form
      });
   } catch (err) {
      console.error('[diditFaceSearch] request failed', err instanceof Error ? err.message : err);
      return { ok: false, matches: [] };
   }

   if (!res.ok) {
      console.error('[diditFaceSearch] non-ok', res.status, await res.text().catch(() => ''));
      return { ok: false, matches: [] };
   }

   const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
   if (!body) return { ok: false, matches: [] };

   // The matches array lives under a few possible keys depending on version.
   const rawMatches =
      asArray(readField(body, ['matches'])) ||
      asArray(readField(readField(body, ['face_search']) as Record<string, unknown>, ['matches']));

   const matches: FaceSearchMatch[] = asArray(rawMatches).map((m) => {
      const rawScore = Number(readField(m, ['similarity_percentage', 'similarity', 'score', 'confidence']) ?? 0);
      const vendor = readField(m, ['vendor_data', 'external_user_id', 'user_id']);
      const session = readField(m, ['session_id']);
      return {
         vendorData: typeof vendor === 'string' ? vendor : null,
         sessionId: typeof session === 'string' ? session : null,
         similarity: rawScore > 0 && rawScore <= 1 ? rawScore * 100 : rawScore,
         isBlocklisted: Boolean(readField(m, ['is_blocklisted']))
      };
   });

   return { ok: true, matches };
};

/** 1:1 compare two face image URLs. Returns the similarity 0-100, or null if it couldn't run. */
export const faceMatch = async ({ imageUrl1, imageUrl2 }: { imageUrl1: string; imageUrl2: string }): Promise<number | null> => {
   const apiKey = Deno.env.get('DIDIT_API_KEY');
   if (!apiKey) return null;

   const [b1, b2] = await Promise.all([fetchImageBlob(imageUrl1), fetchImageBlob(imageUrl2)]);
   if (!b1 || !b2) return null;

   const form = new FormData();
   form.append('reference_image', b1, 'a.jpg');
   form.append('user_image', b2, 'b.jpg');

   try {
      const res = await fetch(`${apiBase()}/face-match/`, {
         method: 'POST',
         headers: { 'x-api-key': apiKey, Accept: 'application/json' },
         body: form
      });
      if (!res.ok) return null;
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      const raw = Number(readField(body, ['similarity_percentage', 'similarity', 'score']) ?? -1);
      if (raw < 0) return null;
      return raw > 0 && raw <= 1 ? raw * 100 : raw;
   } catch {
      return null;
   }
};

const FACE_MATCH_THRESHOLD = 80;

export type WalletFaceOutcome = {
   status: 'APPROVED' | 'DUPLICATE' | 'MISMATCH' | 'DECLINED';
   /** Distinct OTHER accounts whose face this scan matched (for the fraud signal). */
   collisions: { vendorData: string; similarity: number }[];
};

/**
 * The decision, from a completed wallet face scan.
 *
 * Fails SAFE: if the search itself couldn't run (network/misconfig), we DECLINE rather than
 * approve, so an outage can never hand out an ungated wallet. Recovery of an existing wallet
 * never reaches here — that's gated earlier by the grant.
 */
export const resolveWalletFaceOutcome = async ({
   decision,
   userId,
   livenessApproved,
   isKycdBorrower,
   kycPortraitUrl
}: {
   decision: unknown;
   userId: string;
   livenessApproved: boolean;
   isKycdBorrower: boolean;
   kycPortraitUrl: string | null;
}): Promise<WalletFaceOutcome> => {
   if (!livenessApproved) return { status: 'DECLINED', collisions: [] };

   const portrait = extractPortraitUrl(decision);
   if (!portrait) {
      console.error('[diditFaceSearch] no portrait in decision — cannot search, failing safe');
      return { status: 'DECLINED', collisions: [] };
   }

   const { ok, matches } = await faceSearch({ imageUrl: portrait, vendorData: userId });
   if (!ok) return { status: 'DECLINED', collisions: [] };

   const strong = matches.filter((m) => m.similarity >= FACE_MATCH_THRESHOLD);

   // Someone ELSE's account already owns this face → one-per-person / cross-role refusal.
   const collisions = strong
      .filter((m) => m.vendorData && m.vendorData !== userId)
      .map((m) => ({ vendorData: m.vendorData as string, similarity: m.similarity }));
   if (collisions.length > 0) {
      // Dedup by account.
      const seen = new Set<string>();
      const unique = collisions.filter((c) => (seen.has(c.vendorData) ? false : (seen.add(c.vendorData), true)));
      return { status: 'DUPLICATE', collisions: unique };
   }

   // Borrower rule: the wallet face must be the face they KYC'd with. Prefer an explicit 1:1
   // against the KYC portrait (reliable); fall back to the face-search self-match if we don't
   // have the KYC image.
   if (isKycdBorrower) {
      if (kycPortraitUrl) {
         const score = await faceMatch({ imageUrl1: portrait, imageUrl2: kycPortraitUrl });
         if (score !== null && score < FACE_MATCH_THRESHOLD) return { status: 'MISMATCH', collisions: [] };
      } else {
         const selfMatched = strong.some((m) => m.vendorData === userId);
         if (!selfMatched) return { status: 'MISMATCH', collisions: [] };
      }
   }

   return { status: 'APPROVED', collisions: [] };
};
