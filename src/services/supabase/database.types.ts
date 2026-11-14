export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action_title: string
          event_type: string
          id: string
          occurred_at: string
          plan_date: string
          planned_action_id: string | null
          scheduled_end_at: string
          scheduled_start_at: string
          task_id: string | null
          timezone: string
          user_id: string
        }
        Insert: {
          action_title: string
          event_type: string
          id?: string
          occurred_at?: string
          plan_date: string
          planned_action_id?: string | null
          scheduled_end_at: string
          scheduled_start_at: string
          task_id?: string | null
          timezone: string
          user_id: string
        }
        Update: {
          action_title?: string
          event_type?: string
          id?: string
          occurred_at?: string
          plan_date?: string
          planned_action_id?: string | null
          scheduled_end_at?: string
          scheduled_start_at?: string
          task_id?: string | null
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_buffer_overrides: {
        Row: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_id: string
          created_at: string
          event_id: string
          occurrence_start_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_after_minutes: number
          buffer_before_minutes: number
          calendar_id: string
          created_at?: string
          event_id: string
          occurrence_start_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          calendar_id?: string
          created_at?: string
          event_id?: string
          occurrence_start_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_buffer_overrides_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_plans: {
        Row: {
          created_at: string
          id: string
          plan_date: string
          summary: string | null
          timezone: string
          updated_at: string
          user_id: string
          window_end_at: string | null
          window_start_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          plan_date: string
          summary?: string | null
          timezone: string
          updated_at?: string
          user_id: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          plan_date?: string
          summary?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
          window_end_at?: string | null
          window_start_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_value: number | null
          deadline: string | null
          description: string | null
          id: string
          priority: string
          status: string
          target_value: number | null
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority: string
          status: string
          target_value?: number | null
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number | null
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          status?: string
          target_value?: number | null
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_actions: {
        Row: {
          created_at: string
          daily_plan_id: string
          end_at: string
          id: string
          reason: string | null
          start_at: string
          status: string
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_plan_id: string
          end_at: string
          id?: string
          reason?: string | null
          start_at: string
          status?: string
          task_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_plan_id?: string
          end_at?: string
          id?: string
          reason?: string | null
          start_at?: string
          status?: string
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_actions_daily_plan_owner_fkey"
            columns: ["daily_plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "daily_plans"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planned_actions_task_owner_fkey"
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "planned_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          calendar_buffer_after_minutes: number
          calendar_buffer_before_minutes: number
          created_at: string
          display_name: string | null
          id: string
          minimum_free_minutes: number
          planning_end: string
          planning_end_day_offset: number
          planning_start: string
          timezone: string
          updated_at: string
          v2_task_gap_minutes: number
        }
        Insert: {
          calendar_buffer_after_minutes?: number
          calendar_buffer_before_minutes?: number
          created_at?: string
          display_name?: string | null
          id: string
          minimum_free_minutes?: number
          planning_end?: string
          planning_end_day_offset?: number
          planning_start?: string
          timezone?: string
          updated_at?: string
          v2_task_gap_minutes?: number
        }
        Update: {
          calendar_buffer_after_minutes?: number
          calendar_buffer_before_minutes?: number
          created_at?: string
          display_name?: string | null
          id?: string
          minimum_free_minutes?: number
          planning_end?: string
          planning_end_day_offset?: number
          planning_start?: string
          timezone?: string
          updated_at?: string
          v2_task_gap_minutes?: number
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          deadline: string | null
          deadline_local: string | null
          estimated_minutes: number
          goal_id: string | null
          id: string
          priority: string
          recurrence: string
          recurrence_days: number[]
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          deadline_local?: string | null
          estimated_minutes: number
          goal_id?: string | null
          id?: string
          priority: string
          recurrence?: string
          recurrence_days?: number[]
          status: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          deadline_local?: string | null
          estimated_minutes?: number
          goal_id?: string | null
          id?: string
          priority?: string
          recurrence?: string
          recurrence_days?: number[]
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_goal_owner_fkey"
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "tasks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_ai_usage: {
        Row: {
          cost_micros: number | null
          created_at: string
          id: string
          input_tokens: number | null
          model: string
          month: string
          output_tokens: number | null
          reserved_micros: number
          result: string
          user_id: string
        }
        Insert: {
          cost_micros?: number | null
          created_at?: string
          id: string
          input_tokens?: number | null
          model: string
          month: string
          output_tokens?: number | null
          reserved_micros: number
          result?: string
          user_id: string
        }
        Update: {
          cost_micros?: number | null
          created_at?: string
          id?: string
          input_tokens?: number | null
          model?: string
          month?: string
          output_tokens?: number | null
          reserved_micros?: number
          result?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_ai_usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_drafts: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          items: Json
          revision: string
          thread_id: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          items: Json
          revision?: string
          thread_id: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          items?: Json
          revision?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_drafts_thread_id_user_id_fkey"
            columns: ["thread_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v2_threads"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "v2_drafts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_events: {
        Row: {
          duration_minutes: number | null
          end_at: string
          id: string
          kind: string
          plan_date: string
          start_at: string
          title: string
          travel_after: number
          travel_before: number
          user_id: string
        }
        Insert: {
          duration_minutes?: number | null
          end_at: string
          id?: string
          kind: string
          plan_date: string
          start_at: string
          title: string
          travel_after?: number
          travel_before?: number
          user_id?: string
        }
        Update: {
          duration_minutes?: number | null
          end_at?: string
          id?: string
          kind?: string
          plan_date?: string
          start_at?: string
          title?: string
          travel_after?: number
          travel_before?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_messages_thread_id_user_id_fkey"
            columns: ["thread_id", "user_id"]
            isOneToOne: false
            referencedRelation: "v2_threads"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "v2_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_plans: {
        Row: {
          plan_date: string
          revision: string
          state: Json
          user_id: string
        }
        Insert: {
          plan_date: string
          revision?: string
          state: Json
          user_id: string
        }
        Update: {
          plan_date?: string
          revision?: string
          state?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v2_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "v2_threads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_daily_plan_snapshot: { Args: { p_plan_date: string }; Returns: Json }
      planning_date: {
        Args: {
          p_end: string
          p_now: string
          p_offset: number
          p_start: string
          p_timezone: string
        }
        Returns: string
      }
      planning_instant: {
        Args: { p_local: string; p_timezone: string }
        Returns: string
      }
      replace_daily_plan:
        | {
            Args: {
              p_actions: Json
              p_plan_date: string
              p_summary: string
              p_timezone: string
            }
            Returns: {
              daily_plan_id: string
              saved_action_count: number
            }[]
          }
        | {
            Args: {
              p_actions: Json
              p_plan_date: string
              p_planning_window: Json
              p_summary: string
              p_timezone: string
            }
            Returns: {
              daily_plan_id: string
              saved_action_count: number
            }[]
          }
      replace_daily_plan_if_current:
        | {
            Args: {
              p_actions: Json
              p_expected_snapshot: Json
              p_plan_date: string
              p_summary: string
              p_timezone: string
            }
            Returns: {
              daily_plan_id: string
              saved_action_count: number
            }[]
          }
        | {
            Args: {
              p_actions: Json
              p_expected_snapshot: Json
              p_plan_date: string
              p_planning_window: Json
              p_summary: string
              p_timezone: string
            }
            Returns: {
              daily_plan_id: string
              saved_action_count: number
            }[]
          }
      update_planned_action_status: {
        Args: { p_action_id: string; p_target_status: string }
        Returns: {
          action_id: string
          action_status: string
        }[]
      }
      v2_ai_month_usage: { Args: { p_month: string }; Returns: number }
      v2_approve_draft: {
        Args: { p_id: string; p_revision: string; p_selected: string[] }
        Returns: boolean
      }
      v2_edit_draft: {
        Args: { p_id: string; p_items: Json; p_revision: string }
        Returns: string
      }
      v2_finish_ai: {
        Args: {
          p_cost: number
          p_id: string
          p_input: number
          p_items: Json
          p_output: number
          p_reply: string
          p_thread: string
          p_user: string
        }
        Returns: undefined
      }
      v2_plan_source: { Args: { p_date: string }; Returns: string }
      v2_reserve_ai: {
        Args: {
          p_amount: number
          p_id: string
          p_model: string
          p_prompt: string
          p_thread: string
          p_user: string
        }
        Returns: boolean
      }
      v2_save_plan: {
        Args: {
          p_date: string
          p_expected_revision: string
          p_source: string
          p_state: Json
        }
        Returns: string
      }
      v2_unique_weekdays: { Args: { days: number[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
