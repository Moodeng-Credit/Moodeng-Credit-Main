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
 * request they can't read doesn't get funded. This catches the common case — Tagalog and
 * Taglish — by counting function words that have no English homograph. Content words
 * (gamot, tuition, sahod) are deliberately absent: they show up inside otherwise-English
 * sentences, and one borrowed noun shouldn't fail an English reason.
 */
const TAGALOG_MARKERS = new Set([
   'ako',
   'akin',
   'ang',
   'ako’y',
   'ang mga',
   'aking',
   'ay',
   'dahil',
   'ganito',
   'hindi',
   'ito',
   'ka',
   'kailangan',
   'kami',
   'kaming',
   'kasi',
   'kay',
   'ko',
   'kong',
   'kumuha',
   'lang',
   'mag',
   'maga',
   'magkano',
   'mga',
   'mo',
   'na',
   'namin',
   'nang',
   'naman',
   'nasa',
   'natin',
   'ng',
   'ngayon',
   'nila',
   'nito',
   'niya',
   'para',
   'po',
   'sa',
   'saka',
   'sila',
   'siya',
   'yung',
   'ulit',
   'upang'
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
};

export const checkReasonQuality = (rawReason: string): ReasonQuality => {
   const reason = rawReason.trim();
   if (!reason) return { ok: false, hint: '' };

   if (NON_LATIN.test(reason)) return { ok: false, hint: NOT_ENGLISH_HINT };

   const words = reason.split(/\s+/).filter(Boolean);

   // One long unbroken string is the classic mash ("dwadpajdiwajdwad…"). Real reasons —
   // even terse ones — are several words.
   if (words.length < 4) {
      return { ok: false, hint: 'Write it as a sentence — what the money is for and when you get paid.' };
   }

   const normalized = words.map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}’']/gu, ''));

   const oddWords = words.filter((word) => !looksLikeWord(word)).length;
   if (oddWords / words.length > 0.34) {
      return { ok: false, hint: "This doesn't look like real words yet — tell lenders what the loan is for." };
   }

   // "aaaa aaaa aaaa aaaa" and other filler that pads the counter without saying anything.
   const distinctWords = new Set(normalized).size;
   if (words.length >= 6 && distinctWords / words.length < 0.4) {
      return { ok: false, hint: 'Try saying it once, clearly — repeating words does not help lenders.' };
   }

   // Two Tagalog function words is well past coincidence ("para" alone can be a name or
   // "para-athlete"; "sa" alone can be an abbreviation), and Taglish always clears it.
   const tagalogHits = normalized.filter((word) => TAGALOG_MARKERS.has(word)).length;
   if (tagalogHits >= 2) return { ok: false, hint: NOT_ENGLISH_HINT };

   return { ok: true, hint: '' };
};
