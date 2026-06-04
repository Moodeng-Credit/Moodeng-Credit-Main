export const SUPPORT_CONTACTS_EVENT = 'moodeng:open-support-contacts';

export type SupportContactIssue = 'general' | 'loan_request_expired' | 'world_id_verification';

export type SupportContactsEventDetail = {
   issue?: SupportContactIssue;
};

export function openSupportContacts(issue: SupportContactIssue = 'general') {
   window.dispatchEvent(new CustomEvent<SupportContactsEventDetail>(SUPPORT_CONTACTS_EVENT, { detail: { issue } }));
}
