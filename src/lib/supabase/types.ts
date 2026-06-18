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
      loan_request_delete_events: {
        Row: {
          borrower_user_id: string
          deleted_at: string
          id: string
          loan_id: string
        }
        Insert: {
          borrower_user_id: string
          deleted_at?: string
          id?: string
          loan_id: string
        }
        Update: {
          borrower_user_id?: string
          deleted_at?: string
          id?: string
          loan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_request_delete_events_borrower_user_id_fkey"
            columns: ["borrower_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
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
          referral_boost_amount: number | null
          referral_code: string | null
          referral_code_id: string | null
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
          referral_boost_amount?: number | null
          referral_code?: string | null
          referral_code_id?: string | null
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
          referral_boost_amount?: number | null
          referral_code?: string | null
          referral_code_id?: string | null
          total_repayment_amount?: number
          tracking_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
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
      referral_codes: {
        Row: {
          boost_amount: number
          code: string
          created_at: string
          current_uses: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          updated_at: string
        }
        Insert: {
          boost_amount?: number
          code: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
        }
        Update: {
          boost_amount?: number
          code?: string
          created_at?: string
          current_uses?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      point_events: {
        Row: {
          created_at: string
          delta: number
          event_type: string
          id: number
          metadata: Json
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          event_type: string
          id?: number
          metadata?: Json
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          event_type?: string
          id?: number
          metadata?: Json
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_points: {
        Row: {
          last_event_id: number | null
          points_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_event_id?: number | null
          points_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_event_id?: number | null
          points_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_point_events: {
        Row: {
          created_at: string
          delta: number
          event_type: string
          id: number
          metadata: Json
          source_id: string
          source_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delta: number
          event_type: string
          id?: number
          metadata?: Json
          source_id: string
          source_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          delta?: number
          event_type?: string
          id?: number
          metadata?: Json
          source_id?: string
          source_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_point_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_trust_points: {
        Row: {
          last_event_id: number | null
          points_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          last_event_id?: number | null
          points_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          last_event_id?: number | null
          points_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_trust_points_last_event_id_fkey"
            columns: ["last_event_id"]
            isOneToOne: false
            referencedRelation: "trust_point_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_trust_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_definitions: {
        Row: {
          action_label: string | null
          action_path: string | null
          benefit: string | null
          borrower_stage: string
          category: string
          created_at: string
          description: string
          id: string
          is_active: boolean
          outcome: string | null
          point_source_id: string
          points_awarded: number
          reward_label: string | null
          rule_metadata: Json
          title: string
          updated_at: string
        }
        Insert: {
          action_label?: string | null
          action_path?: string | null
          benefit?: string | null
          borrower_stage?: string
          category?: string
          created_at?: string
          description: string
          id: string
          is_active?: boolean
          outcome?: string | null
          point_source_id: string
          points_awarded: number
          reward_label?: string | null
          rule_metadata?: Json
          title: string
          updated_at?: string
        }
        Update: {
          action_label?: string | null
          action_path?: string | null
          benefit?: string | null
          borrower_stage?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          outcome?: string | null
          point_source_id?: string
          points_awarded?: number
          reward_label?: string | null
          rule_metadata?: Json
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_milestone_completions: {
        Row: {
          completed_at: string
          id: string
          metadata: Json
          milestone_id: string
          point_event_id: number | null
          source_id: string
          source_type: string
          trust_point_event_id: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          metadata?: Json
          milestone_id: string
          point_event_id?: number | null
          source_id: string
          source_type?: string
          trust_point_event_id?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          metadata?: Json
          milestone_id?: string
          point_event_id?: number | null
          source_id?: string
          source_type?: string
          trust_point_event_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestone_completions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestone_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestone_completions_point_event_id_fkey"
            columns: ["point_event_id"]
            isOneToOne: false
            referencedRelation: "point_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestone_completions_trust_point_event_id_fkey"
            columns: ["trust_point_event_id"]
            isOneToOne: false
            referencedRelation: "trust_point_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_milestone_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_definitions: {
        Row: {
          created_at: string
          description: string
          id: string
          is_active: boolean
          metadata: Json
          required_points_total: number
          reward_type: string
          title: string
        }
        Insert: {
          created_at?: string
          description: string
          id: string
          is_active?: boolean
          metadata?: Json
          required_points_total: number
          reward_type: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          required_points_total?: number
          reward_type?: string
          title?: string
        }
        Relationships: []
      }
      user_rewards: {
        Row: {
          id: string
          metadata: Json
          reward_id: string
          source_id: string | null
          source_type: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          metadata?: Json
          reward_id: string
          source_id?: string | null
          source_type?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          metadata?: Json
          reward_id?: string
          source_id?: string | null
          source_type?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "reward_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_rewards_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_reward_preferences: {
        Row: {
          selected_avatar_ring_reward_id: string | null
          selected_profile_badge_reward_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          selected_avatar_ring_reward_id?: string | null
          selected_profile_badge_reward_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          selected_avatar_ring_reward_id?: string | null
          selected_profile_badge_reward_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reward_preferences_selected_avatar_ring_reward_id_fkey"
            columns: ["selected_avatar_ring_reward_id"]
            isOneToOne: false
            referencedRelation: "reward_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reward_preferences_selected_profile_badge_reward_id_fkey"
            columns: ["selected_profile_badge_reward_id"]
            isOneToOne: false
            referencedRelation: "reward_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_reward_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      guided_tour_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          shown_count: number | null
          tour_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          shown_count?: number | null
          tour_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          shown_count?: number | null
          tour_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guided_tour_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_payout_methods: {
        Row: {
          address: string
          confirmed_at: string
          created_at: string
          exchange: string
          id: string
          is_active: boolean
          network: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address: string
          confirmed_at?: string
          created_at?: string
          exchange: string
          id?: string
          is_active?: boolean
          network?: string
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string
          confirmed_at?: string
          created_at?: string
          exchange?: string
          id?: string
          is_active?: boolean
          network?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_payout_methods_user_id_fkey"
            columns: ["user_id"]
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
          display_name: string | null
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
          redeemed_referral_code_id: string | null
          referral_boost_amount: number | null
          telegram_id: number | null
          telegram_username: string | null
          updated_at: string | null
          user_role: "borrower" | "lender" | null
          username: string
          wallet_address: string | null
          wallet_chain_id: number | null
          wallet_connected_at: string | null
          wallet_connector_name: string | null
          wallet_provider: string | null
        }
        Insert: {
          chat_id?: number | null
          created_at?: string | null
          credit_progression_paused?: boolean | null
          display_name?: string | null
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
          redeemed_referral_code_id?: string | null
          referral_boost_amount?: number | null
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
          user_role?: "borrower" | "lender" | null
          username: string
          wallet_address?: string | null
          wallet_chain_id?: number | null
          wallet_connected_at?: string | null
          wallet_connector_name?: string | null
          wallet_provider?: string | null
        }
        Update: {
          chat_id?: number | null
          created_at?: string | null
          credit_progression_paused?: boolean | null
          display_name?: string | null
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
          redeemed_referral_code_id?: string | null
          referral_boost_amount?: number | null
          telegram_id?: number | null
          telegram_username?: string | null
          updated_at?: string | null
          user_role?: "borrower" | "lender" | null
          username?: string
          wallet_address?: string | null
          wallet_chain_id?: number | null
          wallet_connected_at?: string | null
          wallet_connector_name?: string | null
          wallet_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_redeemed_referral_code_id_fkey"
            columns: ["redeemed_referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_points: {
        Args: {
          delta_input: number
          event_type_input: string
          metadata_input?: Json
          source_id_input: string
          source_type_input: string
          user_id_input: string
        }
        Returns: {
          applied: boolean
          event_id: number | null
          points_total: number
        }[]
      }
      can_create_loan_request: {
        Args: { p_borrower_user_id: string }
        Returns: boolean
      }
      get_loan_request_repost_status: {
        Args: Record<PropertyKey, never>
        Returns: {
          can_create: boolean
          cooldown_until: string | null
          delete_count_24h: number
        }[]
      }
      record_milestone_completion: {
        Args: {
          metadata_input?: Json
          milestone_id_input: string
          user_id_input: string
        }
        Returns: {
          applied: boolean
          milestone_id: string
          points_total: number
        }[]
      }
      sync_user_rewards: {
        Args: { user_id_input: string }
        Returns: {
          reward_id: string
          unlocked_at: string
        }[]
      }
      ensure_email_identity: {
        Args: { email_input: string; user_id_input: string }
        Returns: undefined
      }
      redeem_referral_code: {
        Args: { code_input: string }
        Returns: {
          already_redeemed: boolean
          boost_amount: number
          code: string
          id: string
          new_limit: number
          previous_limit: number
        }[]
      }
    }
    Enums: {
      loan_notification_type:
        | "funded"
        | "urgent_reminder"
        | "final_reminder"
        | "overdue"
        | "weekly_digest"
        | "repayment_received"
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
        "overdue",
        "weekly_digest",
        "repayment_received",
      ],
      loan_status: ["Requested", "Lent"],
      repayment_status: ["Unpaid", "Partial", "Paid"],
      world_id_status: ["INACTIVE", "ACTIVE"],
    },
  },
} as const
