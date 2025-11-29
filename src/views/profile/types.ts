export enum ProfileTab {
   DASHBOARD = 'Dashboard',
   LOAN_SUMMARY = 'Loan Summary',
   TRANSACTION_HISTORY = 'Transaction History',
   SETTINGS = 'Settings',
   FAQ = 'FAQ',
   SUPPORT = 'Support'
}

export enum UserRole {
   BORROWER = 'borrower',
   LENDER = 'lender'
}

export interface NavItem {
   label: ProfileTab;
   icon: string;
   active: boolean;
}

export interface ProfileFormData {
   username: string;
   email: string;
   telegramUsername: string;
   password: string;
}
