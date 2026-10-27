export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      access_request: {
        Row: {
          admin_id: string | null
          answered_at: string | null
          created_at: string
          ended_at: string | null
          expires_at: string | null
          id: string
          inquiry_id: string
          partner_notified_at: string | null
          raw_amount: boolean
          reason: string | null
          scope: string[]
          status: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          admin_id?: string | null
          answered_at?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          id?: string
          inquiry_id: string
          partner_notified_at?: string | null
          raw_amount?: boolean
          reason?: string | null
          scope: string[]
          status?: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          answered_at?: string | null
          created_at?: string
          ended_at?: string | null
          expires_at?: string | null
          id?: string
          inquiry_id?: string
          partner_notified_at?: string | null
          raw_amount?: boolean
          reason?: string | null
          scope?: string[]
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_request_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiry"
            referencedColumns: ["id"]
          },
        ]
      }
      account: {
        Row: {
          asset_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_existing: boolean
          name: string
          owner_user_id: string | null
          role: Database["public"]["Enums"]["account_role"]
          sort: number
          space_id: string
          start_balance: number | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_existing?: boolean
          name: string
          owner_user_id?: string | null
          role: Database["public"]["Enums"]["account_role"]
          sort?: number
          space_id: string
          start_balance?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_existing?: boolean
          name?: string
          owner_user_id?: string | null
          role?: Database["public"]["Enums"]["account_role"]
          sort?: number
          space_id?: string
          start_balance?: number | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "account_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_approval: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          id: string
          kind: string
          payload: NonNullable<Json>
          requested_at: string
          requested_by: string
          status: string
          summary: string
        }
        ComputedFields: never
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind: string
          payload: NonNullable<Json>
          requested_at?: string
          requested_by: string
          status?: string
          summary: string
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind?: string
          payload?: NonNullable<Json>
          requested_at?: string
          requested_by?: string
          status?: string
          summary?: string
        }
        Relationships: []
      }
      admin_audit: {
        Row: {
          action: string
          admin_email: string | null
          admin_id: string | null
          approver: string | null
          at: string
          detail: NonNullable<Json>
          id: number
          ip: string | null
          reason: string | null
          screen: string
          target: string | null
        }
        ComputedFields: never
        Insert: {
          action: string
          admin_email?: string | null
          admin_id?: string | null
          approver?: string | null
          at?: string
          detail?: NonNullable<Json>
          id?: never
          ip?: string | null
          reason?: string | null
          screen: string
          target?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_id?: string | null
          approver?: string | null
          at?: string
          detail?: NonNullable<Json>
          id?: never
          ip?: string | null
          reason?: string | null
          screen?: string
          target?: string | null
        }
        Relationships: []
      }
      admin_review: {
        Row: {
          at: string
          by_id: string | null
          id: number
          note: string
        }
        ComputedFields: never
        Insert: {
          at?: string
          by_id?: string | null
          id?: never
          note: string
        }
        Update: {
          at?: string
          by_id?: string | null
          id?: never
          note?: string
        }
        Relationships: []
      }
      admin_user: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string | null
          last_seen_at: string | null
          locked: boolean
          name: string
          roles: Database["public"]["Enums"]["admin_role"][]
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string | null
          last_seen_at?: string | null
          locked?: boolean
          name: string
          roles: Database["public"]["Enums"]["admin_role"][]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string | null
          last_seen_at?: string | null
          locked?: boolean
          name?: string
          roles?: Database["public"]["Enums"]["admin_role"][]
        }
        Relationships: []
      }
      app_config: {
        Row: {
          created_at: string
          flags: NonNullable<Json>
          id: number
          kill_switches: NonNullable<Json>
          latest_version_desktop: string
          maintenance_ends_at: string | null
          maintenance_message: string | null
          maintenance_starts_at: string | null
          min_version_android: string
          min_version_desktop: string
          min_version_ios: string
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
          latest_version_desktop?: string
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_starts_at?: string | null
          min_version_android?: string
          min_version_desktop?: string
          min_version_ios?: string
          min_version_web?: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          flags?: NonNullable<Json>
          id?: number
          kill_switches?: NonNullable<Json>
          latest_version_desktop?: string
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_starts_at?: string | null
          min_version_android?: string
          min_version_desktop?: string
          min_version_ios?: string
          min_version_web?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      app_device: {
        Row: {
          app_version: string
          install_id: string
          last_seen_at: string
          platform: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          app_version: string
          install_id: string
          last_seen_at?: string
          platform: string
          user_id: string
        }
        Update: {
          app_version?: string
          install_id?: string
          last_seen_at?: string
          platform?: string
          user_id?: string
        }
        Relationships: []
      }
      app_user: {
        Row: {
          adult_confirmed_at: string | null
          allowance: number | null
          analytics_off: boolean
          app_seen_at: string | null
          avatar_path: string | null
          avatar_updated_at: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          card_main: boolean | null
          created_at: string
          default_visibility: Database["public"]["Enums"]["asset_visibility"]
          deletion_requested_at: string | null
          employment: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable: boolean
          invest_answer: Database["public"]["Enums"]["invest_answer"] | null
          invest_answered_at: string | null
          is_internal_tester: boolean
          monthly_income: number | null
          nickname: string | null
          noti_prefs: NonNullable<Json>
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at: string | null
          onboarding_step: string | null
          other_income: number
          payday: number | null
          payday_last: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          quiet_end: number
          quiet_start: number
          side: Database["public"]["Enums"]["couple_side"] | null
          space_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          version: number
        }
        ComputedFields: never
        Insert: {
          adult_confirmed_at?: string | null
          allowance?: number | null
          analytics_off?: boolean
          app_seen_at?: string | null
          avatar_path?: string | null
          avatar_updated_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          card_main?: boolean | null
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["asset_visibility"]
          deletion_requested_at?: string | null
          employment?: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable?: boolean
          invest_answer?: Database["public"]["Enums"]["invest_answer"] | null
          invest_answered_at?: string | null
          is_internal_tester?: boolean
          monthly_income?: number | null
          nickname?: string | null
          noti_prefs?: NonNullable<Json>
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at?: string | null
          onboarding_step?: string | null
          other_income?: number
          payday?: number | null
          payday_last?: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          quiet_end?: number
          quiet_start?: number
          side?: Database["public"]["Enums"]["couple_side"] | null
          space_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          version?: number
        }
        Update: {
          adult_confirmed_at?: string | null
          allowance?: number | null
          analytics_off?: boolean
          app_seen_at?: string | null
          avatar_path?: string | null
          avatar_updated_at?: string | null
          birth_day?: number | null
          birth_month?: number | null
          birth_year?: number | null
          card_main?: boolean | null
          created_at?: string
          default_visibility?: Database["public"]["Enums"]["asset_visibility"]
          deletion_requested_at?: string | null
          employment?: Database["public"]["Enums"]["employment"] | null
          id?: string
          income_variable?: boolean
          invest_answer?: Database["public"]["Enums"]["invest_answer"] | null
          invest_answered_at?: string | null
          is_internal_tester?: boolean
          monthly_income?: number | null
          nickname?: string | null
          noti_prefs?: NonNullable<Json>
          notify_email?: string
          notify_email_source?: Database["public"]["Enums"]["email_source"]
          onboarding_done_at?: string | null
          onboarding_step?: string | null
          other_income?: number
          payday?: number | null
          payday_last?: boolean
          provider?: Database["public"]["Enums"]["auth_provider"]
          quiet_end?: number
          quiet_start?: number
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
      asset: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          estimated: boolean
          goal_id: string | null
          grp: string
          id: string
          interest_rate: number | null
          kind: string
          maturity_date: string | null
          monthly_payment: number | null
          name: string
          owner: Database["public"]["Enums"]["asset_owner"]
          owner_user_id: string | null
          paid_count: number | null
          pay_from: string | null
          principal: number | null
          rate_estimated: boolean
          realized_gain: number | null
          side: Database["public"]["Enums"]["asset_side"]
          sold_at: string | null
          space_id: string
          status: Database["public"]["Enums"]["asset_status"]
          updated_at: string
          updated_by: string | null
          version: number
          visibility: Database["public"]["Enums"]["asset_visibility"]
          asset_editable: boolean | null
          asset_insertable: boolean | null
          asset_visible: boolean | null
        }
        ComputedFields: "asset_editable" | "asset_insertable" | "asset_visible"
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          estimated?: boolean
          goal_id?: string | null
          grp: string
          id?: string
          interest_rate?: number | null
          kind: string
          maturity_date?: string | null
          monthly_payment?: number | null
          name: string
          owner: Database["public"]["Enums"]["asset_owner"]
          owner_user_id?: string | null
          paid_count?: number | null
          pay_from?: string | null
          principal?: number | null
          rate_estimated?: boolean
          realized_gain?: number | null
          side: Database["public"]["Enums"]["asset_side"]
          sold_at?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: Database["public"]["Enums"]["asset_visibility"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          estimated?: boolean
          goal_id?: string | null
          grp?: string
          id?: string
          interest_rate?: number | null
          kind?: string
          maturity_date?: string | null
          monthly_payment?: number | null
          name?: string
          owner?: Database["public"]["Enums"]["asset_owner"]
          owner_user_id?: string | null
          paid_count?: number | null
          pay_from?: string | null
          principal?: number | null
          rate_estimated?: boolean
          realized_gain?: number | null
          side?: Database["public"]["Enums"]["asset_side"]
          sold_at?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["asset_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: Database["public"]["Enums"]["asset_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "asset_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_history: {
        Row: {
          amount: number
          asset_id: string
          id: number
          principal: number | null
          recorded_at: string
          recorded_by: string | null
          source: string
          space_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          asset_id: string
          id?: never
          principal?: number | null
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          space_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          id?: never
          principal?: number | null
          recorded_at?: string
          recorded_by?: string | null
          source?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_history_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_history_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      care_day: {
        Row: {
          alerts: number[]
          auto: string | null
          auto_moves: boolean
          budget: number
          carer: Database["public"]["Enums"]["care_carer"]
          category: Database["public"]["Enums"]["care_category"]
          created_at: string
          created_by: string | null
          date_rule: Database["public"]["Enums"]["care_date_rule"]
          day: number | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: string
          leap: boolean
          member_id: string | null
          memo: string | null
          month: number | null
          name: string
          once_on: string | null
          secret: boolean
          side: Database["public"]["Enums"]["couple_side"] | null
          space_id: string
          status: Database["public"]["Enums"]["care_status"]
          status_on: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          alerts?: number[]
          auto?: string | null
          auto_moves?: boolean
          budget?: number
          carer?: Database["public"]["Enums"]["care_carer"]
          category: Database["public"]["Enums"]["care_category"]
          created_at?: string
          created_by?: string | null
          date_rule: Database["public"]["Enums"]["care_date_rule"]
          day?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind: string
          leap?: boolean
          member_id?: string | null
          memo?: string | null
          month?: number | null
          name: string
          once_on?: string | null
          secret?: boolean
          side?: Database["public"]["Enums"]["couple_side"] | null
          space_id: string
          status?: Database["public"]["Enums"]["care_status"]
          status_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          alerts?: number[]
          auto?: string | null
          auto_moves?: boolean
          budget?: number
          carer?: Database["public"]["Enums"]["care_carer"]
          category?: Database["public"]["Enums"]["care_category"]
          created_at?: string
          created_by?: string | null
          date_rule?: Database["public"]["Enums"]["care_date_rule"]
          day?: number | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: string
          leap?: boolean
          member_id?: string | null
          memo?: string | null
          month?: number | null
          name?: string
          once_on?: string | null
          secret?: boolean
          side?: Database["public"]["Enums"]["couple_side"] | null
          space_id?: string
          status?: Database["public"]["Enums"]["care_status"]
          status_on?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_day_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      care_record: {
        Row: {
          amount: number
          care_day_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          gift_name: string | null
          gifts: string[]
          id: string
          member_id: string | null
          memo: string | null
          occurs_on: string
          paid_from: Database["public"]["Enums"]["paid_from"]
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          care_day_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          gift_name?: string | null
          gifts?: string[]
          id?: string
          member_id?: string | null
          memo?: string | null
          occurs_on: string
          paid_from: Database["public"]["Enums"]["paid_from"]
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount?: number
          care_day_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          gift_name?: string | null
          gifts?: string[]
          id?: string
          member_id?: string | null
          memo?: string | null
          occurs_on?: string
          paid_from?: Database["public"]["Enums"]["paid_from"]
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "care_record_care_day_id_fkey"
            columns: ["care_day_id"]
            isOneToOne: false
            referencedRelation: "care_day"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_record_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_done: {
        Row: {
          done_at: string
          done_by: string | null
          key: string
          space_id: string
        }
        ComputedFields: never
        Insert: {
          done_at?: string
          done_by?: string | null
          key: string
          space_id: string
        }
        Update: {
          done_at?: string
          done_by?: string | null
          key?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_done_space_id_fkey"
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
      content_version: {
        Row: {
          checked_on: string
          created_at: string
          created_by: string | null
          effective_on: string
          id: string
          key: string
          kind: string
          note: string | null
          version: string
        }
        ComputedFields: never
        Insert: {
          checked_on: string
          created_at?: string
          created_by?: string | null
          effective_on: string
          id?: string
          key: string
          kind: string
          note?: string | null
          version: string
        }
        Update: {
          checked_on?: string
          created_at?: string
          created_by?: string | null
          effective_on?: string
          id?: string
          key?: string
          kind?: string
          note?: string | null
          version?: string
        }
        Relationships: []
      }
      couple_space: {
        Row: {
          account_mode: Database["public"]["Enums"]["account_mode"] | null
          account_mode_next: Database["public"]["Enums"]["account_mode"] | null
          base_day: number | null
          base_day_last: boolean
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
          holiday_shift: boolean
          housing: Database["public"]["Enums"]["housing"] | null
          id: string
          joint_cycle_day: number | null
          living_budget: number | null
          living_budget_estimated: boolean
          living_check: boolean
          loan_repayment: number | null
          marriage_status: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month: string | null
          partner_income: number | null
          partner_income_estimated: boolean
          partner_income_unknown: boolean
          partner_nickname: string | null
          prep_money_mode: Database["public"]["Enums"]["prep_money_mode"] | null
          salary_mode: Database["public"]["Enums"]["salary_mode"]
          split_deferred: boolean
          split_mode: Database["public"]["Enums"]["split_mode"] | null
          split_ratio: number | null
          unlinked_from: string | null
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
          account_mode?: Database["public"]["Enums"]["account_mode"] | null
          account_mode_next?: Database["public"]["Enums"]["account_mode"] | null
          base_day?: number | null
          base_day_last?: boolean
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
          holiday_shift?: boolean
          housing?: Database["public"]["Enums"]["housing"] | null
          id?: string
          joint_cycle_day?: number | null
          living_budget?: number | null
          living_budget_estimated?: boolean
          living_check?: boolean
          loan_repayment?: number | null
          marriage_status?: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home?: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month?: string | null
          partner_income?: number | null
          partner_income_estimated?: boolean
          partner_income_unknown?: boolean
          partner_nickname?: string | null
          prep_money_mode?: Database["public"]["Enums"]["prep_money_mode"] | null
          salary_mode?: Database["public"]["Enums"]["salary_mode"]
          split_deferred?: boolean
          split_mode?: Database["public"]["Enums"]["split_mode"] | null
          split_ratio?: number | null
          unlinked_from?: string | null
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
          account_mode?: Database["public"]["Enums"]["account_mode"] | null
          account_mode_next?: Database["public"]["Enums"]["account_mode"] | null
          base_day?: number | null
          base_day_last?: boolean
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
          holiday_shift?: boolean
          housing?: Database["public"]["Enums"]["housing"] | null
          id?: string
          joint_cycle_day?: number | null
          living_budget?: number | null
          living_budget_estimated?: boolean
          living_check?: boolean
          loan_repayment?: number | null
          marriage_status?: Database["public"]["Enums"]["marriage_status"] | null
          newlywed_home?: Database["public"]["Enums"]["newlywed_home"] | null
          newlywed_home_month?: string | null
          partner_income?: number | null
          partner_income_estimated?: boolean
          partner_income_unknown?: boolean
          partner_nickname?: string | null
          prep_money_mode?: Database["public"]["Enums"]["prep_money_mode"] | null
          salary_mode?: Database["public"]["Enums"]["salary_mode"]
          split_deferred?: boolean
          split_mode?: Database["public"]["Enums"]["split_mode"] | null
          split_ratio?: number | null
          unlinked_from?: string | null
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
        Relationships: [
          {
            foreignKeyName: "couple_space_unlinked_from_fkey"
            columns: ["unlinked_from"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      couple_unlink: {
        Row: {
          cancelled_at: string | null
          confirmed_at: string | null
          counter: Json | null
          counter_at: string | null
          deadline: string
          final_plan: Json | null
          how: string | null
          id: string
          partner_id: string | null
          plan: NonNullable<Json>
          ratio: number
          reconnect_answer: string | null
          reconnect_at: string | null
          reconnect_by: string | null
          reconnect_until: string | null
          reconnected_at: string | null
          requested_at: string
          requested_by: string
          space_id: string
          status: string
        }
        ComputedFields: never
        Insert: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          counter?: Json | null
          counter_at?: string | null
          deadline: string
          final_plan?: Json | null
          how?: string | null
          id?: string
          partner_id?: string | null
          plan: NonNullable<Json>
          ratio: number
          reconnect_answer?: string | null
          reconnect_at?: string | null
          reconnect_by?: string | null
          reconnect_until?: string | null
          reconnected_at?: string | null
          requested_at?: string
          requested_by: string
          space_id: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          confirmed_at?: string | null
          counter?: Json | null
          counter_at?: string | null
          deadline?: string
          final_plan?: Json | null
          how?: string | null
          id?: string
          partner_id?: string | null
          plan?: NonNullable<Json>
          ratio?: number
          reconnect_answer?: string | null
          reconnect_at?: string | null
          reconnect_by?: string | null
          reconnect_until?: string | null
          reconnected_at?: string | null
          requested_at?: string
          requested_by?: string
          space_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "couple_unlink_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_unlink_reconnect_by_fkey"
            columns: ["reconnect_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_unlink_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "app_user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "couple_unlink_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
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
          achieved_at: string | null
          achieved_seen: string[]
          after_marriage: boolean
          amount_estimated: boolean
          created_at: string
          created_by: string | null
          deadline: string | null
          deadline_estimated: boolean
          deleted_at: string | null
          deleted_by: string | null
          details: NonNullable<Json>
          freed_lines: NonNullable<Json>
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held: number
          owner: Database["public"]["Enums"]["goal_owner"]
          owner_user_id: string | null
          photo_path: string | null
          priority: number
          space_id: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          template: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }
        ComputedFields: never
        Insert: {
          achieved_at?: string | null
          achieved_seen?: string[]
          after_marriage?: boolean
          amount_estimated?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_estimated?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          details?: NonNullable<Json>
          freed_lines?: NonNullable<Json>
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          owner_user_id?: string | null
          photo_path?: string | null
          priority: number
          space_id: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          template: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
        }
        Update: {
          achieved_at?: string | null
          achieved_seen?: string[]
          after_marriage?: boolean
          amount_estimated?: boolean
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          deadline_estimated?: boolean
          deleted_at?: string | null
          deleted_by?: string | null
          details?: NonNullable<Json>
          freed_lines?: NonNullable<Json>
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          owner_user_id?: string | null
          photo_path?: string | null
          priority?: number
          space_id?: string
          status?: Database["public"]["Enums"]["goal_status"]
          target_amount?: number | null
          template?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          visibility?: string
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
      goal_move: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          goal_id: string
          id: string
          kind: string
          space_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal_id: string
          id?: string
          kind: string
          space_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          goal_id?: string
          id?: string
          kind?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_move_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_move_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday: {
        Row: {
          date: string
          fetched_at: string
          kind: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source: Database["public"]["Enums"]["holiday_source"]
        }
        ComputedFields: never
        Insert: {
          date: string
          fetched_at?: string
          kind?: Database["public"]["Enums"]["holiday_kind"]
          name: string
          source?: Database["public"]["Enums"]["holiday_source"]
        }
        Update: {
          date?: string
          fetched_at?: string
          kind?: Database["public"]["Enums"]["holiday_kind"]
          name?: string
          source?: Database["public"]["Enums"]["holiday_source"]
        }
        Relationships: []
      }
      inquiry: {
        Row: {
          attach: Json | null
          body: string
          category: Database["public"]["Enums"]["inquiry_category"]
          channel: string
          created_at: string
          done_at: string | null
          id: string
          mail_copied_at: string | null
          no: string
          space_id: string | null
          status: Database["public"]["Enums"]["inquiry_status"]
          updated_at: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          attach?: Json | null
          body: string
          category: Database["public"]["Enums"]["inquiry_category"]
          channel?: string
          created_at?: string
          done_at?: string | null
          id?: string
          mail_copied_at?: string | null
          no?: string
          space_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          attach?: Json | null
          body?: string
          category?: Database["public"]["Enums"]["inquiry_category"]
          channel?: string
          created_at?: string
          done_at?: string | null
          id?: string
          mail_copied_at?: string | null
          no?: string
          space_id?: string | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_message: {
        Row: {
          admin_id: string | null
          author: string
          body: string
          created_at: string
          id: string
          inquiry_id: string
        }
        ComputedFields: never
        Insert: {
          admin_id?: string | null
          author: string
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
        }
        Update: {
          admin_id?: string | null
          author?: string
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_message_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiry"
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
      invite_attempt: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: never
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          user_id?: string
        }
        Relationships: []
      }
      job_run: {
        Row: {
          failed: NonNullable<Json>
          finished_at: string | null
          id: number
          job: string
          ok: boolean | null
          spaces: number | null
          started_at: string
        }
        ComputedFields: never
        Insert: {
          failed?: NonNullable<Json>
          finished_at?: string | null
          id?: never
          job: string
          ok?: boolean | null
          spaces?: number | null
          started_at?: string
        }
        Update: {
          failed?: NonNullable<Json>
          finished_at?: string | null
          id?: never
          job?: string
          ok?: boolean | null
          spaces?: number | null
          started_at?: string
        }
        Relationships: []
      }
      loan_rate: {
        Row: {
          applied_on: string
          kind: string
          rate_bp: number
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          applied_on: string
          kind: string
          rate_bp: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_on?: string
          kind?: string
          rate_bp?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lunar_date: {
        Row: {
          day: number
          leap: boolean
          lunar_year: number
          month: number
          solar: string
        }
        ComputedFields: never
        Insert: {
          day: number
          leap: boolean
          lunar_year: number
          month: number
          solar: string
        }
        Update: {
          day?: number
          leap?: boolean
          lunar_year?: number
          month?: number
          solar?: string
        }
        Relationships: []
      }
      mail_outbox: {
        Row: {
          attempts: number
          body_html: string
          body_text: string
          capped: boolean
          claimed_at: string | null
          created_at: string
          dedupe: string
          id: string
          kind: string
          last_error: string | null
          message_id: string | null
          sent_at: string | null
          subject: string
          to_email: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          body_html: string
          body_text: string
          capped: boolean
          claimed_at?: string | null
          created_at?: string
          dedupe: string
          id?: string
          kind: string
          last_error?: string | null
          message_id?: string | null
          sent_at?: string | null
          subject: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          body_html?: string
          body_text?: string
          capped?: boolean
          claimed_at?: string | null
          created_at?: string
          dedupe?: string
          id?: string
          kind?: string
          last_error?: string | null
          message_id?: string | null
          sent_at?: string | null
          subject?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      mail_suppress: {
        Row: {
          bounces: number
          complaint: boolean
          email: string
          last_at: string
        }
        ComputedFields: never
        Insert: {
          bounces?: number
          complaint?: boolean
          email: string
          last_at?: string
        }
        Update: {
          bounces?: number
          complaint?: boolean
          email?: string
          last_at?: string
        }
        Relationships: []
      }
      notice: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          email: boolean
          ends_at: string
          id: string
          importance: string
          kind: string
          mailed_at: string | null
          platforms: string[]
          published_at: string | null
          starts_at: string
          status: string
          title: string
        }
        ComputedFields: never
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          email?: boolean
          ends_at: string
          id?: string
          importance?: string
          kind?: string
          mailed_at?: string | null
          platforms?: string[]
          published_at?: string | null
          starts_at: string
          status?: string
          title: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          email?: boolean
          ends_at?: string
          id?: string
          importance?: string
          kind?: string
          mailed_at?: string | null
          platforms?: string[]
          published_at?: string | null
          starts_at?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      notification: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          dedupe: string
          icon: string | null
          id: string
          kind: string
          mailed_at: string | null
          push_hidden: boolean
          push_title: string | null
          pushed_at: string | null
          read_at: string | null
          space_id: string | null
          target: string
          title: string
          topic: string | null
          user_id: string
        }
        ComputedFields: never
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          dedupe: string
          icon?: string | null
          id?: string
          kind: string
          mailed_at?: string | null
          push_hidden?: boolean
          push_title?: string | null
          pushed_at?: string | null
          read_at?: string | null
          space_id?: string | null
          target: string
          title: string
          topic?: never
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          dedupe?: string
          icon?: string | null
          id?: string
          kind?: string
          mailed_at?: string | null
          push_hidden?: boolean
          push_title?: string | null
          pushed_at?: string | null
          read_at?: string | null
          space_id?: string | null
          target?: string
          title?: string
          topic?: never
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_change: {
        Row: {
          actor_id: string
          after_v: string | null
          before_v: string | null
          created_at: string
          field: string
          id: number
          noun: string
          receiver_id: string
          ref_id: string | null
          sent_at: string | null
          space_id: string
          target: string
          topic: string
          urgent: boolean
        }
        ComputedFields: never
        Insert: {
          actor_id: string
          after_v?: string | null
          before_v?: string | null
          created_at?: string
          field: string
          id?: never
          noun: string
          receiver_id: string
          ref_id?: string | null
          sent_at?: string | null
          space_id: string
          target: string
          topic: string
          urgent: boolean
        }
        Update: {
          actor_id?: string
          after_v?: string | null
          before_v?: string | null
          created_at?: string
          field?: string
          id?: never
          noun?: string
          receiver_id?: string
          ref_id?: string | null
          sent_at?: string | null
          space_id?: string
          target?: string
          topic?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "partner_change_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_check_line: {
        Row: {
          actual: number | null
          checked_at: string | null
          checked_by: string | null
          checklist_id: string
          goal_id: string | null
          id: string
          kind: Database["public"]["Enums"]["split_line_kind"]
          name: string | null
          on_behalf: boolean
          planned: number
          sort: number
          space_id: string
          split_line_id: string | null
          state: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          actual?: number | null
          checked_at?: string | null
          checked_by?: string | null
          checklist_id: string
          goal_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["split_line_kind"]
          name?: string | null
          on_behalf?: boolean
          planned: number
          sort: number
          space_id: string
          split_line_id?: string | null
          state?: string
          user_id?: string | null
        }
        Update: {
          actual?: number | null
          checked_at?: string | null
          checked_by?: string | null
          checklist_id?: string
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["split_line_kind"]
          name?: string | null
          on_behalf?: boolean
          planned?: number
          sort?: number
          space_id?: string
          split_line_id?: string | null
          state?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pay_check_line_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "pay_checklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_check_line_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_check_line_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_check_line_split_line_id_fkey"
            columns: ["split_line_id"]
            isOneToOne: false
            referencedRelation: "split_line"
            referencedColumns: ["id"]
          },
        ]
      }
      pay_checklist: {
        Row: {
          created_at: string
          cycle_end: string
          cycle_start: string
          id: string
          label: string
          owner_user_id: string | null
          space_id: string
          split_id: string | null
          state: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          cycle_end: string
          cycle_start: string
          id?: string
          label: string
          owner_user_id?: string | null
          space_id: string
          split_id?: string | null
          state?: string
        }
        Update: {
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          id?: string
          label?: string
          owner_user_id?: string | null
          space_id?: string
          split_id?: string | null
          state?: string
        }
        Relationships: [
          {
            foreignKeyName: "pay_checklist_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pay_checklist_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "salary_split"
            referencedColumns: ["id"]
          },
        ]
      }
      photo: {
        Row: {
          care_record_id: string | null
          created_at: string
          created_by: string | null
          goal_id: string | null
          id: string
          path: string
          size_bytes: number
          sort: number
          space_id: string
        }
        ComputedFields: never
        Insert: {
          care_record_id?: string | null
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          id?: string
          path: string
          size_bytes: number
          sort?: number
          space_id: string
        }
        Update: {
          care_record_id?: string | null
          created_at?: string
          created_by?: string | null
          goal_id?: string | null
          id?: string
          path?: string
          size_bytes?: number
          sort?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_care_record_id_fkey"
            columns: ["care_record_id"]
            isOneToOne: false
            referencedRelation: "care_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      push_device: {
        Row: {
          app_version: string | null
          created_at: string
          id: string
          last_seen_at: string
          platform: string
          token: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          app_version?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          platform: string
          token: string
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_split: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string | null
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          owner_user_id?: string | null
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string | null
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_split_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      split_line: {
        Row: {
          amount: number
          goal_id: string | null
          id: string
          kind: Database["public"]["Enums"]["split_line_kind"]
          name: string | null
          sort: number
          space_id: string
          split_id: string
          user_id: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          goal_id?: string | null
          id?: string
          kind: Database["public"]["Enums"]["split_line_kind"]
          name?: string | null
          sort: number
          space_id: string
          split_id: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          goal_id?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["split_line_kind"]
          name?: string | null
          sort?: number
          space_id?: string
          split_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "split_line_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_line_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "split_line_split_id_fkey"
            columns: ["split_id"]
            isOneToOne: false
            referencedRelation: "salary_split"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_purge: {
        Row: {
          attempts: number
          bucket: string
          created_at: string
          done_at: string | null
          id: number
          path: string
        }
        ComputedFields: never
        Insert: {
          attempts?: number
          bucket: string
          created_at?: string
          done_at?: string | null
          id?: never
          path: string
        }
        Update: {
          attempts?: number
          bucket?: string
          created_at?: string
          done_at?: string | null
          id?: never
          path?: string
        }
        Relationships: []
      }
      terms_version: {
        Row: {
          approved_at: string | null
          created_at: string
          created_by: string | null
          effective_on: string
          id: string
          kind: string
          legal_checked: boolean
          reconsent: boolean
          status: string
          version: string
        }
        ComputedFields: never
        Insert: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_on: string
          id?: string
          kind: string
          legal_checked?: boolean
          reconsent?: boolean
          status?: string
          version: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          created_by?: string | null
          effective_on?: string
          id?: string
          kind?: string
          legal_checked?: boolean
          reconsent?: boolean
          status?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      access_send: {
        Args: {
          p_admin: string
          p_raw: boolean
          p_reason: string
          p_scopes: string[]
          q: Omit<
            Database["public"]["Tables"]["inquiry"]["Row"],
            Database["public"]["Tables"]["inquiry"]["ComputedFields"]
          >
        }
        Returns: string
      }
      account_deletion_for: { Args: { uid: string }; Returns: string }
      achieve_goal: { Args: { p_goal: string }; Returns: boolean }
      add_care_photo: {
        Args: { p_path: string; p_record: string; p_size: number }
        Returns: string
      }
      add_inquiry_message: {
        Args: { p_body: string; p_inquiry: string }
        Returns: undefined
      }
      admin_access_data: { Args: { p_access: string }; Returns: Json }
      admin_account_action: {
        Args: {
          p_action: string
          p_inquiry_no: string
          p_note: string
          p_user: string
        }
        Returns: undefined
      }
      admin_add_content_version: {
        Args: {
          p_checked: string
          p_effective: string
          p_key: string
          p_kind: string
          p_note: string
          p_version: string
        }
        Returns: undefined
      }
      admin_add_review: { Args: { p_note: string }; Returns: undefined }
      admin_add_terms_version: {
        Args: {
          p_effective: string
          p_kind: string
          p_legal_checked: boolean
          p_reconsent: boolean
          p_version: string
        }
        Returns: string
      }
      admin_answer_inquiry: {
        Args: {
          p_body: string
          p_id: string
          p_status?: Database["public"]["Enums"]["inquiry_status"]
        }
        Returns: undefined
      }
      admin_app_config: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_approvals: {
        Args: { p_status?: string }
        Returns: {
          decided_at: string
          decided_by: string
          id: string
          kind: string
          payload: Json
          requested_at: string
          requested_by: string
          status: string
          summary: string
        }[]
      }
      admin_audit_rows: {
        Args: {
          p_action?: string
          p_admin?: string
          p_from?: string
          p_limit?: number
          p_target?: string
          p_to?: string
        }
        Returns: {
          action: string
          admin_email: string | null
          admin_id: string | null
          approver: string | null
          at: string
          detail: NonNullable<Json>
          id: number
          ip: string | null
          reason: string | null
          screen: string
          target: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "admin_audit"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_bootstrap: { Args: Record<PropertyKey, never>; Returns: boolean }
      admin_content_versions: {
        Args: Record<PropertyKey, never>
        Returns: {
          checked_on: string
          created_at: string
          created_by: string | null
          effective_on: string
          id: string
          key: string
          kind: string
          note: string | null
          version: string
        }[]
        SetofOptions: {
          from: "*"
          to: "content_version"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_dashboard: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_decide: {
        Args: { p_decision: string; p_id: string }
        Returns: undefined
      }
      admin_end_notice: { Args: { p_id: string }; Returns: undefined }
      admin_inquiries: {
        Args: { p_status: Database["public"]["Enums"]["inquiry_status"] }
        Returns: {
          category: string
          channel: string
          created_at: string
          id: string
          no: string
          status: string
          updated_at: string
          user_id: string
        }[]
      }
      admin_inquiry: { Args: { p_id: string }; Returns: Json }
      admin_inquiry_counts: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_log: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["admin_user"]["Row"],
            Database["public"]["Tables"]["admin_user"]["ComputedFields"]
          >
          p_action: string
          p_approver?: string
          p_detail?: Json
          p_reason?: string
          p_screen: string
          p_target: string
        }
        Returns: undefined
      }
      admin_me: { Args: Record<PropertyKey, never>; Returns: Json }
      admin_note_export: {
        Args: { p_reason: string; p_rows: number; p_screen: string }
        Returns: string
      }
      admin_notices: {
        Args: Record<PropertyKey, never>
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          email: boolean
          ends_at: string
          id: string
          importance: string
          kind: string
          mailed_at: string | null
          platforms: string[]
          published_at: string | null
          starts_at: string
          status: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notice"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_request_access: {
        Args: {
          p_inquiry: string
          p_raw: boolean
          p_reason: string
          p_scopes: string[]
        }
        Returns: string
      }
      admin_request_app_config: { Args: { p: Json }; Returns: string }
      admin_request_approval: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["admin_user"]["Row"],
            Database["public"]["Tables"]["admin_user"]["ComputedFields"]
          >
          p_kind: string
          p_payload: Json
          p_summary: string
        }
        Returns: string
      }
      admin_request_login_move: {
        Args: {
          p_inquiry_no: string
          p_new: string
          p_note: string
          p_user: string
        }
        Returns: string
      }
      admin_request_user: {
        Args: {
          p_email: string
          p_name: string
          p_roles: Database["public"]["Enums"]["admin_role"][]
        }
        Returns: string
      }
      admin_require: {
        Args: { p_roles: Database["public"]["Enums"]["admin_role"][] }
        Returns: {
          created_at: string
          created_by: string | null
          email: string
          id: string | null
          last_seen_at: string | null
          locked: boolean
          name: string
          roles: Database["public"]["Enums"]["admin_role"][]
        }
        SetofOptions: {
          from: "*"
          to: "admin_user"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_reveal: {
        Args: {
          p_inquiry_no: string
          p_reason: string
          p_scopes: string[]
          p_user: string
        }
        Returns: Json
      }
      admin_reviews: {
        Args: Record<PropertyKey, never>
        Returns: {
          at: string
          by_email: string
          note: string
        }[]
      }
      admin_save_notice: {
        Args: {
          p_body: string
          p_ends_at: string
          p_id: string
          p_importance: string
          p_kind: string
          p_platforms: string[]
          p_request: boolean
          p_starts_at: string
          p_title: string
        }
        Returns: string
      }
      admin_search: {
        Args: { p_q: string }
        Returns: {
          couple_state: string
          created_at: string
          email_masked: string
          subscription: string
          user_id: string
        }[]
      }
      admin_set_holiday: {
        Args: {
          p_date: string
          p_delete?: boolean
          p_kind: Database["public"]["Enums"]["holiday_kind"]
          p_name: string
        }
        Returns: undefined
      }
      admin_set_inquiry_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["inquiry_status"]
        }
        Returns: undefined
      }
      admin_set_loan_rate: {
        Args: { p_applied: string; p_kind: string; p_rate_bp: number }
        Returns: undefined
      }
      admin_set_lock: {
        Args: { p_email: string; p_locked: boolean }
        Returns: undefined
      }
      admin_set_notice_email: {
        Args: { p_email: boolean; p_id: string }
        Returns: undefined
      }
      admin_terms_versions: {
        Args: Record<PropertyKey, never>
        Returns: {
          agreed: number
          effective_on: string
          id: string
          kind: string
          legal_checked: boolean
          reconsent: boolean
          status: string
          version: string
        }[]
      }
      admin_user_detail: { Args: { p_user: string }; Returns: Json }
      admin_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          email: string
          last_seen_at: string
          linked: boolean
          locked: boolean
          mfa: boolean
          name: string
          roles: Database["public"]["Enums"]["admin_role"][]
        }[]
      }
      agree_terms: { Args: { p_marketing?: boolean }; Returns: number }
      agree_unlink: { Args: Record<PropertyKey, never>; Returns: undefined }
      answer_access_request: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      answer_reconnect: { Args: { p_accept: boolean }; Returns: undefined }
      asset_editable: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["asset"]["Row"],
            Database["public"]["Tables"]["asset"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      asset_insertable: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["asset"]["Row"],
            Database["public"]["Tables"]["asset"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      asset_visible: {
        Args: {
          a: Omit<
            Database["public"]["Tables"]["asset"]["Row"],
            Database["public"]["Tables"]["asset"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      base_day_ok: { Args: { p: Json; sid: string }; Returns: boolean }
      business_day_on_or_before: { Args: { d: string }; Returns: string }
      can_read_photo: { Args: { p_name: string }; Returns: boolean }
      cancel_account_deletion: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cancel_unlink: { Args: Record<PropertyKey, never>; Returns: undefined }
      care_date_in_year: {
        Args: {
          c: Omit<
            Database["public"]["Tables"]["care_day"]["Row"],
            Database["public"]["Tables"]["care_day"]["ComputedFields"]
          >
          y: number
        }
        Returns: string
      }
      care_next_date: {
        Args: {
          c: Omit<
            Database["public"]["Tables"]["care_day"]["Row"],
            Database["public"]["Tables"]["care_day"]["ComputedFields"]
          >
          today: string
        }
        Returns: string
      }
      check_pay_line: {
        Args: { p_actual?: number; p_line: string; p_state: string }
        Returns: undefined
      }
      claim_mail: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          body_html: string
          body_text: string
          capped: boolean
          claimed_at: string | null
          created_at: string
          dedupe: string
          id: string
          kind: string
          last_error: string | null
          message_id: string | null
          sent_at: string | null
          subject: string
          to_email: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "mail_outbox"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_push: {
        Args: { p_limit?: number; p_now?: string }
        Returns: {
          body: string
          notification_id: string
          platform: string
          target: string
          title: string
          token: string
        }[]
      }
      claim_storage_purge: {
        Args: { p_limit?: number }
        Returns: {
          bucket: string
          id: number
          path: string
        }[]
      }
      complete_join: {
        Args: { p_lines?: Json; p_version?: number }
        Returns: undefined
      }
      complete_signup: {
        Args: {
          p_marketing: boolean
          p_notify_email: string
          p_provider: Database["public"]["Enums"]["auth_provider"]
          p_terms_version: string
        }
        Returns: {
          adult_confirmed_at: string | null
          allowance: number | null
          analytics_off: boolean
          app_seen_at: string | null
          avatar_path: string | null
          avatar_updated_at: string | null
          birth_day: number | null
          birth_month: number | null
          birth_year: number | null
          card_main: boolean | null
          created_at: string
          default_visibility: Database["public"]["Enums"]["asset_visibility"]
          deletion_requested_at: string | null
          employment: Database["public"]["Enums"]["employment"] | null
          id: string
          income_variable: boolean
          invest_answer: Database["public"]["Enums"]["invest_answer"] | null
          invest_answered_at: string | null
          is_internal_tester: boolean
          monthly_income: number | null
          nickname: string | null
          noti_prefs: NonNullable<Json>
          notify_email: string
          notify_email_source: Database["public"]["Enums"]["email_source"]
          onboarding_done_at: string | null
          onboarding_step: string | null
          other_income: number
          payday: number | null
          payday_last: boolean
          provider: Database["public"]["Enums"]["auth_provider"]
          quiet_end: number
          quiet_start: number
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
      create_inquiry: {
        Args: {
          p_attach?: Json
          p_body: string
          p_category: Database["public"]["Enums"]["inquiry_category"]
        }
        Returns: string
      }
      create_invite: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      cut_cycle: {
        Args: { p_day: number; p_owner: string; p_space: string }
        Returns: undefined
      }
      cycle_date: {
        Args: { m: number; p_day: number; y: number }
        Returns: string
      }
      cycle_day: {
        Args: { p_owner: string; p_space: string }
        Returns: number
      }
      discard_prefill: { Args: Record<PropertyKey, never>; Returns: undefined }
      done_storage_purge: { Args: { p_ids: number[] }; Returns: undefined }
      drop_push_tokens: { Args: { p_tokens: string[] }; Returns: number }
      emergency_asset_add: {
        Args: { d: number; p_space: string }
        Returns: undefined
      }
      end_access: { Args: { p_id: string }; Returns: undefined }
      end_sessions: { Args: { p_id?: string }; Returns: number }
      enqueue_mail: {
        Args: {
          p_capped: boolean
          p_dedupe: string
          p_html: string
          p_kind: string
          p_subject: string
          p_text: string
          p_topic: string
          p_user: string
        }
        Returns: boolean
      }
      ensure_my_space: { Args: Record<PropertyKey, never>; Returns: string }
      family_budget_ok: { Args: { p: Json }; Returns: boolean }
      finish_goal_use: { Args: { p_goal: string; p_spent: number }; Returns: number }
      finish_join: { Args: Record<PropertyKey, never>; Returns: undefined }
      finish_mail: {
        Args: { p_error?: string; p_id: string; p_message_id?: string }
        Returns: undefined
      }
      finish_unlink: { Args: { p_how: string; p_id: string }; Returns: undefined }
      flush_partner_changes: { Args: { p_now?: string }; Returns: number }
      goal_asset_sums: {
        Args: Record<PropertyKey, never>
        Returns: {
          goal_id: string
          n: number
          total: number
        }[]
      }
      goal_checked_sums: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          goal_id: string
        }[]
      }
      goal_lines_sync: { Args: { p_goal: string }; Returns: undefined }
      goal_saved: { Args: { p_goal: string }; Returns: number }
      goal_saved_sums: {
        Args: Record<PropertyKey, never>
        Returns: {
          goal_id: string
          saved: number
        }[]
      }
      goal_story: {
        Args: { p_goal: string }
        Returns: {
          months: number
          together: number
        }[]
      }
      html_esc: { Args: { t: string }; Returns: string }
      invest_answers: {
        Args: Record<PropertyKey, never>
        Returns: {
          mine: Database["public"]["Enums"]["invest_answer"]
          partner: Database["public"]["Enums"]["invest_answer"]
        }[]
      }
      invite_preview: {
        Args: { p_code: string }
        Returns: {
          inviter_nickname: string
          status: string
        }[]
      }
      is_own_space_row: {
        Args: { p_owner: string; p_space_id: string }
        Returns: boolean
      }
      is_space_member: { Args: { p_space_id: string }; Returns: boolean }
      join_moving_records: {
        Args: { p_code: string; p_vis?: Json }
        Returns: string
      }
      join_space: { Args: { p_code: string }; Returns: string }
      joining_space: { Args: Record<PropertyKey, never>; Returns: string }
      jwt_aal: { Args: Record<PropertyKey, never>; Returns: string }
      kick_holidays: { Args: Record<PropertyKey, never>; Returns: boolean }
      kick_mail: { Args: Record<PropertyKey, never>; Returns: boolean }
      kick_purge: { Args: Record<PropertyKey, never>; Returns: boolean }
      kick_push: { Args: Record<PropertyKey, never>; Returns: boolean }
      ko_batchim: { Args: { w: string }; Returns: boolean }
      ko_is: { Args: { w: string }; Returns: string }
      ko_obj: { Args: { w: string }; Returns: string }
      ko_subj: { Args: { w: string }; Returns: string }
      kst_today: { Args: Record<PropertyKey, never>; Returns: string }
      lock_idle_admins: { Args: Record<PropertyKey, never>; Returns: number }
      log_partner_change: {
        Args: {
          p_after: string
          p_before: string
          p_field: string
          p_noun: string
          p_ref: string
          p_space: string
          p_target: string
          p_topic: string
          p_urgent: boolean
        }
        Returns: undefined
      }
      log_split_changes: {
        Args: { p_old: Json; p_split: string }
        Returns: undefined
      }
      login_move_apply: {
        Args: { p: Json; p_approval: string }
        Returns: undefined
      }
      login_move_check: {
        Args: { p_new: string; p_user: string }
        Returns: undefined
      }
      login_state: {
        Args: { p_provider?: Database["public"]["Enums"]["auth_provider"] }
        Returns: Json
      }
      mail_blocked: { Args: { p_email: string }; Returns: boolean }
      mail_missed_notifications: { Args: { p_now?: string }; Returns: number }
      make_checklist: {
        Args: { p_owner: string; p_space: string; p_today?: string }
        Returns: string
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      mask_email: { Args: { e: string }; Returns: string }
      md_label: { Args: { d: string }; Returns: string }
      move_goal: {
        Args: { p_amount: number; p_goal: string; p_kind: string }
        Returns: string
      }
      move_goal_saved: { Args: { p_goal: string; p_to: string }; Returns: number }
      my_mail_bounced: { Args: Record<PropertyKey, never>; Returns: boolean }
      my_sessions: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          current: boolean
          id: string
          last_used_at: string
          user_agent: string
        }[]
      }
      my_unlink: {
        Args: Record<PropertyKey, never>
        Returns: {
          cancelled_at: string | null
          confirmed_at: string | null
          counter: Json | null
          counter_at: string | null
          deadline: string
          final_plan: Json | null
          how: string | null
          id: string
          partner_id: string | null
          plan: NonNullable<Json>
          ratio: number
          reconnect_answer: string | null
          reconnect_at: string | null
          reconnect_by: string | null
          reconnect_until: string | null
          reconnected_at: string | null
          requested_at: string
          requested_by: string
          space_id: string
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "couple_unlink"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_uploaded_photo: { Args: { p_path: string }; Returns: boolean }
      net_worth_history: {
        Args: { p_months?: number }
        Returns: {
          expected: number
          month: string
          net: number
        }[]
      }
      next_base_after: {
        Args: { d: string; day: number; last: boolean }
        Returns: string
      }
      note_device: {
        Args: { p_install: string; p_platform: string; p_version: string }
        Returns: undefined
      }
      note_login: { Args: Record<PropertyKey, never>; Returns: boolean }
      note_mail_event: { Args: { p_email: string; p_kind: string }; Returns: number }
      noti_always_mail: { Args: { p_kind: string }; Returns: boolean }
      noti_mail_body: {
        Args: { p_body: string; p_title: string }
        Returns: {
          body_html: string
          body_text: string
        }[]
      }
      notify: {
        Args: {
          p_actor: string
          p_body: string
          p_dedupe: string
          p_icon: string
          p_kind: string
          p_push_hidden?: boolean
          p_push_title?: string
          p_space: string
          p_target: string
          p_title: string
          p_user: string
        }
        Returns: undefined
      }
      partner_asset_sums: {
        Args: Record<PropertyKey, never>
        Returns: {
          grp: string
          n: number
          principal_total: number
          side: Database["public"]["Enums"]["asset_side"]
          total: number
        }[]
      }
      partner_birthday: {
        Args: Record<PropertyKey, never>
        Returns: {
          day: number
          month: number
        }[]
      }
      partner_change_line: {
        Args: {
          p_after: string
          p_before: string
          p_field: string
          p_noun: string
          p_topic: string
        }
        Returns: string
      }
      partner_change_title: {
        Args: { p_noun: string; p_topic: string; who: string }
        Returns: string
      }
      partner_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          allowance: number
          employment: Database["public"]["Enums"]["employment"]
          id: string
          income_variable: boolean
          monthly_income: number
          nickname: string
          other_income: number
          payday: number
          payday_last: boolean
          side: Database["public"]["Enums"]["couple_side"]
        }[]
      }
      pay_line_noun: {
        Args: {
          p_goal: string
          p_kind: Database["public"]["Enums"]["split_line_kind"]
          p_name: string
        }
        Returns: string
      }
      payday_in: {
        Args: {
          m: number
          shift: boolean
          u: Omit<
            Database["public"]["Tables"]["app_user"]["Row"],
            Database["public"]["Tables"]["app_user"]["ComputedFields"]
          >
          y: number
        }
        Returns: string
      }
      pending_terms: {
        Args: Record<PropertyKey, never>
        Returns: {
          kind: string
          version: string
        }[]
      }
      purge_app_devices: { Args: Record<PropertyKey, never>; Returns: undefined }
      purge_deleted_accounts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      purge_left_spaces: { Args: Record<PropertyKey, never>; Returns: number }
      purge_notifications: { Args: Record<PropertyKey, never>; Returns: number }
      purge_old_trash: { Args: Record<PropertyKey, never>; Returns: undefined }
      purge_trash: { Args: { p_id?: string; p_kind?: string }; Returns: number }
      purge_unlinked_spaces: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      push_wanted: { Args: { p_prefs: Json; p_topic: string }; Returns: boolean }
      read_won: { Args: { v: number }; Returns: string }
      recent_goal_changes: {
        Args: Record<PropertyKey, never>
        Returns: {
          actor_id: string
          created_at: string
          field: string
          goal_id: string
        }[]
      }
      reconnect_ok: { Args: { p_id: string }; Returns: boolean }
      record_care: {
        Args: {
          p_amount: number
          p_care: string
          p_gift_name: string
          p_gifts: string[]
          p_memo: string
          p_move: number
          p_on: string
          p_paid_from: Database["public"]["Enums"]["paid_from"]
        }
        Returns: Json
      }
      register_push_device: {
        Args: { p_app_version?: string; p_platform: string; p_token: string }
        Returns: undefined
      }
      renew_invite: {
        Args: Record<PropertyKey, never>
        Returns: {
          code: string
          expires_at: string
        }[]
      }
      request_account_deletion: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      request_reconnect: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      request_unlink: { Args: { p_confirm: string }; Returns: string }
      restore_trash: { Args: { p_id: string; p_kind: string }; Returns: string }
      run_access_expiry: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_cycle_checklists: { Args: { p_today?: string }; Returns: number }
      run_unlink_deadlines: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      save_api_holidays: {
        Args: { p_rows: Json; p_years: number[] }
        Returns: number
      }
      save_split: {
        Args: { p_lines: Json; p_owner?: string }
        Returns: string
      }
      sell_asset: {
        Args: { p_asset: string; p_received: number; p_remain?: number; p_to: string }
        Returns: number
      }
      send_desktop_link: { Args: Record<PropertyKey, never>; Returns: boolean }
      send_evening_notifications: {
        Args: { p_today?: string }
        Returns: number
      }
      send_morning_notifications: {
        Args: { p_today?: string }
        Returns: number
      }
      send_notice_mails: { Args: { p_now?: string }; Returns: number }
      send_weekly_summary: { Args: { p_today?: string }; Returns: number }
      set_avatar: { Args: { p_path?: string }; Returns: undefined }
      set_checklist_done: {
        Args: { p_done: boolean; p_key: string }
        Returns: undefined
      }
      set_goal_photo: {
        Args: { p_goal: string; p_path?: string; p_size?: number }
        Returns: undefined
      }
      set_join_salary_mode: {
        Args: { p_mode: Database["public"]["Enums"]["salary_mode"] }
        Returns: undefined
      }
      set_joint_cycle_day: { Args: { p_day: number }; Returns: undefined }
      set_salary_mode: {
        Args: { p_mode: Database["public"]["Enums"]["salary_mode"] }
        Returns: undefined
      }
      settle_matured: {
        Args: { p_asset: string; p_new_date?: string; p_to?: string }
        Returns: undefined
      }
      space_avatars: {
        Args: Record<PropertyKey, never>
        Returns: {
          path: string
          updated_at: string
          user_id: string
        }[]
      }
      space_goals: {
        Args: Record<PropertyKey, never>
        Returns: {
          achieved_at: string | null
          achieved_seen: string[]
          after_marriage: boolean
          amount_estimated: boolean
          created_at: string
          created_by: string | null
          deadline: string | null
          deadline_estimated: boolean
          deleted_at: string | null
          deleted_by: string | null
          details: NonNullable<Json>
          freed_lines: NonNullable<Json>
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held: number
          owner: Database["public"]["Enums"]["goal_owner"]
          owner_user_id: string | null
          photo_path: string | null
          priority: number
          space_id: string
          status: Database["public"]["Enums"]["goal_status"]
          target_amount: number | null
          template: string
          updated_at: string
          updated_by: string | null
          version: number
          visibility: string
        }[]
        SetofOptions: {
          from: "*"
          to: "goal"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      start_after_unlink: { Args: Record<PropertyKey, never>; Returns: undefined }
      start_checklist: { Args: { p_owner?: string }; Returns: string }
      start_new_invite: { Args: Record<PropertyKey, never>; Returns: undefined }
      stop_access: { Args: { p_id: string }; Returns: undefined }
      sync_checklist: { Args: { p_split: string }; Returns: undefined }
      sync_wedding_care: { Args: { p_space: string }; Returns: undefined }
      touch_app: { Args: Record<PropertyKey, never>; Returns: undefined }
      trash_rows: {
        Args: Record<PropertyKey, never>
        Returns: {
          deleted_at: string
          deleted_by: string
          id: string
          kind: string
          name: string
          sub: string
        }[]
      }
      undo_goal_move: { Args: { p_id: string }; Returns: undefined }
      unlink_partner_name: { Args: Record<PropertyKey, never>; Returns: string }
      unregister_push_device: { Args: { p_token: string }; Returns: undefined }
      version_below: { Args: { p_min: string; p_version: string }; Returns: boolean }
      weekly_mail_body: {
        Args: { p_actor: string; p_receiver: string; p_today: string }
        Returns: {
          body_html: string
          body_text: string
        }[]
      }
      won_band: { Args: { v: number }; Returns: string }
      ym_label: { Args: { d: string }; Returns: string }
    }
    Enums: {
      account_mode: "single" | "roles"
      account_role: "living" | "goal_fund" | "emergency" | "personal" | "wedding"
      account_status: "active" | "deletion_requested" | "deleted"
      admin_role: "super" | "ops" | "cs" | "analyst"
      asset_owner: "joint" | "person"
      asset_side: "asset" | "debt"
      asset_status: "held" | "sold" | "matured"
      asset_visibility: "all" | "sum" | "private"
      auth_provider: "kakao" | "google" | "apple"
      big_expense_how: "from_goal" | "exception"
      care_carer: "groom" | "bride" | "together"
      care_category: "family" | "couple" | "wedding"
      care_date_rule: "solar_yearly" | "lunar_yearly" | "once"
      care_status: "todo" | "preparing" | "done"
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
        | "signup"
        | "prefill_review"
        | "care_day_first"
        | "settings"
        | "peer_stats_page"
        | "reconsent"
      couple_side: "groom" | "bride"
      couple_state: "not_joined" | "connected" | "unlink_pending" | "solo"
      email_source: "provider" | "manual"
      employment: "regular" | "contract" | "freelance" | "resting"
      expense_burden: "shared" | "personal"
      family_relation: "parent" | "grandparent" | "sibling" | "sibling_spouse" | "nephew" | "other"
      goal_kind: "once" | "yearly" | "monthly"
      goal_owner: "together" | "me" | "partner"
      goal_status: "active" | "delayed" | "achieved" | "used" | "paused" | "wrapping_up"
      goal_use_source: "care" | "wedding" | "yearly" | "close" | "achieved" | "move"
      holiday_kind: "holiday" | "substitute" | "temporary"
      holiday_source: "api" | "admin"
      housing: "jeonse" | "monthly_rent" | "own" | "parents" | "none"
      income_kind: "side_job" | "rent" | "support"
      inquiry_category: "account" | "couple" | "calc" | "sync" | "billing" | "privacy" | "etc"
      inquiry_status: "received" | "in_progress" | "waiting_user" | "done"
      invest_answer: "keep" | "some" | "active" | "unsure"
      marriage_status: "married" | "engaged"
      month_close_status: "draft" | "done"
      newlywed_home: "have" | "before" | "after" | "parents"
      paid_from: "goal_fund" | "living" | "personal" | "wedding_account" | "personal_support"
      plan_line_kind: "split" | "emergency_to_living" | "goal_to_living"
      plan_line_state: "pending" | "done"
      plan_line_target: "account" | "goal"
      plan_status: "created" | "splitting" | "closing" | "closed" | "skipped"
      prep_money_mode: "separate" | "together"
      proposal_response: "like" | "oppose" | "differently"
      proposal_status:
        "open" | "applied" | "held" | "withdrawn" | "expired" | "reverted" | "superseded"
      salary_mode: "separate" | "joint"
      split_line_kind: "saving" | "fixed" | "living" | "allowance" | "custom"
      split_mode: "half" | "income" | "custom"
      todo_status: "pending" | "snoozed" | "done"
      wedding_payer: "us" | "groom" | "bride" | "family"
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
      account_mode: ["single", "roles"],
      account_role: ["living", "goal_fund", "emergency", "personal", "wedding"],
      account_status: ["active", "deletion_requested", "deleted"],
      admin_role: ["super", "ops", "cs", "analyst"],
      asset_owner: ["joint", "person"],
      asset_side: ["asset", "debt"],
      asset_status: ["held", "sold", "matured"],
      asset_visibility: ["all", "sum", "private"],
      auth_provider: ["kakao", "google", "apple"],
      big_expense_how: ["from_goal", "exception"],
      care_carer: ["groom", "bride", "together"],
      care_category: ["family", "couple", "wedding"],
      care_date_rule: ["solar_yearly", "lunar_yearly", "once"],
      care_status: ["todo", "preparing", "done"],
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
      consent_source: [
        "signup",
        "prefill_review",
        "care_day_first",
        "settings",
        "peer_stats_page",
        "reconsent",
      ],
      couple_side: ["groom", "bride"],
      couple_state: ["not_joined", "connected", "unlink_pending", "solo"],
      email_source: ["provider", "manual"],
      employment: ["regular", "contract", "freelance", "resting"],
      expense_burden: ["shared", "personal"],
      family_relation: ["parent", "grandparent", "sibling", "sibling_spouse", "nephew", "other"],
      goal_kind: ["once", "yearly", "monthly"],
      goal_owner: ["together", "me", "partner"],
      goal_status: ["active", "delayed", "achieved", "used", "paused", "wrapping_up"],
      goal_use_source: ["care", "wedding", "yearly", "close", "achieved", "move"],
      holiday_kind: ["holiday", "substitute", "temporary"],
      holiday_source: ["api", "admin"],
      housing: ["jeonse", "monthly_rent", "own", "parents", "none"],
      income_kind: ["side_job", "rent", "support"],
      inquiry_category: ["account", "couple", "calc", "sync", "billing", "privacy", "etc"],
      inquiry_status: ["received", "in_progress", "waiting_user", "done"],
      invest_answer: ["keep", "some", "active", "unsure"],
      marriage_status: ["married", "engaged"],
      month_close_status: ["draft", "done"],
      newlywed_home: ["have", "before", "after", "parents"],
      paid_from: ["goal_fund", "living", "personal", "wedding_account", "personal_support"],
      plan_line_kind: ["split", "emergency_to_living", "goal_to_living"],
      plan_line_state: ["pending", "done"],
      plan_line_target: ["account", "goal"],
      plan_status: ["created", "splitting", "closing", "closed", "skipped"],
      prep_money_mode: ["separate", "together"],
      proposal_response: ["like", "oppose", "differently"],
      proposal_status: [
        "open",
        "applied",
        "held",
        "withdrawn",
        "expired",
        "reverted",
        "superseded",
      ],
      salary_mode: ["separate", "joint"],
      split_line_kind: ["saving", "fixed", "living", "allowance", "custom"],
      split_mode: ["half", "income", "custom"],
      todo_status: ["pending", "snoozed", "done"],
      wedding_payer: ["us", "groom", "bride", "family"],
    },
  },
} as const
