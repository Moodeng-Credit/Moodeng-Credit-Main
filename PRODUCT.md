# Product

## Register

product

## Users

Moodeng Credit serves two primary user groups. Borrowers use the app on mobile to request small short-term USDC loans, repay them, build Trust Points, and manage credit access without exposing personal identity details. Lenders use the app to browse requests, understand practical repayment context, fund loans, monitor repayment, and earn IOU Points for ecosystem contribution.

Admins use internal screens to resolve defaults, review risk, send notices, manage requests, and keep account state accurate. Admin surfaces can be dense and operational, but borrower and lender surfaces must stay calm, clear, and client-facing.

## Product Purpose

Moodeng Credit is a privacy-safe P2P credit platform. It uses World ID and wallet infrastructure to verify uniqueness and support payments, but the visible product should feel like a practical mobile fintech app, not a crypto dashboard or social-story lending platform.

The product should help lenders understand whether a request makes practical sense while protecting borrowers from doxxing, poverty voyeurism, invasive underwriting, and social-credit scoring. Borrowers should see exactly what actions improve their trust record, what is blocked, what is unlocked, and what to do next.

## Brand Personality

Practical, friendly, and credible.

Moodeng should feel soft and approachable, with a playful mascot used lightly, but the core financial screens must remain clear and serious. The product should be simple enough for a stressed borrower on a phone, but precise enough for lenders and admins to trust the information.

## Anti-references

Do not make Moodeng look like a crypto trading terminal, a payday-loan shark app, a therapy intake form, or a social-credit dossier. Avoid heavy dark client-facing UI, neon Web3 styling, generic SaaS hero sections, glassmorphism, decorative gradient orbs, vague AI-looking cards, and interfaces that hide the actual next action.

Do not ask borrowers for employer names, addresses, phone numbers, social handles, exact salary, workplace proof, video proof, or personal contacts. Do not use labels like safe, approved, low risk, worthy, deserving, guaranteed, or likely to repay for lender-facing request analysis.

## Design Principles

1. Show practical context, not personal identity. Lenders need timing, amount fit, repayment history, and neutral request context, not a borrower dossier.
2. Make every state actionable. If someone is blocked, unverified, missing a role, defaulted, or waiting on a reset link, the screen must say what happened and what the user can do next.
3. Keep financial screens calm. Use the mascot and rewards to add warmth, but do not let decoration compete with loan amounts, repayment status, due dates, verification state, or support actions.
4. Separate borrower trust from lender contribution. Trust Points belong to borrower reputation and milestones. IOU Points belong to lender ecosystem contribution.
5. Prefer real data over mock state. Preview-only data is acceptable for local review, but production surfaces should be wired to Supabase state or clearly marked as unavailable.

## Accessibility & Inclusion

Moodeng should be mobile-first and readable for users with imperfect eyesight. Use strong contrast, clear type hierarchy, large tap targets, visible focus states, and plain language. Avoid tiny badges as the only source of meaning. Do not rely on color alone for important states like verified, blocked, defaulted, locked, unlocked, or overdue.
