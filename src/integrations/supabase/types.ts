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
          opponent_id: string | null
          prize: number
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
          opponent_id?: string | null
          prize: number
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
          opponent_id?: string | null
          prize?: number
          room_code?: string | null
          settled_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["battle_status"]
          winner_id?: string | null
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
      kyc_submissions: {
        Row: {
          admin_note: string | null
          created_at: string
          doc_number: string
          doc_type: string
          doc_url: string | null
          full_name: string
          id: string
          status: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          doc_number: string
          doc_type: string
          doc_url?: string | null
          full_name: string
          id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          doc_number?: string
          doc_type?: string
          doc_url?: string | null
          full_name?: string
          id?: string
          status?: Database["public"]["Enums"]["kyc_status"]
          user_id?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
