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
      daily_guest_usage: {
        Row: {
          date: string
          total_duration_sec: number
          total_jobs: number
        }
        Insert: {
          date: string
          total_duration_sec?: number
          total_jobs?: number
        }
        Update: {
          date?: string
          total_duration_sec?: number
          total_jobs?: number
        }
        Relationships: []
      }
      job_events: {
        Row: {
          created_at: string
          id: string
          job_id: string
          payload: Json
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          payload?: Json
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          language: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          progress_percent: number
          queue_position: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          subtitle_storage_key: string | null
          user_id: string | null
          video_delete_at: string | null
          video_duration_sec: number
          video_original_name: string
          video_size_bytes: number
          video_storage_key: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          language?: string
          owner_id: string
          owner_type: Database["public"]["Enums"]["owner_type"]
          progress_percent?: number
          queue_position?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subtitle_storage_key?: string | null
          user_id?: string | null
          video_delete_at?: string | null
          video_duration_sec: number
          video_original_name: string
          video_size_bytes: number
          video_storage_key: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          language?: string
          owner_id?: string
          owner_type?: Database["public"]["Enums"]["owner_type"]
          progress_percent?: number
          queue_position?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          subtitle_storage_key?: string | null
          user_id?: string | null
          video_delete_at?: string | null
          video_duration_sec?: number
          video_original_name?: string
          video_size_bytes?: number
          video_storage_key?: string
        }
        Relationships: []
      }
      renders: {
        Row: {
          aspect: string
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          job_id: string
          output_delete_at: string | null
          output_storage_key: string | null
          progress_percent: number
          resolution: number
          status: string
          style: Json
          user_id: string | null
          watermark: boolean
        }
        Insert: {
          aspect?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id: string
          output_delete_at?: string | null
          output_storage_key?: string | null
          progress_percent?: number
          resolution?: number
          status?: string
          style: Json
          user_id?: string | null
          watermark?: boolean
        }
        Update: {
          aspect?: string
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          job_id?: string
          output_delete_at?: string | null
          output_storage_key?: string | null
          progress_percent?: number
          resolution?: number
          status?: string
          style?: Json
          user_id?: string | null
          watermark?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "renders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      share_links: {
        Row: {
          created_at: string
          expires_at: string | null
          hits: number
          id: string
          job_id: string
          revoked_at: string | null
          token: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          hits?: number
          id?: string
          job_id: string
          revoked_at?: string | null
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          hits?: number
          id?: string
          job_id?: string
          revoked_at?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string
          discord_dm_blocked: boolean
          discord_user_id: string | null
          discord_username: string | null
          is_pro: boolean
          notify_channel: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          discord_dm_blocked?: boolean
          discord_user_id?: string | null
          discord_username?: string | null
          is_pro?: boolean
          notify_channel?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          discord_dm_blocked?: boolean
          discord_user_id?: string | null
          discord_username?: string | null
          is_pro?: boolean
          notify_channel?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status:
        | "pending"
        | "uploading"
        | "queued"
        | "transcribing"
        | "finished"
        | "failed"
        | "cancelled"
      owner_type: "user" | "guest"
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
      job_status: [
        "pending",
        "uploading",
        "queued",
        "transcribing",
        "finished",
        "failed",
        "cancelled",
      ],
      owner_type: ["user", "guest"],
    },
  },
} as const
