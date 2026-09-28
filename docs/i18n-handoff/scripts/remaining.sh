#!/usr/bin/env bash
# Regenerates docs/i18n-handoff/remaining/<locale>.json: on-screen English strings that still have no
# translation in translations.ts, screenTranslations.ts or src/i18n/coverage/<locale>*.ts.
# Run from the repo root after `pnpm install`.
set -euo pipefail
ROOT=$(pwd); OUT=$ROOT/docs/i18n-handoff/scripts/.build; mkdir -p "$OUT"
E=$(find -L node_modules/.pnpm/node_modules/esbuild/bin -name esbuild | head -1)
"$E" src/i18n/translations.ts --bundle --format=esm --platform=node --outfile="$OUT/translations.mjs" --log-level=error
"$E" src/i18n/screenTranslations.ts --bundle --format=esm --platform=node --outfile="$OUT/screen.mjs" --log-level=error
for l in fil id th vi; do "$E" src/i18n/coverage/$l.ts --bundle --format=esm --platform=node --outfile="$OUT/cov-$l.mjs" --log-level=error --alias:@=./src; done
cp docs/i18n-handoff/scripts/missing.mjs docs/i18n-handoff/scripts/inline.cjs "$OUT/"
node "$OUT/inline.cjs" "$ROOT" "$OUT" >/dev/null
( cd "$OUT" && node missing.mjs "$ROOT" "$OUT" >/dev/null && node --input-type=module -e '
import fs from "fs";
const norm=s=>s.replace(/\s+/g," ").trim();
for (const l of ["fil","id","th","vi"]) {
  const cov=Object.values(await import(`./cov-${l}.mjs`))[0]; const k=new Set(Object.keys(cov).map(norm));
  const a=JSON.parse(fs.readFileSync(`missing-${l}.json`)), b=JSON.parse(fs.readFileSync(`inline-${l}.json`));
  const seen=new Set(), rest={}; let n=0;
  for (const x of [...a,...b]) if(!seen.has(x.en)&&!k.has(x.en)){seen.add(x.en);(rest[x.file]??=[]).push(x.en);n++;}
  fs.writeFileSync(`'"$ROOT"'/docs/i18n-handoff/remaining/${l}.json`,JSON.stringify(rest,null,1)); console.log(l,"remaining",n,"files",Object.keys(rest).length);
}' )
