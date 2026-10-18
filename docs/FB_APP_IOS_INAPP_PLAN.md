# iPhone: the Facebook app's browser (not Messenger's)

Status: 2026-10-19 (Bangkok). This PR = steps 1–3. Messenger's browser is untouched.

## Can we tell them apart? Yes.

Both say `FBAN/FBIOS`, so `detectInAppBrowser` calls both "Facebook". But 30 days of PostHog
pageviews split cleanly:

| | Facebook app | Messenger |
|---|---|---|
| Marker | `FBOP/5`; current versions also `Safari/604.1` + `IABMV/1` | `FBOP/80`, no `Safari/` |
| Arrives from | facebook.com, with `?fbclid` (posts, ads) | direct (links in our chat, the bot's `/continue`) |
| Seen | George 10-18 06:18 UTC, userbuds 10-14 | Emma 10-16/17, George 10-18 06:10 UTC |

`metaIosHost()` in `src/lib/inAppBrowser.ts` returns `'facebook' | 'messenger' | null`. Unknown
formats return `null` and keep today's behaviour, so a future Facebook update can't break
Messenger.

## What works in Messenger, what breaks in the Facebook app

The same card ran in both (George, 10-18, PostHog):

| Step | Messenger | Facebook app |
|---|---|---|
| Copy code (`execCommand`) | ✅ | ✅ (11/11) |
| Open our chat (`fb-messenger://`, auto or tapped) | ✅ left for Messenger in 1 s | ❌ ignored: auto-open ignored, then 7× `not_opened` |
| m.me link with the code | ❌ (already inside Messenger) | ❌ userbuds, 10-14 |
| Bot reply + `/continue` link | ✅ | n/a (never got to Messenger) |
| WhatsApp reminders (tapped wa.me) | ✅ | not tried yet |
| First screen "open in Safari" | ✅ | ✅ shown on the home page, George chose "Continue here" |
| "Or open in Safari" steps | ✅ (screenshot of Messenger's menu) | shown, but it pictured **Messenger's** menu |

Nothing on the page can open Messenger from the Facebook app. Copying works, and Facebook keeps
our page alive while you switch apps, so the reliable route is to copy, switch apps yourself,
paste, and come back.

## This PR (Facebook app on iPhone only)

1. **Detection:** `metaIosHost()` plus unit tests with the real browser IDs.
2. **Messenger card (looks like Messenger's):** the same code card and big blue button
   (**Copy code**), the same "📋 Code copied: paste it in our chat, then Send" card, the same
   step hippos. Where Messenger's button opens our chat, this one opens a picture guide on its own
   (`MessengerSwitchGuide`, same style as the Safari guide, with the tapping finger): open your
   Messenger app → search Moodeng Credit → paste and Send → come back to Facebook. "How to open
   Messenger" reopens it. The Copy tap stamps `mark_messenger_chat_opened`. "Or open in Safari"
   stays (m.me with the code works there).
3. **Safari steps:** the Facebook app gets a drawn menu in the same dark, faded style as the
   Messenger screenshot, with "Open in external browser" ringed, and "Facebook" under the address.
4. **Tracking:** `contact_verify_started` gets `ios_host`, and the new card's events carry
   `ios_host: 'facebook'`, so we can compare the two apps.

## Still to check on a real iPhone (George / Emma)

- Facebook app: is the ⋯ really top right, and is the item called "Open in external browser"?
  Send a screenshot of the menu and we'll swap it in like the Messenger one.
- Facebook app: after you paste in Messenger and swipe back, does the card turn green? (The
  realtime/poll/visibility re-check is the same code that works in Messenger.)
- Facebook app: WhatsApp reminders (tapped `wa.me`). If it does nothing, it needs the same
  copy-and-switch treatment.
- Later: `public/landing/open-in-browser.js` (static home page) draws its own menu guide and
  isn't changed here.
