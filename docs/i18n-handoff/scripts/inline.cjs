const ts = require(process.argv[2] + '/node_modules/typescript');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2], OUT = process.argv[3];
const LOCS = ['fil', 'id', 'th', 'vi'];
const SKIP = new Set(['i18n', 'test', 'admin', '__tests__', 'blogs', 'legal']);
const walk = (d) => fs.readdirSync(d).flatMap((f) => { const p = path.join(d, f); return fs.statSync(p).isDirectory() ? (SKIP.has(f) ? [] : walk(p)) : /\.tsx?$/.test(f) && !/\.test\.|\.d\.ts$/.test(f) ? [p] : []; });
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const out = Object.fromEntries(LOCS.map((l) => [l, []]));
const seen = Object.fromEntries(LOCS.map((l) => [l, new Set()]));
let dynamic = 0;
const propName = (p) => p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : null;
function strings(node, acc) {
  if (!node) return acc;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) acc.push(node.text);
  else if (ts.isTemplateExpression(node)) dynamic++;
  else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) { node.forEachChild((c) => strings(c, acc)); }
  else if (ts.isPropertyAssignment(node)) strings(node.initializer, acc);
  else node.forEachChild((c) => strings(c, acc));
  return acc;
}
const looks = (s) => /[A-Za-z]{2,}/.test(s) && !/^[a-z0-9_.\-\/:#@]+$/.test(s) && !/^(https?:|\/|#|@|[a-z]+\/)/.test(s) && !/className|^[a-z]+[A-Z]\w*$/.test(s);
function add(l, s, file) { s = norm(s); if (!looks(s) || seen[l].has(s)) return; seen[l].add(s); out[l].push({ en: s, file }); }
for (const f of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(f, 'utf8'); if (!/\ben\s*:|=== '(fil|id|th|vi)'/.test(src)) continue;
  const rel = f.replace(ROOT + '/', '');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isObjectLiteralExpression(n)) {
      const names = n.properties.map(propName);
      if (names.includes('en') && names.includes('fil')) {
        const en = n.properties.find((p) => propName(p) === 'en');
        const strs = strings(en.initializer ?? en, []);
        for (const l of LOCS) if (!names.includes(l)) strs.forEach((s) => add(l, s, rel));
      }
    }
    if (ts.isConditionalExpression(n)) {
      const t = n.condition.getText(sf); const m = t.match(/===\s*'(fil|id|th|vi)'/);
      if (m && !ts.isConditionalExpression(n.parent)) {
        // walk the chain: collect handled locales, the final else is English
        let cur = n, handled = new Set();
        while (ts.isConditionalExpression(cur)) { const mm = cur.condition.getText(sf).match(/===\s*'(fil|id|th|vi)'/); if (!mm) break; handled.add(mm[1]); cur = cur.whenFalse; }
        const strs = strings(cur, []);
        for (const l of LOCS) if (!handled.has(l)) strs.forEach((s) => add(l, s, rel));
      }
    }
    n.forEachChild(visit);
  };
  visit(sf);
}
for (const l of LOCS) { fs.writeFileSync(path.join(OUT, `inline-${l}.json`), JSON.stringify(out[l], null, 1)); const c = {}; out[l].forEach((x) => (c[x.file] = (c[x.file] || 0) + 1)); console.log(l, out[l].length, JSON.stringify(c)); }
console.log('dynamic template strings skipped:', dynamic);
