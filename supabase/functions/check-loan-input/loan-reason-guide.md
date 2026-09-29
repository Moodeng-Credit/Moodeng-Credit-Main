# Loan Reason Guide

This is what the loan-reason checker reads before judging every "Reason for Borrowing".
The Moodeng team owns this file: edit it in plain English, then run
`node tools/build-loan-reason-guide.mjs` and `node tools/eval-loan-reason.mjs` before shipping.

## Who reads the reason

Borrowers are mostly in the Philippines, Malaysia and Indonesia, borrowing small amounts
(usually $10–$100 in USDC) until payday. Lenders are in the US and Europe. A lender reads the
reason to answer one question: **"What will this money be used for?"** They do not need a life
story, exact amounts or receipts.

Lenders are generous. Every example in the "Real reasons lenders funded" list below was
funded, most within a few hours. The checker must never be stricter than the lenders are.

## The rule of thumb

**If a lender can tell what the money is for, it passes.** Short and simple is fine. Grammar
mistakes and typos are fine. Being specific about the category is enough: "electric bill",
"medicine", "rent", "school supplies", "allowance for my parents" all tell the lender what the
money is for.

## Verdicts

Choose exactly one category.

### `good` — pass

The reason names what the money is for, even briefly or broadly.
Examples: bills or a named bill (electricity, water, internet, rent), medicine or a medical
check-up, food or groceries, school fees or supplies, supporting family ("support my kids",
"allowance for my parents"), transport, repairs to a named thing (bike, laptop, car, printer),
business stock, ingredients or advertising, visa or documents, travel.
Payday or repayment timing is a bonus, never required.

### `tip` — pass, with an optional suggestion

It's a real reason but generic, so a lender has to guess a little. Let it through, and offer a
friendly tip that would make it more convincing.
Examples: "living expenses until payday", "personal expenses", "emergency at home",
"family expenses", "additional living expenses".

### `vague` — ask them to add what the money is for

There is no purpose at all: the lender cannot tell what the money is for.
Examples: "need money", "loan please", "help me", "I need a loan for something",
"for my needs", "urgent", "personal", "for personal use", "personal reasons".
"Personal" on its own is not a purpose: it's `vague` unless they also say what kind of
expenses (then "personal expenses until payday" is a `tip`).
Do not use this for reasons that name a category, however short.

### `placeholder` — ask for a real reason

Random keys, test text, repeated words, copied template text or lorem ipsum.
Examples: "asdfghjkl", "test test test", "money money money", "lorem ipsum",
"reason reason reason".

### `not_english` — must be rewritten in English

The reason must be written in English, because lenders only read English. Tagalog, Taglish,
Malay, Bahasa Indonesia and other languages are not accepted, even when the meaning is clear.
One borrowed word inside an English sentence is fine ("buying gamot for my mother").
Always include an English translation as the suggestion, so the borrower can use it in one tap.

### `not_allowed` — we can't fund this

Gambling or betting, anything illegal, buying crypto or trading, or paying another lender or
lending app. Say so kindly and briefly.

## Writing the hint

- One short sentence, friendly, never blaming. Talk to the borrower as "you".
- Say what is missing, using their own words where possible
  ("You mentioned bills — which ones? Electricity, water, rent?").
- For `good`, leave the hint empty.
- Never mention AI, rules, scores or "the system".

## Writing the suggestion

- A complete reason the borrower could post as-is, in English, 40–160 characters.
- Build it from what they wrote. Never invent facts they didn't give (no made-up amounts,
  dates, names or conditions). If they gave no purpose at all, leave the suggestion empty.
- For `not_english`, the suggestion is a faithful English translation of their text.
- For `good`, leave the suggestion empty.

## Real reasons lenders funded

All of these were funded. They must pass (`good` or `tip`).

- "Allowance for my parents"
- "Family expenses in the Philippines"
- "To support my kids in the Philippines."
- "visa application"
- "Additional living expenses"
- "Need quick cash for electricity bills before payday"
- "I need it to pay my bills and additional for my business."
- "Utility bills are due last week and our payday is every 20th of the month."
- "For medical need. I need to buy medicine for maintemamce"
- "Need to change engine oil for my old toyota"
- "Printer fixing ready to get job interview"
- "To my small business, to pay social media advertising"
- "I would need to pay my power bill and buy some groceries"
- "Emergency Expenses for my medical hope you can help me"
- "pay for bills and to pay some emergency at home"
- "The loan will be used to cover important personal expenses and improve my overall financial
  stability. I have a stable source of income and a clear repayment plan."

## Worked examples

| Reason | Category | Hint | Suggestion |
|---|---|---|---|
| "Pay my electricity bill before payday on the 15th" | good | | |
| "Allowance" | tip | Who is the allowance for, or what will it cover? | |
| "pay for bills and some emergency at home" | tip | Which bills? Naming them helps lenders say yes faster. | Paying my household bills and an emergency at home until payday. |
| "need money" | vague | What will the money be used for? | |
| "I need a loan for something I need to buy okay thanks" | vague | What are you buying? Lenders want to know what the money is for. | |
| "asdfghjkl qwerty" | placeholder | This looks like random text — tell lenders what the money is for. | |
| "Pambayad sa kuryente at gamot ng nanay ko bago ang sahod" | not_english | Please write this in English so lenders can read it. | Paying the electricity bill and my mother's medicine before payday. |
| "Untuk bayar bil elektrik dan beli ubat untuk ibu saya" | not_english | Please write this in English so lenders can read it. | Paying the electricity bill and buying medicine for my mother. |
| "Bet on the basketball game this weekend" | not_allowed | We can't fund betting or gambling. | |
