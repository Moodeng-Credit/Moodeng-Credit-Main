// George rejects borrowers whose Facebook picture is the grey default. The auto-check
// (facebookProfileCheck.ts) can't read pictures yet: our Page token has no pages_messaging, and
// SendPulse stores no avatar. So the call cards tell whoever reads them to look by eye.
// A link straight to one person's thread doesn't work (Business Suite errors on selected_item_id),
// so the line names who to search for in the Page inbox.

export const photoCheckLine = (facebookName?: string | null): string => {
   const name = facebookName?.trim().replace(/"/g, '');
   return `📷 Check their Facebook photo in the Page inbox${name ? ` (search "${name}")` : ''}. Grey default picture = reject.`;
};
