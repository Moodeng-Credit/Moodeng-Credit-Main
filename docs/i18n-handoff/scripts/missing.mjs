import * as scr from './screen.mjs';
import { translations } from './translations.mjs';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const ROOT = process.argv[2], OUT = process.argv[3];
const SKIP_DIR = new Set(['i18n','test','admin','blogs','legal','privacy-policy','terms','terms-of-service','__tests__']);
const walk = d => readdirSync(d).flatMap(f => { const p=join(d,f); return statSync(p).isDirectory() ? (SKIP_DIR.has(f)?[]:walk(p)) : (/\.tsx$/.test(f)&&!/\.test\./.test(f)?[p]:[]); });
const files = walk(join(ROOT,'src'));
const norm = s => s.replace(/\s+/g,' ').trim();
const maps={fil:scr.filipinoScreenTranslations,id:scr.indonesianScreenTranslations,th:scr.thaiScreenTranslations,vi:scr.vietnameseScreenTranslations};
const known={}; for (const [l,m] of Object.entries(maps)){known[l]=new Set(Object.keys(m).map(norm)); for (const k of Object.keys(translations.en)) if (translations[l][k]!==translations.en[k]) known[l].add(norm(translations.en[k]));}
const EN_WORDS=/\b(the|your|you|and|to|of|for|with|is|are|a|an|in|on|this|loan|loans|pay|repay|verify|wallet|borrow|lend|request|account|credit|limit|now|get|see|how|what|when|why|will|can|not|no|continue|back|next|done|learn|more|level|points|funds|funded|lender|borrower|amount|due|paid|send|receive|withdraw|deposit|balance|cancel|save|edit|close|open|start|try|help|support|share)\b/i;
const looksCopy = s => /[A-Za-z]{3,}/.test(s) && s.length>=2 && s.length<=400 && !/[{}<>=;]|=>|className|https?:|\bconst\b|\bimport\b|&&|\|\||Math\.|\.map\(/.test(s) && /^[A-Z0-9$₱"“'(¿]/.test(s) && (EN_WORDS.test(s) || /^[A-Z][a-z]+( [A-Za-z][a-z]+){0,3}[.!?…]?$/.test(s));
const out={fil:[],id:[],th:[],vi:[]}; const seen={fil:new Set(),id:new Set(),th:new Set(),vi:new Set()};
for (const f of files) {
  const src = readFileSync(f,'utf8'); const rel=f.replace(ROOT+'/','');
  const cands = new Set();
  for (const m of src.matchAll(/>\s*([^<>{}\n][^<>{}]{0,398}?)\s*</g)) cands.add(norm(m[1]));
  for (const m of src.matchAll(/\b(?:placeholder|title|label|aria-label|alt|description|heading|body|subtitle|cta|buttonLabel|text|message|hint|helper|caption|question|answer|q|a|definition|tag|eyebrow|kicker|note|detail|details|summary|tooltip|emptyText|badge|lead|intro|line|correctLine|wrongLine|useWhen|effect\w*|altName|name|step|tip|warning|error|success|confirmLabel|cancelLabel|primaryLabel|secondaryLabel)\s*[=:]\s*(['"`])([^'"`\n]{2,400}?)\1/g)) { if (!m[2].includes("${")) cands.add(norm(m[2])); }
  for (const s of [...cands].filter(looksCopy)) for (const l of Object.keys(out)) if (!known[l].has(s) && !seen[l].has(s)) { seen[l].add(s); out[l].push({ en:s, file:rel }); }
}
for (const l of Object.keys(out)) { writeFileSync(join(OUT,`missing-${l}.json`), JSON.stringify(out[l],null,1)); console.log(l, out[l].length); }
