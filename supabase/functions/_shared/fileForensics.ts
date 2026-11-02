// Fake-document checks that read the file itself, in plain code — no AI involved, so they work the
// same whichever model reads the document. Used by incomeDocs.ts.
//
//   imageInfo       width/height from the PNG / JPEG / WebP header
//   aiSize          a "screenshot" in a standard AI-generator size (1024×1024, 1024×1536…) — real
//                   phone screenshots are the phone's screen size
//   fileMarkers     tags hidden in the file: "made with AI" labels (C2PA / IPTC trainedAlgorithmicMedia),
//                   generator names (OpenAI, Midjourney, Stable Diffusion's prompt text…) and photo
//                   editors. Finding one proves it; not finding one proves nothing (re-saving strips them).
//   rowKeys         date|amount per transaction, to spot the same history sent by different accounts
//   gcashRefIssues  GCash reference numbers are 13 digits and never repeat; made-up ones often aren't

export type ImageInfo = { format: 'png' | 'jpeg' | 'webp'; width: number; height: number };

const u16be = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];
const u16le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8);
const u24le = (b: Uint8Array, i: number) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32be = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
const ascii = (b: Uint8Array, i: number, n: number) => String.fromCharCode(...b.subarray(i, i + n));

/** Width and height from the image header, or null for anything else. Pure. */
export const imageInfo = (b: Uint8Array): ImageInfo | null => {
   if (b.length > 24 && b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return { format: 'png', width: u32be(b, 16), height: u32be(b, 20) };
   if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
         if (b[i] !== 0xff) {
            i++;
            continue;
         }
         const marker = b[i + 1];
         // SOF markers carry the frame size (C4 = DHT, C8 = JPG, CC = DAC are not frames).
         if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
            return { format: 'jpeg', height: u16be(b, i + 5), width: u16be(b, i + 7) };
         }
         if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
            i += 2;
            continue;
         }
         i += 2 + u16be(b, i + 2);
      }
      return null;
   }
   if (b.length > 30 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') {
      const chunk = ascii(b, 12, 4);
      if (chunk === 'VP8X') return { format: 'webp', width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
      if (chunk === 'VP8L') {
         const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
         return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (chunk === 'VP8 ') return { format: 'webp', width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
   }
   return null;
};

// Output sizes of the common image generators (ChatGPT/DALL·E, Midjourney, Stable Diffusion/SDXL,
// Flux, Gemini/Imagen). No phone screen is one of these.
const AI_SIZES = new Set(
   [
      [1024, 1024],
      [1024, 1536],
      [1024, 1792],
      [2048, 2048],
      [512, 512],
      [768, 768],
      [896, 1152],
      [832, 1216],
      [768, 1344],
      [640, 1536],
      [1088, 1920],
      [928, 1664],
      [864, 1536],
      [1536, 2048]
   ].flatMap(([w, h]) => [`${w}x${h}`, `${h}x${w}`])
);

/** True when the image is exactly a standard AI-generator size. Pure. */
export const isAiSize = (info: ImageInfo | null) => Boolean(info && AI_SIZES.has(`${info.width}x${info.height}`));

export type FileMarkers = { aiLabel: string | null; generator: string | null; editor: string | null };

const GENERATORS: Array<[RegExp, string]> = [
   [/OpenAI|ChatGPT|DALL[-·]?E/, 'OpenAI / ChatGPT'],
   [/Midjourney/i, 'Midjourney'],
   [/Stable Diffusion|Negative prompt:|Steps: \d+, Sampler:/, 'Stable Diffusion'],
   [/ComfyUI|"class_type"/, 'ComfyUI'],
   [/Adobe Firefly/i, 'Adobe Firefly'],
   [/Google Gemini|Imagen|SynthID/, 'Google Gemini / Imagen'],
   [/Ideogram/, 'Ideogram'],
   [/black-forest-labs|FLUX\.1/, 'Flux'],
   [/Leonardo\.Ai/i, 'Leonardo'],
   [/Grok|xAI Aurora/, 'Grok']
];

const EDITORS: Array<[RegExp, string]> = [
   [/Adobe Photoshop/, 'Photoshop'],
   [/Snapseed/, 'Snapseed'],
   [/PicsArt/i, 'PicsArt'],
   [/Canva/, 'Canva'],
   [/GIMP/, 'GIMP'],
   [/Pixelmator/, 'Pixelmator'],
   [/Lightroom/, 'Lightroom'],
   [/Meitu/, 'Meitu']
];

/**
 * Tags hidden in the file's metadata. Only the first and last 256 KB are searched: metadata lives in
 * the header (and C2PA sometimes at the end), and the compressed pixels in between are noise. Pure.
 */
export const fileMarkers = (b: Uint8Array): FileMarkers => {
   const window = 256 * 1024;
   let head = b;
   if (b.length > window * 2) {
      head = new Uint8Array(window * 2);
      head.set(b.subarray(0, window));
      head.set(b.subarray(b.length - window), window);
   }
   const text = new TextDecoder('latin1').decode(head);
   // The IPTC "digital source type" that C2PA Content Credentials and Google/OpenAI/Adobe use for AI images.
   const aiLabel = /trainedAlgorithmicMedia|algorithmicMedia/.test(text) ? 'labelled as AI-made (Content Credentials)' : null;
   const generator = GENERATORS.find(([re]) => re.test(text))?.[1] ?? null;
   const editor = EDITORS.find(([re]) => re.test(text))?.[1] ?? null;
   return { aiLabel, generator, editor };
};

/** date|amount for each transaction, to compare histories across accounts. Pure. */
export const rowKeys = (rows: Array<{ date: string; amount: number }>) => [...new Set(rows.map((r) => `${r.date}|${Math.round(r.amount * 100) / 100}`))];

/** Share of this history's rows that also appear in another document (0–1). Pure. */
export const rowOverlap = (mine: string[], theirs: string[]) => {
   if (!mine.length) return 0;
   const set = new Set(theirs);
   return mine.filter((k) => set.has(k)).length / mine.length;
};

/**
 * GCash reference numbers (printed as "Ref No. 1234 567 890123") are 13 digits and unique per
 * transaction. Reads them out of the rows' source text. Pure.
 */
export const gcashRefIssues = (rows: Array<{ source_text: string }>) => {
   const refs: string[] = [];
   for (const r of rows) {
      // At most 3 space-separated digit groups ("1234 567 890123"), so an amount after it isn't swallowed.
      const m = r.source_text.match(/Ref(?:erence)?\.?\s*(?:No\.?|#|Number)?\s*:?\s*(\d{1,13}(?: \d{1,13}){0,2})(?!\d)/i);
      if (m) refs.push(m[1].replace(/\D/g, ''));
   }
   const wrongLength = refs.filter((r) => r.length !== 13);
   const repeated = refs.filter((r, i) => refs.indexOf(r) !== i);
   return { found: refs.length, wrongLength, repeated: [...new Set(repeated)] };
};
