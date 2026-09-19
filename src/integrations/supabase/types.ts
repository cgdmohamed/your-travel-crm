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
      integration_config: {
        Row: {
          config: Json
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      meta_capi_events: {
        Row: {
          created_at: string
          currency: string
          customer_id: string | null
          customer_name: string | null
          error: string | null
          event_id: string
          event_name: string
          events_received: number | null
          id: string
          sent_by: string | null
          status: string
          test_event: boolean
          value: number | null
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          error?: string | null
          event_id: string
          event_name: string
          events_received?: number | null
          id?: string
          sent_by?: string | null
          status?: string
          test_event?: boolean
          value?: number | null
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string | null
          customer_name?: string | null
          error?: string | null
          event_id?: string
          event_name?: string
          events_received?: number | null
          id?: string
          sent_by?: string | null
          status?: string
          test_event?: boolean
          value?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          created_at: string
          customer_id: string | null
          direction: string
          error: string | null
          id: string
          phone: string
          sent_by: string | null
          status: string
          status_at: string | null
          template_name: string | null
          wa_message_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          direction: string
          error?: string | null
          id?: string
          phone: string
          sent_by?: string | null
          status?: string
          status_at?: string | null
          template_name?: string | null
          wa_message_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          customer_id?: string | null
          direction?: string
          error?: string | null
          id?: string
          phone?: string
          sent_by?: string | null
          status?: string
          status_at?: string | null
          template_name?: string | null
          wa_message_id?: string | null
        }
        Relationships: []
      }
      whatsapp_pending_statuses: {
        Row: {
          created_at: string
          error: string | null
          id: string
          status: string
          status_at: string
          wa_message_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          status: string
          status_at: string
          wa_message_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          status?: string
          status_at?: string
          wa_message_id?: string
        }
        Relationships: []
      }
      whatsapp_threads: {
        Row: {
          ai_confidence: number | null
          ai_intent: string
          ai_reason: string | null
          ai_updated_at: string | null
          archived: boolean
          contact_name: string | null
          created_at: string
          customer_id: string | null
          last_direction: string | null
          last_message: string | null
          last_message_at: string | null
          phone: string
          unread: number
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_intent?: string
          ai_reason?: string | null
          ai_updated_at?: string | null
          archived?: boolean
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          last_direction?: string | null
          last_message?: string | null
          last_message_at?: string | null
          phone: string
          unread?: number
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_intent?: string
          ai_reason?: string | null
          ai_updated_at?: string | null
          archived?: boolean
          contact_name?: string | null
          created_at?: string
          customer_id?: string | null
          last_direction?: string | null
          last_message?: string | null
          last_message_at?: string | null
          phone?: string
          unread?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          delivery_id: string
          event: string
          id: string
          next_attempt_at: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          attempts?: number
          delivery_id: string
          event: string
          id?: string
          next_attempt_at?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          attempts?: number
          delivery_id?: string
          event?: string
          id?: string
          next_attempt_at?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
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
    }
    Enums: {
      app_role: "admin" | "sales_manager" | "agent" | "accountant"
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
      app_role: ["admin", "sales_manager", "agent", "accountant"],
    },
  },
} as const
