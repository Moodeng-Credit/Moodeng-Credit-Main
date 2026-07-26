/**
 * Cheap, offline sanity check on the borrower's free-text loan reason.
 *
 * The character counter alone can't tell "Rent is due Friday and I'm $30 short" from
 * "dwadpajdiwajdwadwadpjawojdawiodawdawdaw" — both clear 40 characters, and the field used
 * to answer both with a green "Looks good". Confirming keyboard mash is worse than saying
 * nothing: the borrower ships it, the request reads as noise to lenders, and the only
 * pushback arrives later from the server-side effort check.
 *
 * This runs on every keystroke, so it stays deliberately dumb — shape checks only, no
 * dictionary, no network. It also keeps mash from ever reaching the paid DeepSeek check.
 * `check-loan-input` is still the real judge of vagueness; this only withholds praise from
 * text that isn't a usable English sentence yet.
 */

const VOWELS = /[aeiouyAEIOUYà-ü]/;
/** Five consonants in a row is home-row mashing, not a word. */
const CONSONANT_RUN = /[^aeiouyà-ü\W\d]{5,}/i;

/**
 * Reasons must be written in English: the lenders reading them are in the US and EU, and a
 * request they can't read doesn't get funded. This catches the two languages borrowers
 * actually write in — Tagalog and Cebuano — by their function words.
 *
 * Content words (gamot, tuition, sahod, palengke) are deliberately absent: they turn up
 * inside otherwise-English sentences and one borrowed noun must not fail an English reason.
 *
 * DECISIVE markers have no English homograph, so a single one settles it. WEAK markers are
 * words that can appear in English text — "kay" is a name, "hindi" is a language, "na" is
 * how people type N/A, "para" is a sports prefix — so they only count in pairs. "mo" and
 * "po" are left out of both: "6 mo old" and "the PO I owe" are ordinary English.
 */
const DECISIVE_MARKERS = new Set([
   // Tagalog
   'ako',
   'akin',
   'aking',
   'ang',
   'dahil',
   'kailangan',
   'kami',
   'kaming',
   'kayo',
   'mga',
   'namin',
   'natin',
   'ng',
   'ngayon',
   'ngayong',
   'nila',
   'ninyo',
   'nito',
   'niya',
   'pambayad',
   'pambili',
   'pamasahe',
   'sila',
   'siya',
   'upang',
   'yung',
   // Cebuano/Bisaya
   'akong',
   'gyud',
   'imong',
   'iyang',
   'kinahanglan',
   'kwarta',
   'nako',
   'namo',
   'nimo'
]);
const WEAK_MARKERS = new Set([
   'ay',
   'hindi',
   'ito',
   'ka',
   'kana',
   'karon',
   'kasi',
   'kay',
   'kini',
   'ko',
   'kong',
   'lang',
   'mao',
   'na',
   'naman',
   'nang',
   'nasa',
   'nga',
   'ni',
   'og',
   'para',
   'sa',
   'saka',
   'ug',
   'ulit',
   'unsa',
   'wala'
]);
/** Scripts we can't serve at all — the reason would be unreadable to every lender. */
const NON_LATIN = /[Ѐ-ӿ؀-ۿ฀-๿぀-ヿ一-鿿가-힯]/;

/** Share of distinct 3-grams — "dawdawdawdaw" repeats a handful; real sentences don't. */
const trigramVariety = (word: string): number => {
   if (word.length < 6) return 1;
   const grams = new Set<string>();
   for (let i = 0; i + 3 <= word.length; i += 1) grams.add(word.slice(i, i + 3));
   return grams.size / (word.length - 2);
};

/** A "word" is plausible if it has a vowel and isn't an improbably long run of letters. */
const looksLikeWord = (word: string): boolean => {
   const letters = word.replace(/[^\p{L}]/gu, '');
   if (!letters) return true; // numbers, currency, dates — fine on their own
   if (letters.length > 18) return false;
   if (letters.length >= 4 && !VOWELS.test(letters)) return false;
   if (CONSONANT_RUN.test(letters)) return false;
   return trigramVariety(letters.toLowerCase()) >= 0.5;
};

const NOT_ENGLISH_HINT = 'Please write your reason in English — the lenders reading it don’t speak Tagalog.';

export type ReasonQuality = {
   /** True when the text looks like a real English sentence — only then do we confirm it. */
   ok: boolean;
   /** Shown in place of "Looks good" when it doesn't. Empty when ok. */
   hint: string;
   /**
    * Why it failed. Callers treat these differently: `not-english` is an objective rule the
    * submit gate enforces, while the rest are advisory nudges (the DeepSeek check is the
    * judge of whether a reason is good enough).
    */
   code: 'ok' | 'empty' | 'not-english' | 'too-few-words' | 'not-words' | 'repeated';
};

export const checkReasonQuality = (rawReason: string): ReasonQuality => {
   const reason = rawReason.trim();
   if (!reason) return { ok: false, hint: '', code: 'empty' };

   if (NON_LATIN.test(reason)) return { ok: false, hint: NOT_ENGLISH_HINT, code: 'not-english' };

   const words = reason.split(/\s+/).filter(Boolean);

   // One long unbroken string is the classic mash ("dwadpajdiwajdwad…"). Real reasons —
   // even terse ones — are several words.
   if (words.length < 4) {
      return { ok: false, hint: 'Write it as a sentence — what the money is for and when you get paid.', code: 'too-few-words' };
   }

   const normalized = words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}’']/gu, ''));

   const oddWords = words.filter((word) => !looksLikeWord(word)).length;
   if (oddWords / words.length > 0.34) {
      return { ok: false, hint: "This doesn't look like real words yet — tell lenders what the loan is for.", code: 'not-words' };
   }

   // "aaaa aaaa aaaa aaaa" and other filler that pads the counter without saying anything.
   const distinctWords = new Set(normalized).size;
   if (words.length >= 6 && distinctWords / words.length < 0.4) {
      return { ok: false, hint: 'Try saying it once, clearly — repeating words does not help lenders.', code: 'repeated' };
   }

   // One unmistakable marker, or two that could each be an English accident. Taglish clears
   // this easily — a sentence built on Tagalog grammar can't avoid "ng"/"ako"/"sa ... ko".
   const decisive = normalized.some((word) => DECISIVE_MARKERS.has(word));
   const weakHits = normalized.filter((word) => WEAK_MARKERS.has(word)).length;
   if (decisive || weakHits >= 2) return { ok: false, hint: NOT_ENGLISH_HINT, code: 'not-english' };

   return { ok: true, hint: '', code: 'ok' };
};
