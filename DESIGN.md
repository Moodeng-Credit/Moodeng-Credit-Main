---
name: Moodeng Credit
description: Privacy-safe mobile P2P credit with soft fintech clarity.
colors:
  primary-lavender: "#8336F0"
  primary-purple: "#6010D2"
  primary-deep: "#1C053D"
  heading: "#040033"
  surface: "#FDFCFD"
  surface-muted: "#F8F4FC"
  lavender-bg: "#F3E8FF"
  lavender-border: "#E7D8FF"
  text-muted: "#70617F"
  text-soft: "#4D4359"
  success-bg: "#EDFFF4"
  success: "#0D7A3C"
  reward-green: "#34D981"
  warning-bg: "#FFF8E1"
  warning: "#A24A00"
  danger-bg: "#FFF0F2"
  danger: "#B60413"
typography:
  display:
    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "34px"
    fontWeight: 590
    lineHeight: 1.08
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "28px"
    fontWeight: 590
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  title:
    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 590
    lineHeight: 1.2
    letterSpacing: "-0.04em"
  body:
    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: "24px"
    letterSpacing: "-0.02em"
  label:
    fontFamily: "SF Pro Display, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 590
    lineHeight: "18px"
    letterSpacing: "-0.02em"
rounded:
  xs: "8px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  pill: "500px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  xxl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary-purple}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "14px 20px"
  button-secondary:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.primary-purple}"
    rounded: "{rounded.lg}"
    padding: "14px 20px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    rounded: "{rounded.xl}"
    padding: "20px"
  chip-selected:
    backgroundColor: "{colors.lavender-bg}"
    textColor: "{colors.primary-purple}"
    rounded: "{rounded.pill}"
    padding: "8px 12px"
---

# Design System: Moodeng Credit

## 1. Overview

**Creative North Star: "Soft Credit Control"**

Moodeng Credit should feel like a mobile fintech tool that is soft enough for first-time borrowers and structured enough for real money workflows. The visual system uses lavender-tinted surfaces, white cards, deep navy-purple headings, and clear state colors. The mascot can add warmth in onboarding, auth, rewards, and empty states, but it should not compete with payment amounts, due dates, verification, or account status.

The system rejects crypto terminal styling, poverty-story interfaces, heavy dark client-facing screens, generic SaaS gradients, and vague decorative cards. Product screens should always make the next action clear.

**Key Characteristics:**

- Mobile-first layouts with generous readable spacing.
- Deep navy-purple type on lavender-tinted backgrounds.
- Purple primary actions used for decisive actions only.
- Green, yellow, and red used for real state meaning, never decoration alone.
- Mascot and reward art used as supporting context, not as the main affordance.

## 2. Colors

The palette is a soft lavender fintech palette with one strong purple action color and a small set of functional state colors.

### Primary

- **Moodeng Purple** (#6010D2): Main CTA color for actions like save, continue, verify, send, and view.
- **Lavender Accent** (#8336F0): Icons, focus accents, milestone graphics, and selected navigation.
- **Deep Purple Ink** (#040033): Headings and critical foreground text.

### Secondary

- **Reward Green** (#34D981): Trust reward icons, completed milestone artwork, and positive reward previews.
- **Support Blue** (#0076EB): Links and educational actions when a link affordance is appropriate.

### Neutral

- **App Surface** (#FDFCFD): Main cards and page interiors.
- **Soft Lavender Field** (#F8F4FC): Secondary panels, helper boxes, and quiet grouped content.
- **Lavender Border** (#E7D8FF): Card outlines and separators.
- **Muted Text** (#70617F): Supporting body copy.
- **Soft Ink** (#4D4359): Secondary labels and explanatory copy.

### Named Rules

**The Purple Means Action Rule.** Purple should identify tappable primary intent or selected state. Do not use it on every label just because it is on brand.

**The State Color Rule.** Green means completed or verified, yellow means review or caution, red means overdue, blocked, defaulted, or destructive. Pair every state color with text or an icon.

## 3. Typography

**Display Font:** SF Pro Display with Apple system fallbacks  
**Body Font:** SF Pro Display with Apple system fallbacks  
**Label/Mono Font:** Use the same family for product UI labels. Use mono only for code, hashes, or diagnostic admin data.

**Character:** The type should feel native to mobile, compact, and highly readable. It should not become shouty through unnecessary bold weight.

### Hierarchy

- **Display** (590, 34px, 1.08): Auth titles, page titles, and major mobile headers.
- **Headline** (590, 28px, 1.2): Section-leading headings and important dashboard modules.
- **Title** (590, 18px, 1.2): Card titles, row names, and milestone names.
- **Body** (500, 16px, 24px): Main explanatory copy. Keep line length controlled on desktop and avoid paragraph blocks in mobile cards.
- **Label** (590, 12px, 18px): Pills, status badges, card eyebrows, and compact metadata.

### Named Rules

**The Readable First Rule.** If a button, badge, or row title wraps awkwardly, reduce density or change layout before shrinking text below readable mobile sizes.

**The No Fake Emphasis Rule.** Do not make every control bold. Weight should distinguish hierarchy, not decorate all text equally.

## 4. Elevation

Moodeng uses tonal layering first and soft elevation second. Cards normally sit on lavender-tinted page backgrounds with subtle borders. Shadows are reserved for bottom navigation, sheets, auth panels, and elements that must clearly float above the page.

### Shadow Vocabulary

- **Card Shadow** (`0px 2px 4px rgba(27, 28, 29, 0.04)`): Quiet card lift when border alone is not enough.
- **Navigation Shadow** (`0px 4px 40.8px rgba(0, 0, 0, 0.08)`): Floating bottom navigation and persistent mobile chrome.
- **Sheet Shadow** (`0 24px 80px rgba(44, 19, 82, 0.18)`): Bottom sheets and important overlays.

### Named Rules

**The Flat Until Needed Rule.** Financial content should be flat and stable. Use elevation only to clarify overlays, navigation, or focus.

## 5. Components

### Buttons

- **Shape:** Rounded rectangles with 14px to 16px radii for primary actions.
- **Primary:** Moodeng Purple background, white text, 14px to 20px horizontal padding, strong readable label.
- **Hover / Focus:** Keep hover subtle. Focus must be visible and not only color-based.
- **Secondary:** Lavender-tinted background or white outline with purple text. Use for alternate navigation or support actions.
- **Destructive:** Red background or red text only for explicit destructive work like delete request or ban.

### Chips

- **Style:** Compact pill selectors with lavender fill, purple text, and clear selected state.
- **State:** Selected chips need a visible check or border. Unselected chips should stay quiet and not compete with CTAs.

### Cards / Containers

- **Corner Style:** 16px to 20px for major mobile cards, 8px to 12px for tight repeated rows.
- **Background:** White or soft lavender fields on lavender page backgrounds.
- **Shadow Strategy:** Prefer border and tonal separation. Use shadow only when a card must float.
- **Border:** Lavender border for product cards, state-tinted border only for real alert states.
- **Internal Padding:** 16px to 24px depending on density. Admin screens may be denser than borrower screens.

### Inputs / Fields

- **Style:** White or near-white background, 12px to 16px radius, lavender-gray border, deep ink text.
- **Focus:** Purple focus ring or border. Focus should be obvious on mobile.
- **Error / Disabled:** Error copy appears close to the field. Disabled buttons must look disabled but still explain why the action is unavailable when context is not obvious.

### Navigation

- **Mobile:** Bottom navigation is rounded, floating, and obvious. Current tab uses purple.
- **Header:** Avatar and username should be tappable when they lead to account settings. Back buttons should be stable and visible.
- **Public routes:** Signed-out help, FAQ, and tour content must remain reachable without login.

### Milestones and Rewards

Milestone rows must keep the Figma-like compact row structure: icon, text block, status/action button. Reward sections can add small visual previews, such as silver or gold avatar rings, but should not change the main milestone list structure unless explicitly requested.

## 6. Do's and Don'ts

### Do:

- **Do** keep borrower and lender screens mobile-first with readable tap targets.
- **Do** use Moodeng Purple for primary actions and selected states.
- **Do** show Trust Points as borrower milestone progress and IOU Points as lender contribution.
- **Do** show concrete reward previews when a reward is visual, such as avatar rings.
- **Do** keep borrower context practical and non-personal.
- **Do** pair state color with text or icon meaning.

### Don't:

- **Don't** make client-facing financial screens heavy dark mode unless explicitly requested for that surface.
- **Don't** use neon crypto styling, glassmorphism, generic SaaS gradient blobs, or decorative orbs.
- **Don't** ask borrowers for employer names, addresses, phone numbers, social handles, exact salary, workplace proof, video proof, or personal contacts.
- **Don't** call borrowers safe, approved, low risk, worthy, deserving, guaranteed, or likely to repay.
- **Don't** change the Reputation Milestones row structure casually. It was tuned against Figma and should be treated as a stable component.
- **Don't** hide primary actions below oversized decoration.
