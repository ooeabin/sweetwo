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
          latest_version_desktop?: string
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_starts_at?: string | null
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
          latest_version_desktop?: string
          maintenance_ends_at?: string | null
          maintenance_message?: string | null
          maintenance_starts_at?: string | null
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
          allowance?: number | null
          analytics_off?: boolean
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
          allowance?: number | null
          analytics_off?: boolean
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
          source?: string
          space_id: string
        }
        Update: {
          amount?: number
          asset_id?: string
          id?: never
          principal?: number | null
          recorded_at?: string
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
      big_expense: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          goal_id: string | null
          how: Database["public"]["Enums"]["big_expense_how"]
          id: string
          kind: string
          month_close_id: string
          name: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string | null
          how?: Database["public"]["Enums"]["big_expense_how"]
          id?: string
          kind: string
          month_close_id: string
          name: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string | null
          how?: Database["public"]["Enums"]["big_expense_how"]
          id?: string
          kind?: string
          month_close_id?: string
          name?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "big_expense_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "big_expense_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "big_expense_space_id_fkey"
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
            foreignKeyName: "care_day_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_member"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "care_record_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "family_member"
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
      close_balance: {
        Row: {
          account_id: string
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          expected: number | null
          id: string
          month_close_id: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          account_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected?: number | null
          id?: string
          month_close_id: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          account_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          expected?: number | null
          id?: string
          month_close_id?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "close_balance_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "close_balance_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "close_balance_space_id_fkey"
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
      emergency_move: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          kind: string
          moved_on: string
          reason: string | null
          space_id: string
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind: string
          moved_on?: string
          reason?: string | null
          space_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          kind?: string
          moved_on?: string
          reason?: string | null
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emergency_move_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      family_member: {
        Row: {
          birth_day: number | null
          birth_leap: boolean
          birth_lunar: boolean
          birth_month: number | null
          birth_year: number | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          korean_age: boolean
          memo: string | null
          relation: Database["public"]["Enums"]["family_relation"]
          side: Database["public"]["Enums"]["couple_side"]
          sort: number
          space_id: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          birth_day?: number | null
          birth_leap?: boolean
          birth_lunar?: boolean
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          korean_age?: boolean
          memo?: string | null
          relation: Database["public"]["Enums"]["family_relation"]
          side: Database["public"]["Enums"]["couple_side"]
          sort?: number
          space_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          birth_day?: number | null
          birth_leap?: boolean
          birth_lunar?: boolean
          birth_month?: number | null
          birth_year?: number | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          korean_age?: boolean
          memo?: string | null
          relation?: Database["public"]["Enums"]["family_relation"]
          side?: Database["public"]["Enums"]["couple_side"]
          sort?: number
          space_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_member_space_id_fkey"
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
          id: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held: number
          owner: Database["public"]["Enums"]["goal_owner"]
          owner_user_id: string | null
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
          id?: string
          kind: Database["public"]["Enums"]["goal_kind"]
          name: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          owner_user_id?: string | null
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
          id?: string
          kind?: Database["public"]["Enums"]["goal_kind"]
          name?: string
          other_held?: number
          owner?: Database["public"]["Enums"]["goal_owner"]
          owner_user_id?: string | null
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
      goal_use: {
        Row: {
          amount: number
          care_record_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          goal_id: string
          id: string
          month_close_id: string | null
          moved_asset_id: string | null
          moved_goal_id: string | null
          paid_from: Database["public"]["Enums"]["paid_from"]
          plan_line_id: string | null
          source: Database["public"]["Enums"]["goal_use_source"]
          space_id: string
          updated_at: string
          updated_by: string | null
          used_on: string
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          care_record_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id: string
          id?: string
          month_close_id?: string | null
          moved_asset_id?: string | null
          moved_goal_id?: string | null
          paid_from: Database["public"]["Enums"]["paid_from"]
          plan_line_id?: string | null
          source: Database["public"]["Enums"]["goal_use_source"]
          space_id: string
          updated_at?: string
          updated_by?: string | null
          used_on: string
          version?: number
        }
        Update: {
          amount?: number
          care_record_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string
          id?: string
          month_close_id?: string | null
          moved_asset_id?: string | null
          moved_goal_id?: string | null
          paid_from?: Database["public"]["Enums"]["paid_from"]
          plan_line_id?: string | null
          source?: Database["public"]["Enums"]["goal_use_source"]
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          used_on?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_use_care_record_id_fkey"
            columns: ["care_record_id"]
            isOneToOne: false
            referencedRelation: "care_record"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_moved_asset_id_fkey"
            columns: ["moved_asset_id"]
            isOneToOne: false
            referencedRelation: "asset"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_moved_goal_id_fkey"
            columns: ["moved_goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_plan_line_id_fkey"
            columns: ["plan_line_id"]
            isOneToOne: false
            referencedRelation: "plan_line"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_use_space_id_fkey"
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
      income_event: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          month: number
          name: string
          owner_user_id: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
          yearly: boolean
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month: number
          name: string
          owner_user_id: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          yearly?: boolean
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month?: number
          name?: string
          owner_user_id?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
          yearly?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "income_event_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      income_item: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          kind: Database["public"]["Enums"]["income_kind"]
          monthly_amount: number
          owner_user_id: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["income_kind"]
          monthly_amount: number
          owner_user_id: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["income_kind"]
          monthly_amount?: number
          owner_user_id?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "income_item_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      income_period: {
        Row: {
          amount: number
          base_income: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          end_month: string
          ended_at: string | null
          id: string
          space_id: string
          split_before: Json | null
          split_proposal_id: string | null
          start_month: string
          supplement: number
          updated_at: string
          updated_by: string | null
          user_id: string
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          base_income: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_month: string
          ended_at?: string | null
          id?: string
          space_id: string
          split_before?: Json | null
          split_proposal_id?: string | null
          start_month: string
          supplement?: number
          updated_at?: string
          updated_by?: string | null
          user_id: string
          version?: number
        }
        Update: {
          amount?: number
          base_income?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          end_month?: string
          ended_at?: string | null
          id?: string
          space_id?: string
          split_before?: Json | null
          split_proposal_id?: string | null
          start_month?: string
          supplement?: number
          updated_at?: string
          updated_by?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "income_period_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_period_split_proposal_id_fkey"
            columns: ["split_proposal_id"]
            isOneToOne: false
            referencedRelation: "proposal"
            referencedColumns: ["id"]
          },
        ]
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
      living_check: {
        Row: {
          allowance_cut: number | null
          allowance_side: Database["public"]["Enums"]["couple_side"] | null
          answer: string
          answered_by: string | null
          cover_from: string | null
          created_at: string
          id: string
          over_amount: number | null
          plan_id: string
          space_id: string
        }
        ComputedFields: never
        Insert: {
          allowance_cut?: number | null
          allowance_side?: Database["public"]["Enums"]["couple_side"] | null
          answer: string
          answered_by?: string | null
          cover_from?: string | null
          created_at?: string
          id?: string
          over_amount?: number | null
          plan_id: string
          space_id: string
        }
        Update: {
          allowance_cut?: number | null
          allowance_side?: Database["public"]["Enums"]["couple_side"] | null
          answer?: string
          answered_by?: string | null
          cover_from?: string | null
          created_at?: string
          id?: string
          over_amount?: number | null
          plan_id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "living_check_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "living_check_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
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
      month_close: {
        Row: {
          big_none: boolean
          budget_fix: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          detailed_at: string | null
          emergency_reason: string | null
          emergency_used: boolean | null
          gap_amount: number | null
          gap_choice: string | null
          gap_goal_id: string | null
          gap_kind: string | null
          goal_gap_amount: number | null
          goal_gap_goal_id: string | null
          goal_gap_not_goal: boolean | null
          id: string
          income: number | null
          income_actual_bride: number | null
          income_actual_groom: number | null
          income_short: number | null
          income_short_side: Database["public"]["Enums"]["couple_side"] | null
          late: boolean
          plan_id: string
          rested: boolean
          space_id: string
          started_at: string | null
          started_by: string | null
          status: Database["public"]["Enums"]["month_close_status"]
          supplement_line_id: string | null
          together_at: string | null
          together_by: string | null
          together_left_at: string | null
          updated_at: string
          updated_by: string | null
          version: number
          close_together_active: boolean | null
        }
        ComputedFields: "close_together_active"
        Insert: {
          big_none?: boolean
          budget_fix?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detailed_at?: string | null
          emergency_reason?: string | null
          emergency_used?: boolean | null
          gap_amount?: number | null
          gap_choice?: string | null
          gap_goal_id?: string | null
          gap_kind?: string | null
          goal_gap_amount?: number | null
          goal_gap_goal_id?: string | null
          goal_gap_not_goal?: boolean | null
          id?: string
          income?: number | null
          income_actual_bride?: number | null
          income_actual_groom?: number | null
          income_short?: number | null
          income_short_side?: Database["public"]["Enums"]["couple_side"] | null
          late?: boolean
          plan_id: string
          rested?: boolean
          space_id: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["month_close_status"]
          supplement_line_id?: string | null
          together_at?: string | null
          together_by?: string | null
          together_left_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          big_none?: boolean
          budget_fix?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detailed_at?: string | null
          emergency_reason?: string | null
          emergency_used?: boolean | null
          gap_amount?: number | null
          gap_choice?: string | null
          gap_goal_id?: string | null
          gap_kind?: string | null
          goal_gap_amount?: number | null
          goal_gap_goal_id?: string | null
          goal_gap_not_goal?: boolean | null
          id?: string
          income?: number | null
          income_actual_bride?: number | null
          income_actual_groom?: number | null
          income_short?: number | null
          income_short_side?: Database["public"]["Enums"]["couple_side"] | null
          late?: boolean
          plan_id?: string
          rested?: boolean
          space_id?: string
          started_at?: string | null
          started_by?: string | null
          status?: Database["public"]["Enums"]["month_close_status"]
          supplement_line_id?: string | null
          together_at?: string | null
          together_by?: string | null
          together_left_at?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "month_close_gap_goal_id_fkey"
            columns: ["gap_goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_close_goal_gap_goal_id_fkey"
            columns: ["goal_gap_goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_close_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_close_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_close_supplement_line_id_fkey"
            columns: ["supplement_line_id"]
            isOneToOne: false
            referencedRelation: "plan_line"
            referencedColumns: ["id"]
          },
        ]
      }
      month_spend: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          month_close_id: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month_close_id: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          month_close_id?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "month_spend_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "spend_category"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_spend_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "month_spend_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_plan: {
        Row: {
          created_at: string
          created_by: string | null
          cycle_end: string
          cycle_start: string
          deleted_at: string | null
          deleted_by: string | null
          first_adjust: number | null
          id: string
          is_partial: boolean
          is_temp: boolean
          label_month: string
          merged_close: boolean
          snapshot: NonNullable<Json>
          space_id: string
          status: Database["public"]["Enums"]["plan_status"]
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          cycle_end: string
          cycle_start: string
          deleted_at?: string | null
          deleted_by?: string | null
          first_adjust?: number | null
          id?: string
          is_partial?: boolean
          is_temp?: boolean
          label_month: string
          merged_close?: boolean
          snapshot?: NonNullable<Json>
          space_id: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          cycle_end?: string
          cycle_start?: string
          deleted_at?: string | null
          deleted_by?: string | null
          first_adjust?: number | null
          id?: string
          is_partial?: boolean
          is_temp?: boolean
          label_month?: string
          merged_close?: boolean
          snapshot?: NonNullable<Json>
          space_id?: string
          status?: Database["public"]["Enums"]["plan_status"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_plan_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      notice: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          importance: string
          kind: string
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
          ends_at: string
          id?: string
          importance?: string
          kind?: string
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
          ends_at?: string
          id?: string
          importance?: string
          kind?: string
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
          push_hidden: boolean
          push_title: string | null
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
          push_hidden?: boolean
          push_title?: string | null
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
          push_hidden?: boolean
          push_title?: string | null
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
      plan_line: {
        Row: {
          account_role: Database["public"]["Enums"]["account_role"] | null
          amount: number
          amount_bride: number | null
          amount_groom: number | null
          bride_done_amount: number | null
          bride_done_at: string | null
          bride_done_by: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_amount: number | null
          goal_id: string | null
          groom_done_amount: number | null
          groom_done_at: string | null
          groom_done_by: string | null
          id: string
          income_period_id: string | null
          kind: Database["public"]["Enums"]["plan_line_kind"]
          plan_id: string
          sort: number
          space_id: string
          state: Database["public"]["Enums"]["plan_line_state"]
          target: Database["public"]["Enums"]["plan_line_target"]
          updated_at: string
          updated_by: string | null
          version: number
          split_line_done: boolean | null
        }
        ComputedFields: "split_line_done"
        Insert: {
          account_role?: Database["public"]["Enums"]["account_role"] | null
          amount: number
          amount_bride?: number | null
          amount_groom?: number | null
          bride_done_amount?: number | null
          bride_done_at?: string | null
          bride_done_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_amount?: number | null
          goal_id?: string | null
          groom_done_amount?: number | null
          groom_done_at?: string | null
          groom_done_by?: string | null
          id?: string
          income_period_id?: string | null
          kind?: Database["public"]["Enums"]["plan_line_kind"]
          plan_id: string
          sort?: number
          space_id: string
          state?: Database["public"]["Enums"]["plan_line_state"]
          target: Database["public"]["Enums"]["plan_line_target"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          account_role?: Database["public"]["Enums"]["account_role"] | null
          amount?: number
          amount_bride?: number | null
          amount_groom?: number | null
          bride_done_amount?: number | null
          bride_done_at?: string | null
          bride_done_by?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_amount?: number | null
          goal_id?: string | null
          groom_done_amount?: number | null
          groom_done_at?: string | null
          groom_done_by?: string | null
          id?: string
          income_period_id?: string | null
          kind?: Database["public"]["Enums"]["plan_line_kind"]
          plan_id?: string
          sort?: number
          space_id?: string
          state?: Database["public"]["Enums"]["plan_line_state"]
          target?: Database["public"]["Enums"]["plan_line_target"]
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_line_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_line_income_period_id_fkey"
            columns: ["income_period_id"]
            isOneToOne: false
            referencedRelation: "income_period"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_line_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "monthly_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_line_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal: {
        Row: {
          after: NonNullable<Json>
          applied_at: string | null
          apply_on: string
          before: NonNullable<Json>
          created_at: string
          id: string
          item: string
          month_close_id: string | null
          oppose_count: number
          proposer: string
          replaces: string | null
          responded_at: string | null
          response: Database["public"]["Enums"]["proposal_response"] | null
          round_trips: number
          seen_at: string | null
          space_id: string
          status: Database["public"]["Enums"]["proposal_status"]
          target_id: string | null
          together: boolean
          updated_at: string
          version: number
          wedding_item_id: string | null
          apply_proposal_values: undefined | null
          proposal_item_noun: string | null
        }
        ComputedFields: "apply_proposal_values" | "proposal_item_noun"
        Insert: {
          after: NonNullable<Json>
          applied_at?: string | null
          apply_on: string
          before: NonNullable<Json>
          created_at?: string
          id?: string
          item: string
          month_close_id?: string | null
          oppose_count?: number
          proposer: string
          replaces?: string | null
          responded_at?: string | null
          response?: Database["public"]["Enums"]["proposal_response"] | null
          round_trips?: number
          seen_at?: string | null
          space_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
          target_id?: string | null
          together?: boolean
          updated_at?: string
          version?: number
          wedding_item_id?: string | null
        }
        Update: {
          after?: NonNullable<Json>
          applied_at?: string | null
          apply_on?: string
          before?: NonNullable<Json>
          created_at?: string
          id?: string
          item?: string
          month_close_id?: string | null
          oppose_count?: number
          proposer?: string
          replaces?: string | null
          responded_at?: string | null
          response?: Database["public"]["Enums"]["proposal_response"] | null
          round_trips?: number
          seen_at?: string | null
          space_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
          target_id?: string | null
          together?: boolean
          updated_at?: string
          version?: number
          wedding_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_replaces_fkey"
            columns: ["replaces"]
            isOneToOne: false
            referencedRelation: "proposal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposal_wedding_item_id_fkey"
            columns: ["wedding_item_id"]
            isOneToOne: false
            referencedRelation: "wedding_item"
            referencedColumns: ["id"]
          },
        ]
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
      saving_deposit: {
        Row: {
          amount: number
          asset_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          goal_id: string | null
          id: string
          month_close_id: string
          name: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string | null
          id?: string
          month_close_id: string
          name: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount?: number
          asset_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_id?: string | null
          id?: string
          month_close_id?: string
          name?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "saving_deposit_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saving_deposit_month_close_id_fkey"
            columns: ["month_close_id"]
            isOneToOne: false
            referencedRelation: "month_close"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saving_deposit_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      spend_category: {
        Row: {
          created_at: string
          created_by: string | null
          default_key: string | null
          deleted_at: string | null
          deleted_by: string | null
          enabled: boolean
          id: string
          name: string
          sort: number
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          default_key?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          sort?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_key?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          sort?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "spend_category_space_id_fkey"
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
      todo: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          done_at: string | null
          done_by: string | null
          for_user: string | null
          id: string
          kind: string
          open_on: string
          screen: string | null
          snoozed_until: string | null
          sort: number
          space_id: string
          status: Database["public"]["Enums"]["todo_status"]
          target_id: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          for_user?: string | null
          id?: string
          kind: string
          open_on?: string
          screen?: string | null
          snoozed_until?: string | null
          sort?: number
          space_id: string
          status?: Database["public"]["Enums"]["todo_status"]
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          done_at?: string | null
          done_by?: string | null
          for_user?: string | null
          id?: string
          kind?: string
          open_on?: string
          screen?: string | null
          snoozed_until?: string | null
          sort?: number
          space_id?: string
          status?: Database["public"]["Enums"]["todo_status"]
          target_id?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "todo_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      unlink_copy: {
        Row: {
          new_id: string
          old_id: string
          tbl: string
          unlink_id: string
          user_id: string
        }
        ComputedFields: never
        Insert: {
          new_id: string
          old_id: string
          tbl: string
          unlink_id: string
          user_id: string
        }
        Update: {
          new_id?: string
          old_id?: string
          tbl?: string
          unlink_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unlink_copy_unlink_id_fkey"
            columns: ["unlink_id"]
            isOneToOne: false
            referencedRelation: "couple_unlink"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_item: {
        Row: {
          balance_amount: number | null
          balance_on: string | null
          budget: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          deposit_amount: number | null
          deposit_on: string | null
          id: string
          key: string
          name: string
          payer: Database["public"]["Enums"]["wedding_payer"]
          sort: number
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          balance_amount?: number | null
          balance_on?: string | null
          budget?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_on?: string | null
          id?: string
          key: string
          name: string
          payer?: Database["public"]["Enums"]["wedding_payer"]
          sort?: number
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          balance_amount?: number | null
          balance_on?: string | null
          budget?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          deposit_amount?: number | null
          deposit_on?: string | null
          id?: string
          key?: string
          name?: string
          payer?: Database["public"]["Enums"]["wedding_payer"]
          sort?: number
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wedding_item_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "couple_space"
            referencedColumns: ["id"]
          },
        ]
      }
      wedding_payment: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          goal_use_id: string | null
          id: string
          item_id: string
          paid_from: Database["public"]["Enums"]["paid_from"]
          paid_on: string
          part: string
          space_id: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_use_id?: string | null
          id?: string
          item_id: string
          paid_from: Database["public"]["Enums"]["paid_from"]
          paid_on: string
          part: string
          space_id: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          goal_use_id?: string | null
          id?: string
          item_id?: string
          paid_from?: Database["public"]["Enums"]["paid_from"]
          paid_on?: string
          part?: string
          space_id?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wedding_payment_goal_use_id_fkey"
            columns: ["goal_use_id"]
            isOneToOne: false
            referencedRelation: "goal_use"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_payment_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "wedding_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wedding_payment_space_id_fkey"
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
      accept_counter_unlink: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      achieve_goal: { Args: { p_goal: string }; Returns: boolean }
      add_income_supplement: { Args: { p_close: string }; Returns: string }
      add_inquiry_message: {
        Args: { p_body: string; p_inquiry: string }
        Returns: undefined
      }
      add_period_supplement: {
        Args: { p_period: string; p_plan: string }
        Returns: undefined
      }
      adjust_plan: {
        Args: {
          p_amount: number
          p_counter: Database["public"]["Enums"]["account_role"]
          p_plan: string
          p_role: Database["public"]["Enums"]["account_role"]
        }
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
      admin_notices: {
        Args: Record<PropertyKey, never>
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          importance: string
          kind: string
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
      agree_unlink: { Args: Record<PropertyKey, never>; Returns: undefined }
      answer_access_request: {
        Args: { p_accept: boolean; p_id: string }
        Returns: undefined
      }
      answer_actual_income: {
        Args: { p_amount: number; p_close: string }
        Returns: number
      }
      answer_goal_gap: {
        Args: { p_amount: number; p_close: string; p_goal?: string }
        Returns: undefined
      }
      answer_living_check: {
        Args: {
          p_answer: string
          p_cover?: string
          p_over?: number
          p_plan: string
        }
        Returns: string
      }
      answer_reconnect: { Args: { p_accept: boolean }; Returns: undefined }
      apply_base_day: { Args: { p: Json; sid: string }; Returns: undefined }
      apply_due_proposals: { Args: Record<PropertyKey, never>; Returns: number }
      apply_family_budget: {
        Args: { p: Json; sid: string }
        Returns: undefined
      }
      apply_proposal_values: {
        Args: {
          p: Omit<
            Database["public"]["Tables"]["proposal"]["Row"],
            Database["public"]["Tables"]["proposal"]["ComputedFields"]
          >
        }
        Returns: undefined
      }
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
      change_wedding_budget: {
        Args: { p_apply_on: string; p_budget: number; p_item?: string }
        Returns: string
      }
      check_pay_line: {
        Args: { p_actual?: number; p_line: string; p_state: string }
        Returns: undefined
      }
      check_split: {
        Args: {
          p_amount?: number
          p_line: string
          p_side: Database["public"]["Enums"]["couple_side"]
        }
        Returns: string
      }
      close_together_active: {
        Args: {
          c: Omit<
            Database["public"]["Tables"]["month_close"]["Row"],
            Database["public"]["Tables"]["month_close"]["ComputedFields"]
          >
        }
        Returns: boolean
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
          allowance: number | null
          analytics_off: boolean
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
      confirm_together: {
        Args: { p_close: string; p_id: string }
        Returns: undefined
      }
      confirm_unlink: {
        Args: { p_how: string; p_id: string; p_plan: Json }
        Returns: undefined
      }
      counter_unlink: { Args: { p_shares: Json }; Returns: undefined }
      create_cycle_plan: {
        Args: {
          p_cycle_end: string
          p_cycle_start: string
          p_is_temp: boolean
          p_label_month: string
          p_lines: Json
          p_snapshot: Json
        }
        Returns: string
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
      cycle_date: {
        Args: { m: number; p_day: number; y: number }
        Returns: string
      }
      cycle_day: {
        Args: { p_owner: string; p_space: string }
        Returns: number
      }
      delete_minor_account: {
        Args: { p_birth_year: number }
        Returns: undefined
      }
      delete_underage_account: {
        Args: { p_birth_date: string }
        Returns: undefined
      }
      discard_prefill: { Args: Record<PropertyKey, never>; Returns: undefined }
      emergency_asset_add: {
        Args: { d: number; p_space: string }
        Returns: undefined
      }
      end_access: { Args: { p_id: string }; Returns: undefined }
      end_income_periods: { Args: Record<PropertyKey, never>; Returns: number }
      end_sessions: { Args: { p_id?: string }; Returns: number }
      ensure_my_space: { Args: Record<PropertyKey, never>; Returns: string }
      family_budget_now: { Args: { sid: string }; Returns: Json }
      family_budget_ok: { Args: { p: Json }; Returns: boolean }
      finish_join: { Args: Record<PropertyKey, never>; Returns: undefined }
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
      join_close_together: { Args: { p_close: string }; Returns: undefined }
      join_space: { Args: { p_code: string }; Returns: string }
      joining_space: { Args: Record<PropertyKey, never>; Returns: string }
      jwt_aal: { Args: Record<PropertyKey, never>; Returns: string }
      ko_batchim: { Args: { w: string }; Returns: boolean }
      ko_is: { Args: { w: string }; Returns: string }
      ko_obj: { Args: { w: string }; Returns: string }
      ko_subj: { Args: { w: string }; Returns: string }
      kst_today: { Args: Record<PropertyKey, never>; Returns: string }
      leave_close_together: { Args: { p_close: string }; Returns: undefined }
      living_check_day: {
        Args: { p_end: string; p_start: string }
        Returns: string
      }
      lock_idle_admins: { Args: Record<PropertyKey, never>; Returns: number }
      login_state: {
        Args: { p_provider?: Database["public"]["Enums"]["auth_provider"] }
        Returns: Json
      }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      mark_proposal_seen: { Args: { p_id: string }; Returns: undefined }
      mask_email: { Args: { e: string }; Returns: string }
      md_label: { Args: { d: string }; Returns: string }
      move_emergency: {
        Args: { p_amount: number; p_kind: string; p_reason?: string }
        Returns: string
      }
      move_goal: {
        Args: { p_amount: number; p_goal: string; p_kind: string }
        Returns: string
      }
      move_goal_rest: {
        Args: { p_goal: string; p_use: string }
        Returns: undefined
      }
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
      partner_activity: {
        Args: { p_limit?: number }
        Returns: {
          at: string
          kind: string
          name: string
          ref: string
          target: string
        }[]
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
      proposal_item_noun: {
        Args: {
          p: Omit<
            Database["public"]["Tables"]["proposal"]["Row"],
            Database["public"]["Tables"]["proposal"]["ComputedFields"]
          >
        }
        Returns: string
      }
      proposal_space: { Args: Record<PropertyKey, never>; Returns: string }
      propose: {
        Args: {
          p_after: Json
          p_apply_on: string
          p_item: string
          p_target?: string
        }
        Returns: string
      }
      propose_in_close: {
        Args: {
          p_after: Json
          p_apply_on: string
          p_close: string
          p_item: string
          p_target?: string
        }
        Returns: string
      }
      purge_deleted_accounts: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      purge_notifications: { Args: Record<PropertyKey, never>; Returns: number }
      purge_old_trash: { Args: Record<PropertyKey, never>; Returns: undefined }
      purge_trash: { Args: { p_id?: string; p_kind?: string }; Returns: number }
      purge_unlinked_spaces: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      read_won: { Args: { v: number }; Returns: string }
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
      record_wedding_payment: {
        Args: {
          p_amount: number
          p_item: string
          p_paid_from: Database["public"]["Enums"]["paid_from"]
          p_part: string
        }
        Returns: number
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
      request_unlink: {
        Args: { p_confirm: string; p_shares: Json }
        Returns: string
      }
      respond_proposal: {
        Args: {
          p_id: string
          p_response: Database["public"]["Enums"]["proposal_response"]
        }
        Returns: Database["public"]["Enums"]["proposal_status"]
      }
      rest_missed_months: { Args: { p_plans: string[] }; Returns: number }
      restore_trash: { Args: { p_id: string; p_kind: string }; Returns: string }
      run_access_expiry: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      run_unlink_deadlines: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      save_base_day: { Args: { p_after: Json }; Returns: undefined }
      save_family_budget: { Args: { p_after: Json }; Returns: undefined }
      save_split: {
        Args: { p_lines: Json; p_owner?: string }
        Returns: string
      }
      send_close_bundle: { Args: { p_close: string }; Returns: number }
      send_evening_notifications: {
        Args: { p_today?: string }
        Returns: number
      }
      send_living_check_notifications: {
        Args: { p_today?: string }
        Returns: number
      }
      send_morning_notifications: {
        Args: { p_today?: string }
        Returns: number
      }
      set_avatar: { Args: { p_path?: string }; Returns: undefined }
      set_checklist_done: {
        Args: { p_done: boolean; p_key: string }
        Returns: undefined
      }
      set_income_period: {
        Args: {
          p_amount: number
          p_end: string
          p_split_apply_on?: string
          p_start: string
          p_supplement: number
        }
        Returns: string
      }
      set_join_salary_mode: {
        Args: { p_mode: Database["public"]["Enums"]["salary_mode"] }
        Returns: undefined
      }
      set_living_check: { Args: { p_on: boolean }; Returns: undefined }
      set_my_side: {
        Args: { p_side: Database["public"]["Enums"]["couple_side"] }
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
      split_line_done: {
        Args: {
          l: Omit<
            Database["public"]["Tables"]["plan_line"]["Row"],
            Database["public"]["Tables"]["plan_line"]["ComputedFields"]
          >
        }
        Returns: boolean
      }
      start_checklist: { Args: { p_owner?: string }; Returns: string }
      start_first_plan: {
        Args: {
          p_cycle_end: string
          p_cycle_start: string
          p_first_adjust: number
          p_is_temp: boolean
          p_label_month: string
          p_lines: Json
          p_merged_close: boolean
          p_snapshot: Json
        }
        Returns: string
      }
      start_new_invite: { Args: Record<PropertyKey, never>; Returns: undefined }
      stop_access: { Args: { p_id: string }; Returns: undefined }
      sync_checklist: { Args: { p_split: string }; Returns: undefined }
      sync_wedding_care: { Args: { p_space: string }; Returns: undefined }
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
      uncheck_split: {
        Args: {
          p_line: string
          p_side: Database["public"]["Enums"]["couple_side"]
        }
        Returns: undefined
      }
      undo_emergency_move: { Args: { p_id: string }; Returns: undefined }
      undo_goal_move: { Args: { p_id: string }; Returns: undefined }
      undo_living_check: { Args: { p_id: string }; Returns: undefined }
      unlink_default_plan: {
        Args: { p_plan: Json; p_ratio: number }
        Returns: Json
      }
      unlink_make_space: {
        Args: {
          is_req: boolean
          plan: Json
          u: Omit<
            Database["public"]["Tables"]["couple_unlink"]["Row"],
            Database["public"]["Tables"]["couple_unlink"]["ComputedFields"]
          >
          x: string
        }
        Returns: string
      }
      unlink_partner_name: { Args: Record<PropertyKey, never>; Returns: string }
      unlink_ratio: { Args: { sid: string; uid: string }; Returns: number }
      unlink_share: { Args: { amount: number; pct: number }; Returns: number }
      update_pending_shares: {
        Args: { p_is_temp: boolean; p_plan_id: string; p_shares: Json }
        Returns: number
      }
      use_goal: {
        Args: {
          p_amount: number
          p_asset?: string
          p_goal: string
          p_held: number
          p_kind: string
          p_paid_from: Database["public"]["Enums"]["paid_from"]
          p_rest_goal?: string
        }
        Returns: Json
      }
      withdraw_proposal: {
        Args: { p_id: string }
        Returns: Database["public"]["Enums"]["proposal_status"]
      }
      won_band: { Args: { v: number }; Returns: string }
    }
    Enums: {
      account_mode: "single" | "roles"
      account_role: "living" | "goal_fund" | "emergency" | "personal" | "wedding"
      account_status: "active" | "deletion_requested" | "deleted"
      admin_role: "super" | "ops" | "cs" | "analyst"
      asset_owner: "joint" | "person"
      asset_side: "asset" | "debt"
      asset_status: "held" | "sold"
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
        "signup" | "prefill_review" | "care_day_first" | "settings" | "peer_stats_page"
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
      asset_status: ["held", "sold"],
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
      consent_source: ["signup", "prefill_review", "care_day_first", "settings", "peer_stats_page"],
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
