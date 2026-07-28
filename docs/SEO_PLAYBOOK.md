# SEO Playbook

_The strategy and the checklists for making Moodeng Credit findable. Read this before doing any SEO work._

## The core problem: "Moodeng" is a hostile keyword

The bare word **"moodeng"** is owned globally by **Moo Deng, the viral pygmy hippo**. We will never outrank a famous animal for the head term, and trying to is a waste of effort. So we do **not** optimize for bare "moodeng." We fight two battles we can actually win.

### Battle 1 — own the *branded* query ("Moodeng Credit")

People who heard about us — from a lender, a friend, Telegram — search **"moodeng credit"**, not "moodeng." The hippo does not compete on that. We must be #1 there with a clean, trustworthy result.

**Rules:**
- Always write **"Moodeng Credit"** in titles, H1s, link anchor text, and social profile names. Never let the bare word "Moodeng" stand alone in a title.
- Keep the brand-entity schema strong (see below) so Google files us as a fintech, not the animal.

### Battle 2 — capture *non-branded intent* (the real demand pool)

People who do **not** know us search their *problem*, not our name: "borrow money philippines no bank," "what is a p2p loan," "how to build credit with no history." Zero hippo competition. This is where net-new users come from. We win it with genuinely useful content pages (see "Adding intent content" below).

---

## What's shipped

| PR | Branch | What | Status |
|---|---|---|---|
| #746 | `feat/seo-brand-entity-schema` | Enriched `Organization` JSON-LD in `index.html` + `public/landing/index.html` — `@type:["Organization","FinancialService"]`, real `sameAs`, `alternateName`, `areaServed`, "not affiliated with the pygmy hippo" note; added `twitter:site`. | Open, → `staging` |
| #747 | `feat/seo-intent-content` | 3 intent-keyword blog posts + sitemap entries. | Open, → `staging` |

Earlier technical foundation (already merged, mostly done): SPA prerender, per-route canonicals, sitemap coverage, mobile-first crawl fix.

---

## Off-site actions (owner-only — higher leverage than any code change)

These require logging into external accounts and cannot be automated. Do them in order.

### A. Google Search Console — resubmit sitemap + push priority pages

Do this **after** PR #747 is merged and live (inspecting a URL that 404s wastes the request).

**1. Resubmit the sitemap**
1. [search.google.com/search-console](https://search.google.com/search-console) → select the `moodeng.app` property (prefer the **Domain** property, not just URL-prefix).
2. Sidebar → **Sitemaps**.
3. Under "Add a new sitemap" re-enter `sitemap.xml` → **Submit** (resubmitting forces a re-fetch even if already listed).
4. Confirm **Success** and that the Discovered-URLs count looks right (~35).

**2. Request indexing for the priority pages** (URL Inspection → paste URL → **Request Indexing**):
- `https://moodeng.app/` — confirm it indexes as itself, **not** redirecting to a `/landing/` canonical (that was the old bug).
- `https://moodeng.app/blogs/borrow-money-online-philippines-without-bank-account`
- `https://moodeng.app/blogs/what-is-a-peer-to-peer-loan-and-is-it-safe`
- `https://moodeng.app/blogs/how-to-build-credit-with-no-credit-history`

**3. Verify the entity is landing (~1 week later)**
- URL Inspection on `/` → View crawled page → More info → Structured data: confirm `Organization / FinancialService` with no errors (cross-check in the [Rich Results Test](https://search.google.com/test/rich-results)).
- Rich Results Test on one blog URL → confirm **FAQ** + **Article/BlogPosting** detected.
- Performance → filter Queries containing `moodeng credit` → watch branded impressions/clicks climb.

**4. Hygiene**
- Removals tool → confirm nothing is suppressing `moodeng.app`.
- Page indexing report → watch for routes wrongly excluded as "Alternate page with proper canonical tag."

### B. Wikidata item — "Moodeng Credit"

The single strongest off-site move to force Google's knowledge graph to separate us from the hippo. Go to [wikidata.org](https://www.wikidata.org) → log in → **Create a new Item**. Values autocomplete from a dropdown.

- **Label:** `Moodeng Credit`
- **Description:** `peer-to-peer lending platform for small USDC loans`
- **Aliases:** `Moodeng`, `Moodeng Credit app`

**Statements** (type the property, pick the value from the dropdown):

| Property | Value |
|---|---|
| instance of (P31) | `business` **and** `financial technology` |
| official website (P856) | `https://moodeng.app` |
| industry (P452) | `peer-to-peer lending` (or `microfinance`) |
| X username (P2002) | `moodengcredit` |
| country (P17) | _fill in: legal HQ country (leave blank if unsure — better empty than wrong)_ |
| inception (P571) | _fill in: founding date_ |
| founded by (P112) | _optional: founder name(s)_ |
| logo image (P154) | _optional: requires uploading the logo to Wikimedia Commons under a free license first_ |

**Notability caveat:** Wikidata sometimes flags brand-new startups with no independent coverage for deletion. De-risk by adding a **reference** to at least one independent source on a statement (a news mention, a directory listing, an app-store page, a regulatory/registration listing). Our own blog does **not** count as independent about ourselves. With zero external coverage, rely on the schema + Google Business Profile + consistent socials instead; add Wikidata once some third-party mention exists.

### C. Consistent brand naming

Rename all social profiles and listings to **"Moodeng Credit"** (not bare "Moodeng") so anchor/entity text everywhere reinforces the distinct brand.

---

## Adding intent content (the repeatable growth lever)

New intent-keyword pages should be **blog posts**, not `/learn` guides — the blog model carries the SEO fields that matter (`seoTitle`, `metaDescription`, `keywords`, a quick-answer `summary`, and `faq`, which renders as **FAQPage** schema → featured-snippet eligible). `/learn` guide bodies are plain text and weaker for this.

**To add one post (data-only — no route or component changes):**
1. Append a `BlogPost` object to `src/views/blogs/blogPosts.ts`. Fill `slug`, `title`, `dek`, `sections`, and the SEO fields (`seoTitle`, `metaDescription`, `keywords`, `summary`, `faq`, `sources`). Reuse existing art in `public/hippos/` for `image` — do not reference an asset that doesn't exist.
2. Add the URL to `public/sitemap.xml`.
3. The `/blogs/:slug` route and the index render it automatically. Blog SEO is injected by `src/views/blogs/MoodengBlogDetail.tsx` (it emits `BlogPosting` + `FAQPage` JSON-LD), **not** `usePageSeo`.

**Content rules (house voice):**
- Target the searcher's *problem*, not our brand. Titles = what people actually type.
- Genuinely useful, not keyword filler. Contraction-light, evidence-based, Philippines-grounded.
- Truth only on numbers — don't invent statistics; cite real sources.
- No insider jargon in copy ("KYC", "liveness", "eID", "Didit"). Say "prove you are a real person" / "verify your ID".
- USDC framing: a stable digital dollar; cash-out to pesos via off-ramp services (GCash/bank), **not** a connectable fiat wallet.

**Backlog of intent topics worth writing next:** "online loans no requirements Philippines", "how to build credit without a credit card", "is USDC safe / what is a stablecoin", "small loan for emergencies Philippines", "loan without collateral".
