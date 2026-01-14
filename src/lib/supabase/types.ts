/**
 * Supabase Database Types
 *
 * These types are based on the database schema defined in the migration plan.
 * For auto-generated types, run: npx supabase gen types typescript --project-id <your-project-id>
 */

export type WorldIdStatus = 'INACTIVE' | 'ACTIVE';
export type LoanStatus = 'Requested' | 'Lent';
export type RepaymentStatus = 'Unpaid' | 'Partial' | 'Paid';

export interface Database {
   public: {
      Tables: {
         users: {
            Row: {
               id: string;
               wallet_address: string | null;
               username: string;
               email: string;
               google_id: string | null;
               telegram_id: number | null;
               telegram_username: string | null;
               chat_id: number | null;
               is_world_id: WorldIdStatus;
               nullifier_hash: string | null;
               mal: number; // max active loans
               nal: number; // number active loans
               cs: number; // credit score
               reset_token: string | null;
               reset_token_expiry: string | null;
               created_at: string;
               updated_at: string;
            };
            Insert: {
               id?: string;
               wallet_address?: string | null;
               username: string;
               email: string;
               google_id?: string | null;
               telegram_id?: number | null;
               telegram_username?: string | null;
               chat_id?: number | null;
               is_world_id?: WorldIdStatus;
               nullifier_hash?: string | null;
               mal?: number;
               nal?: number;
               cs?: number;
               reset_token?: string | null;
               reset_token_expiry?: string | null;
               created_at?: string;
               updated_at?: string;
            };
            Update: {
               id?: string;
               wallet_address?: string | null;
               username?: string;
               email?: string;
               google_id?: string | null;
               telegram_id?: number | null;
               telegram_username?: string | null;
               chat_id?: number | null;
               is_world_id?: WorldIdStatus;
               nullifier_hash?: string | null;
               mal?: number;
               nal?: number;
               cs?: number;
               reset_token?: string | null;
               reset_token_expiry?: string | null;
               updated_at?: string;
            };
         };
         loans: {
            Row: {
               id: string;
               tracking_id: string;
               borrower_wallet: string | null;
               lender_wallet: string | null;
               borrower_user: string | null;
               lender_user: string | null;
               loan_amount: number;
               repaid_amount: number;
               total_repayment_amount: number;
               reason: string;
               loan_status: LoanStatus;
               repayment_status: RepaymentStatus;
               due_date: string;
               coin: string;
               hash: string[];
               created_at: string;
               updated_at: string;
               funded_at: string | null;
            };
            Insert: {
               id?: string;
               tracking_id: string;
               borrower_wallet?: string | null;
               lender_wallet?: string | null;
               borrower_user?: string | null;
               lender_user?: string | null;
               loan_amount: number;
               repaid_amount?: number;
               total_repayment_amount: number;
               reason: string;
               loan_status?: LoanStatus;
               repayment_status?: RepaymentStatus;
               due_date: string;
               coin: string;
               hash?: string[];
               created_at?: string;
               updated_at?: string;
               funded_at?: string | null;
            };
            Update: {
               id?: string;
               tracking_id?: string;
               borrower_wallet?: string | null;
               lender_wallet?: string | null;
               borrower_user?: string | null;
               lender_user?: string | null;
               loan_amount?: number;
               repaid_amount?: number;
               total_repayment_amount?: number;
               reason?: string;
               loan_status?: LoanStatus;
               repayment_status?: RepaymentStatus;
               due_date?: string;
               coin?: string;
               hash?: string[];
               updated_at?: string;
               funded_at?: string | null;
            };
         };
      };
      Views: Record<string, never>;
      Functions: Record<string, never>;
      Enums: {
         world_id_status: WorldIdStatus;
         loan_status: LoanStatus;
         repayment_status: RepaymentStatus;
      };
   };
}

// Helper types for easier usage
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type Loan = Database['public']['Tables']['loans']['Row'];
export type LoanInsert = Database['public']['Tables']['loans']['Insert'];
export type LoanUpdate = Database['public']['Tables']['loans']['Update'];
