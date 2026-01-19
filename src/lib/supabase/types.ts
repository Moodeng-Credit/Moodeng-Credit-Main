export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      loan_notifications: {
        Row: {
          email_sent_at: string | null
          id: string
          loan_id: string
          notification_type: Database["public"]["Enums"]["loan_notification_type"]
          user_id: string
        }
        Insert: {
          email_sent_at?: string | null
          id?: string
          loan_id: string
          notification_type: Database["public"]["Enums"]["loan_notification_type"]
          user_id: string
        }
        Update: {
          email_sent_at?: string | null
          id?: string
          loan_id?: string
          notification_type?: Database["public"]["Enums"]["loan_notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_notifications_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          borrower_user_id: string | null
          borrower_wallet: string | null
          coin: string
          created_at: string | null
          due_date: string
          funded_at: string | null
          hash: string[] | null
          id: string
          lender_user_id: string | null
          lender_wallet: string | null
          loan_amount: number
          loan_status: Database["public"]["Enums"]["loan_status"] | null
          reason: string
          repaid_amount: number | null
          repayment_status:
            | Database["public"]["Enums"]["repayment_status"]
            | null
          total_repayment_amount: number
          tracking_id: string
          updated_at: string | null
        }
        Insert: {
          borrower_user_id?: string | null
          borrower_wallet?: string | null
          coin: string
          created_at?: string | null
          due_date: string
          funded_at?: string | null
          hash?: string[] | null
          id?: string
          lender_user_id?: string | null
          lender_wallet?: string | null
          loan_amount: number
          loan_status?: Database["public"]["Enums"]["loan_status"] | null
          reason: string
          repaid_amount?: number | null
          repayment_status?:
            | Database["public"]["Enums"]["repayment_status"]
            | null
          total_repayment_amount: number
          tracking_id: string
          updated_at?: string | null
        }
        Update: {
          borrower_user_id?: string | null
          borrower_wallet?: string | null
          coin?: string
          created_at?: string | null
          due_date?: string
          funded_at?: string | null
          hash?: string[] | null
          id?: string
          lender_user_id?: string | null
          lender_wallet?: string | null
          loan_amount?: number
          loan_status?: Database["public"]["Enums"]["loan_status"] | null
          reason?: string
          repaid_amount?: number | null
          repayment_status?:
            | Database["public"]["Enums"]["repayment_status"]
            | null
          total_repayment_amount?: number
          tracking_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_borrower_user_id_fkey"
            columns: ["borrower_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_lender_user_id_fkey"
            columns: ["lender_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          chat_id: number | null
          created_at: string | null
          credit_progression_paused: boolean | null
          cs: number | null
          email: string
          google_id: string | null
          id: string
          is_world_id: Database["public"]["Enums"]["world_id_status"] | null
          mal: number | null
          nal: number | null
          nullifier_hash: string | null
          reset_token: string | null
          reset_token_expiry: string | null
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string | null
          username: string
          wallet_address: string | null
        }
        Insert: {
          chat_id?: number | null
          created_at?: string | null
          credit_progression_paused?: boolean | null
          cs?: number | null
          email: string
          google_id?: string | null
          id: string
          is_world_id?: Database["public"]["Enums"]["world_id_status"] | null
          mal?: number | null
          nal?: number | null
          nullifier_hash?: string | null
          reset_token?: string | null
          reset_token_expiry?: string | null
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
          username: string
          wallet_address?: string | null
        }
        Update: {
          chat_id?: number | null
          created_at?: string | null
          credit_progression_paused?: boolean | null
          cs?: number | null
          email?: string
          google_id?: string | null
          id?: string
          is_world_id?: Database["public"]["Enums"]["world_id_status"] | null
          mal?: number | null
          nal?: number | null
          nullifier_hash?: string | null
          reset_token?: string | null
          reset_token_expiry?: string | null
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
          username?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ensure_email_identity: {
        Args: { email_input: string; user_id_input: string }
        Returns: undefined
      }
    }
    Enums: {
      loan_notification_type:
        | "funded"
        | "urgent_reminder"
        | "final_reminder"
        | "weekly_digest"
      loan_status: "Requested" | "Lent"
      repayment_status: "Unpaid" | "Partial" | "Paid"
      world_id_status: "INACTIVE" | "ACTIVE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      loan_notification_type: [
        "funded",
        "urgent_reminder",
        "final_reminder",
        "weekly_digest",
      ],
      loan_status: ["Requested", "Lent"],
      repayment_status: ["Unpaid", "Partial", "Paid"],
      world_id_status: ["INACTIVE", "ACTIVE"],
    },
  },
} as const
