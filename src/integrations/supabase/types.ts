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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      battle_results: {
        Row: {
          battle_id: string
          claim: Database["public"]["Enums"]["result_claim"]
          created_at: string
          id: string
          screenshot_url: string | null
          user_id: string
        }
        Insert: {
          battle_id: string
          claim: Database["public"]["Enums"]["result_claim"]
          created_at?: string
          id?: string
          screenshot_url?: string | null
          user_id: string
        }
        Update: {
          battle_id?: string
          claim?: Database["public"]["Enums"]["result_claim"]
          created_at?: string
          id?: string
          screenshot_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "battle_results_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      battles: {
        Row: {
          amount: number
          created_at: string
          creator_id: string
          game: string
          id: string
          open_expires_at: string | null
          opponent_id: string | null
          prize: number
          result_deadline_at: string | null
          result_resolution: string | null
          result_resolved_at: string | null
          room_code: string | null
          settled_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["battle_status"]
          winner_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          creator_id: string
          game: string
          id?: string
          open_expires_at?: string | null
          opponent_id?: string | null
          prize: number
          result_deadline_at?: string | null
          result_resolution?: string | null
          result_resolved_at?: string | null
          room_code?: string | null
          settled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          creator_id?: string
          game?: string
          id?: string
          open_expires_at?: string | null
          opponent_id?: string | null
          prize?: number
          result_deadline_at?: string | null
          result_resolution?: string | null
          result_resolved_at?: string | null
          room_code?: string | null
          settled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_id?: string | null
        }
        Relationships: []
      }
      credit_payment_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          merchant_upi: string
          payment_note: string | null
          processed_at: string | null
          processed_by: string | null
          qr_reference: string | null
          status: string
          user_id: string
          utr: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          merchant_upi: string
          payment_note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          qr_reference?: string | null
          status?: string
          user_id: string
          utr: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          merchant_upi?: string
          payment_note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          qr_reference?: string | null
          status?: string
          user_id?: string
          utr?: string
        }
        Relationships: []
      }
      deposit_requests: {
        Row: {
          amount: number
          created_at: string
          id: string
          processed_at: string | null
          status: Database["public"]["Enums"]["txn_status"]
          user_id: string
          utr: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          user_id: string
          utr?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          user_id?: string
          utr?: string | null
        }
        Relationships: []
      }
      match_complaints: {
        Row: {
          id: string
          battle_id: string
          user_id: string
          concern: string
          proof_url: string | null
          status: string
          admin_note: string | null
          created_at: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          id?: string
          battle_id: string
          user_id?: string
          concern: string
          proof_url?: string | null
          status?: string
          admin_note?: string | null
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          id?: string
          battle_id?: string
          user_id?: string
          concern?: string
          proof_url?: string | null
          status?: string
          admin_note?: string | null
          created_at?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_number: string
          doc_type: string
          doc_url: string | null
          document_back_url: string | null
          document_front_url: string | null
          full_name: string
          id: string
          mobile_number: string | null
          pan_document_url: string | null
          status: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_number: string
          doc_type: string
          doc_url?: string | null
          document_back_url?: string | null
          document_front_url?: string | null
          full_name: string
          id?: string
          mobile_number?: string | null
          pan_document_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_number?: string
          doc_type?: string
          doc_url?: string | null
          document_back_url?: string | null
          document_front_url?: string | null
          full_name?: string
          id?: string
          mobile_number?: string | null
          pan_document_url?: string | null
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id?: string
        }
        Relationships: []
      }
      otp_requests: {
        Row: {
          attempt_count: number
          created_at: string
          expires_at: string
          id: string
          phone: string
          provider: string
          provider_status: string | null
          purpose: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          expires_at?: string
          id?: string
          phone: string
          provider?: string
          provider_status?: string | null
          purpose?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          attempt_count?: number
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          provider?: string
          provider_status?: string | null
          purpose?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          created_at: string
          currency: string
          id: string
          is_active: boolean
          merchant_name: string
          merchant_upi: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          merchant_name?: string
          merchant_upi: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          merchant_name?: string
          merchant_upi?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          battles_lost: number
          battles_won: number
          created_at: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          phone: string
          referral_code: string
          referred_by: string | null
          username: string
        }
        Insert: {
          avatar_url?: string | null
          battles_lost?: number
          battles_won?: number
          created_at?: string
          id: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone: string
          referral_code: string
          referred_by?: string | null
          username: string
        }
        Update: {
          avatar_url?: string | null
          battles_lost?: number
          battles_won?: number
          created_at?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          phone?: string
          referral_code?: string
          referred_by?: string | null
          username?: string
        }
        Relationships: []
      }
      referral_earnings: {
        Row: {
          amount: number
          battle_id: string | null
          created_at: string
          id: string
          referred_id: string
          referrer_id: string
        }
        Insert: {
          amount: number
          battle_id?: string | null
          created_at?: string
          id?: string
          referred_id: string
          referrer_id: string
        }
        Update: {
          amount?: number
          battle_id?: string | null
          created_at?: string
          id?: string
          referred_id?: string
          referrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_earnings_battle_id_fkey"
            columns: ["battle_id"]
            isOneToOne: false
            referencedRelation: "battles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json
          note: string | null
          status: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json
          note?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type: Database["public"]["Enums"]["txn_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json
          note?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          type?: Database["public"]["Enums"]["txn_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      virtual_credit_withdrawals: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          bonus_cash: number
          deposit_cash: number
          updated_at: string
          user_id: string
          winning_cash: number
        }
        Insert: {
          bonus_cash?: number
          deposit_cash?: number
          updated_at?: string
          user_id: string
          winning_cash?: number
        }
        Update: {
          bonus_cash?: number
          deposit_cash?: number
          updated_at?: string
          user_id?: string
          winning_cash?: number
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          account_name: string | null
          account_number: string | null
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          ifsc: string | null
          method: string
          processed_at: string | null
          status: Database["public"]["Enums"]["txn_status"]
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          ifsc?: string | null
          method: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          ifsc?: string | null
          method?: string
          processed_at?: string | null
          status?: Database["public"]["Enums"]["txn_status"]
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_battle: { Args: { p_battle: string }; Returns: undefined }
      admin_adjust_demo_credits: {
        Args: { p_delta: number; p_note?: string; p_user: string }
        Returns: undefined
      }
      admin_approve_virtual_credit_withdrawal: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_complete_virtual_credit_withdrawal: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_metrics: { Args: never; Returns: Json }
      admin_process_deposit: {
        Args: { p_approve: boolean; p_id: string }
        Returns: undefined
      }
      admin_process_kyc: {
        Args: {
          p_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["kyc_status"]
        }
        Returns: undefined
      }
      admin_process_withdrawal: {
        Args: {
          p_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["txn_status"]
        }
        Returns: undefined
      }
      admin_resolve_battle: {
        Args: { p_battle: string; p_winner?: string }
        Returns: undefined
      }
      admin_resolve_demo_battle: {
        Args: { p_battle: string; p_winner: string }
        Returns: undefined
      }
      admin_review_kyc: {
        Args: {
          p_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["kyc_status"]
        }
        Returns: undefined
      }
      cancel_open_battle: { Args: { p_battle: string }; Returns: undefined }
      cancel_virtual_credit_withdrawal: {
        Args: { p_id: string }
        Returns: undefined
      }
      claim_admin: { Args: never; Returns: boolean }
      accept_battle_result: { Args: { p_battle: string }; Returns: string }
      submit_battle_objection: {
        Args: { p_battle: string; p_concern: string; p_proof?: string }
        Returns: string
      }
      create_battle: {
        Args: { p_amount: number; p_game: string }
        Returns: string
      }
      create_deposit_request: {
        Args: { p_amount: number; p_utr: string }
        Returns: string
      }
      expire_open_battles: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      process_expired_battle_results: { Args: never; Returns: number }
      refund_battle: { Args: { _battle: string }; Returns: undefined }
      request_virtual_credit_withdrawal: {
        Args: { p_amount: number }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          p_account?: string
          p_amount: number
          p_ifsc?: string
          p_method: string
          p_name?: string
          p_upi?: string
        }
        Returns: string
      }
      resolve_demo_battle_winner: {
        Args: { p_battle: string; p_reason: string; p_winner: string }
        Returns: undefined
      }
      resolve_expired_battles: { Args: never; Returns: number }
      set_room_code: {
        Args: { p_battle: string; p_code: string }
        Returns: undefined
      }
      settle_battle_win: {
        Args: { _battle: string; _winner: string }
        Returns: undefined
      }
      submit_battle_result: {
        Args: {
          p_battle: string
          p_claim: Database["public"]["Enums"]["result_claim"]
          p_screenshot?: string
        }
        Returns: string
      }
      wallet_credit: {
        Args: { _amount: number; _bucket: string; _user: string }
        Returns: undefined
      }
      wallet_debit: {
        Args: { _amount: number; _user: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      battle_status:
        | "open"
        | "running"
        | "result_pending"
        | "disputed"
        | "completed"
        | "cancelled"
      kyc_status: "not_submitted" | "pending" | "approved" | "rejected"
      result_claim: "won" | "lost" | "cancel"
      txn_status: "pending" | "approved" | "completed" | "rejected"
      txn_type:
        | "deposit"
        | "withdrawal"
        | "bet"
        | "winning"
        | "referral"
        | "bonus"
        | "refund"
        | "penalty"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
      battle_status: [
        "open",
        "running",
        "result_pending",
        "disputed",
        "completed",
        "cancelled",
      ],
      kyc_status: ["not_submitted", "pending", "approved", "rejected"],
      result_claim: ["won", "lost", "cancel"],
      txn_status: ["pending", "approved", "completed", "rejected"],
      txn_type: [
        "deposit",
        "withdrawal",
        "bet",
        "winning",
        "referral",
        "bonus",
        "refund",
        "penalty",
      ],
    },
  },
} as const
