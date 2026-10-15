export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      app_config: {
        Row: {
          created_at: string
          flags: NonNullable<Json>
          id: number
          kill_switches: NonNullable<Json>
          min_version_desktop: string
          min_version_web: string
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          flags?: NonNullable<Json>
          id?: number
          kill_switches?: NonNullable<Json>
          min_version_desktop?: string
          min_version_web?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          flags?: NonNullable<Json>
          id?: number
          kill_switches?: NonNullable<Json>
          min_version_desktop?: string
          min_version_web?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      app_user: {
        Row: {
          allowance: number | null
          analytics_off: boolean
          birth_year: number | null
          created_at: string
          deletion_requested_at: string | null
          employment: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable: boolean
          is_internal_tester: boolean
          monthly_income: number | null
          nickname: string | null
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at: string | null
          onboarding_step: string | null
          payday: number | null
          payday_last: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          side: Database["public"]["Enums"]["couple_side"] | null
          space_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          allowance?: number | null
          analytics_off?: boolean
          birth_year?: number | null
          created_at?: string
          deletion_requested_at?: string | null
          employment?: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable?: boolean
          is_internal_tester?: boolean
          monthly_income?: number | null
          nickname?: string | null
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at?: string | null
          onboarding_step?: string | null
          payday?: number | null
          payday_last?: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          side?: Database["public"]["Enums"]["couple_side"] | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          allowance?: number | null
          analytics_off?: boolean
          birth_year?: number | null
          created_at?: string
          deletion_requested_at?: string | null
          employment?: Database["public"]["Enums"]["employment"] | null
          id?: string
          income_variable?: boolean
          is_internal_tester?: boolean
          monthly_income?: number | null
          nickname?: string | null
          notify_email?: string
          notify_email_source?: Database["public"]["Enums"]["email_source"]
          onboarding_done_at?: string | null
          onboarding_step?: string | null
          payday?: number | null
          payday_last?: boolean
          provider?: Database["public"]["Enums"]["auth_provider"]
          side?: Database["public"]["Enums"]["couple_side"] | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_user_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      consent: {
        Row: {
          agreed: boolean
          created_at: string
          id: number
          kind: Database["public"]["Enums"]["consent_kind"]
          source: Database["public"]["Enums"]["consent_source"]
          terms_version: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          agreed: boolean
          created_at?: string
          id?: never
          kind: Database["public"]["Enums"]["consent_kind"]
          source: Database["public"]["Enums"]["consent_source"]
          terms_version: string
          user_id: string
        }
        Update: {
          agreed?: boolean
          created_at?: string
          id?: never
          kind?: Database["public"]["Enums"]["consent_kind"]
          source?: Database["public"]["Enums"]["consent_source"]
          terms_version?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_space: {
        Row: {
          child_plan: Database["public"]["Enums"]["child_plan"] | null
          couple_state: Database["public"]["Enums"]["couple_state"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          family_support: number | null
          family_support_answer: string | null
          family_support_estimated: boolean
          fixed_total: number | null
          fixed_total_estimated: boolean
          housing: Database["public"]["Enums"]["housing"] | null
          id: string
          living_budget: number | null
          living_budget_estimated: boolean
          loan_repayment: number | null
          marriage_status: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month: string | null
          partner_income: number | null
          partner_income_estimated: boolean
          partner_income_unknown: boolean
          partner_nickname: string | null
          prep_money_mode: Database["public"]["Enums"]["prep_money_mode"] | null
          split_deferred: boolean
          split_mode: Database["public"]["Enums"]["split_mode"] | null
          split_ratio: number | null
          updated_at: string
          updated_by: string | null
          version: number
          wedding_budget: number | null
          wedding_budget_estimated: boolean
          wedding_date: string | null
          wedding_date_estimated: boolean
          wedding_month: string | null
          wedding_saved: number | null
        }
        ComputedFields: never
        Insert: {
          child_plan?: Database["public"]["Enums"]["child_plan"] | null
          couple_state?: Database["public"]["Enums"]["couple_state"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          family_support?: number | null
          family_support_answer?: string | null
          family_support_estimated?: boolean
          fixed_total?: number | null
          fixed_total_estimated?: boolean
          housing?: Database["public"]["Enums"]["housing"] | null
          id?: string
          living_budget?: number | null
          living_budget_estimated?: boolean
          loan_repayment?: number | null
          marriage_status?: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home?: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month?: string | null
          partner_income?: number | null
          partner_income_estimated?: boolean
          partner_income_unknown?: boolean
          partner_nickname?: string | null
          prep_money_mode?: Database["public"]["Enums"]["prep_money_mode"] | null
          split_deferred?: boolean
          split_mode?: Database["public"]["Enums"]["split_mode"] | null
          split_ratio?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          wedding_budget?: number | null
          wedding_budget_estimated?: boolean
          wedding_date?: string | null
          wedding_date_estimated?: boolean
          wedding_month?: string | null
          wedding_saved?: number | null
        }
        Update: {
          child_plan?: Database["public"]["Enums"]["child_plan"] | null
          couple_state?: Database["public"]["Enums"]["couple_state"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          family_support?: number | null
          family_support_answer?: string | null
          family_support_estimated?: boolean
          fixed_total?: number | null
          fixed_total_estimated?: boolean
          housing?: Database["public"]["Enums"]["housing"] | null
          id?: string
          living_budget?: number | null
          living_budget_estimated?: boolean
          loan_repayment?: number | null
          marriage_status?: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home?: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month?: string | null
          partner_income?: number | null
          partner_income_estimated?: boolean
          partner_income_unknown?: boolean
          partner_nickname?: string | null
          prep_money_mode?: Database["public"]["Enums"]["prep_money_mode"] | null
          split_deferred?: boolean
          split_mode?: Database["public"]["Enums"]["split_mode"] | null
          split_ratio?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
          wedding_budget?: number | null
          wedding_budget_estimated?: boolean
          wedding_date?: string | null
          wedding_date_estimated?: boolean
          wedding_month?: string | null
          wedding_saved?: number | null
        }
        Relationships: []
      }
      fixed_expense: {
        Row: {
          burden: Database["public"]["Enums"]["expense_burden"]
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          group_key: string
          id: string
          monthly_amount: number | null
          name: string
          sort: number
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          burden?: Database["public"]["Enums"]["expense_burden"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_key: string
          id?: string
          monthly_amount?: number | null
          name: string
          sort?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          burden?: Database["public"]["Enums"]["expense_burden"]
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          group_key?: string
          id?: string
          monthly_amount?: number | null
          name?: string
          sort?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expense_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      goal: {
        Row: {
          after_marriage: boolean
          amount_estimated: boolean
          created_at: string
          created_by: string | null
          deadline: string | null
          deadline_estimated: boolean
          deleted_at: string | null
          deleted_by: string | null
          details: NonNullable<Json>
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held: number
          owner: Database["public"]["Enums"]["goal_owner"]
          priority: number
          space_id: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          template: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          after_marriage?: boolean
          amount_estimated?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_estimated?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          details?: NonNullable<Json>
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          priority: number
          space_id: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          template: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          after_marriage?: boolean
          amount_estimated?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_estimated?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          details?: NonNullable<Json>
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          priority?: number
          space_id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          template?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      invite: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          space_id: string
          used_at: string | null
          used_by: string | null
        }
        ComputedFields: never
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          space_id: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          space_id?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_signup: {
        Args: {
          p_marketing: boolean
          p_notify_email: string
          p_provider: Database["public"]["Enums"]["auth_provider"]
          p_terms_version: string
        }
        Returns: {
          allowance: number | null
          analytics_off: boolean
          birth_year: number | null
          created_at: string
          deletion_requested_at: string | null
          employment: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable: boolean
          is_internal_tester: boolean
          monthly_income: number | null
          nickname: string | null
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at: string | null
          onboarding_step: string | null
          payday: number | null
          payday_last: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          side: Database["public"]["Enums"]["couple_side"] | null
          space_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "app_user"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_invite: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      delete_minor_account: {
        Args: { p_birth_year: number }
        Returns: undefined
      }
      ensure_my_space: { Args: Record<PropertyKey, never>; Returns: string }
      is_space_member: { Args: { p_space_id: string }; Returns: boolean }
      login_state: {
        Args: { p_provider?: Database["public"]["Enums"]["auth_provider"] }
        Returns: Json
      }
    }
    Enums: {
      account_status: "active" | "deletion_requested" | "deleted"
      auth_provider: "kakao" | "google" | "apple"
      child_plan: "within_1y" | "in_1_3y" | "after_3y" | "none" | "unsure"
      consent_kind:
        | "terms"
        | "privacy"
        | "space_sharing"
        | "family_info"
        | "photo"
        | "marketing"
        | "analytics"
        | "peer_stats"
      consent_source:
        "signup" | "prefill_review" | "care_day_first" | "settings" | "peer_stats_page"
      couple_side: "groom" | "bride"
      couple_state: "not_joined" | "connected" | "unlink_pending" | "solo"
      email_source: "provider" | "manual"
      employment: "regular" | "contract" | "freelance" | "resting"
      expense_burden: "shared" | "personal"
      goal_kind: "once" | "yearly" | "monthly"
      goal_owner: "together" | "me" | "partner"
      goal_status: "active" | "delayed" | "achieved" | "used" | "paused" | "wrapping_up"
      housing: "jeonse" | "monthly_rent" | "own" | "parents" | "none"
      marriage_status: "married" | "engaged"
      newlywed_home: "have" | "before" | "after" | "parents"
      prep_money_mode: "separate" | "together"
      split_mode: "half" | "income" | "custom"
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
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
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
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
      account_status: ["active", "deletion_requested", "deleted"],
      auth_provider: ["kakao", "google", "apple"],
      child_plan: ["within_1y", "in_1_3y", "after_3y", "none", "unsure"],
      consent_kind: [
        "terms",
        "privacy",
        "space_sharing",
        "family_info",
        "photo",
        "marketing",
        "analytics",
        "peer_stats",
      ],
      consent_source: ["signup", "prefill_review", "care_day_first", "settings", "peer_stats_page"],
      couple_side: ["groom", "bride"],
      couple_state: ["not_joined", "connected", "unlink_pending", "solo"],
      email_source: ["provider", "manual"],
      employment: ["regular", "contract", "freelance", "resting"],
      expense_burden: ["shared", "personal"],
      goal_kind: ["once", "yearly", "monthly"],
      goal_owner: ["together", "me", "partner"],
      goal_status: ["active", "delayed", "achieved", "used", "paused", "wrapping_up"],
      housing: ["jeonse", "monthly_rent", "own", "parents", "none"],
      marriage_status: ["married", "engaged"],
      newlywed_home: ["have", "before", "after", "parents"],
      prep_money_mode: ["separate", "together"],
      split_mode: ["half", "income", "custom"],
    },
  },
} as const
