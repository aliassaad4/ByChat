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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_agent_config: {
        Row: {
          agent_name: string | null
          auto_greeting: string | null
          can_give_quotes: boolean | null
          can_take_orders: boolean | null
          collect_delivery_address: boolean | null
          created_at: string
          delivery_time_estimate: string | null
          faq: Json | null
          id: string
          language: string | null
          minimum_order_amount: number | null
          return_policy: string | null
          seller_id: string
          special_instructions: string | null
          store_description: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          agent_name?: string | null
          auto_greeting?: string | null
          can_give_quotes?: boolean | null
          can_take_orders?: boolean | null
          collect_delivery_address?: boolean | null
          created_at?: string
          delivery_time_estimate?: string | null
          faq?: Json | null
          id?: string
          language?: string | null
          minimum_order_amount?: number | null
          return_policy?: string | null
          seller_id: string
          special_instructions?: string | null
          store_description?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          agent_name?: string | null
          auto_greeting?: string | null
          can_give_quotes?: boolean | null
          can_take_orders?: boolean | null
          collect_delivery_address?: boolean | null
          created_at?: string
          delivery_time_estimate?: string | null
          faq?: Json | null
          id?: string
          language?: string | null
          minimum_order_amount?: number | null
          return_policy?: string | null
          seller_id?: string
          special_instructions?: string | null
          store_description?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      buyers: {
        Row: {
          city_area: string
          created_at: string
          delivery_address: string
          full_name: string
          id: string
          phone_number: string
          preferred_language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          city_area: string
          created_at?: string
          delivery_address: string
          full_name: string
          id?: string
          phone_number: string
          preferred_language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          city_area?: string
          created_at?: string
          delivery_address?: string
          full_name?: string
          id?: string
          phone_number?: string
          preferred_language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          buyer_id: string
          buyer_name: string
          created_at: string
          id: string
          items: Json
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          buyer_name: string
          created_at?: string
          id?: string
          items?: Json
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          buyer_name?: string
          created_at?: string
          id?: string
          items?: Json
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          image_urls: string[]
          is_available: boolean
          name: string
          price: number
          seller_id: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          is_available?: boolean
          name: string
          price?: number
          seller_id: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          image_urls?: string[]
          is_available?: boolean
          name?: string
          price?: number
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      sellers: {
        Row: {
          accepts_card: boolean
          accepts_cash: boolean
          accepts_omt: boolean
          accepts_whish: boolean
          business_address: string
          business_description: string | null
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          city_area: string
          created_at: string
          delivery_option: Database["public"]["Enums"]["delivery_option"]
          full_name: string
          id: string
          instagram_handle: string | null
          phone_number: string
          updated_at: string
          user_id: string
          whatsapp_number: string
          whatsapp_connected: boolean
          whatsapp_phone_number: string | null
          whatsapp_phone_id: string | null
          whatsapp_waba_id: string | null
          whatsapp_access_token: string | null
          working_hours_close: string
          working_hours_open: string
        }
        Insert: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_omt?: boolean
          accepts_whish?: boolean
          business_address: string
          business_description?: string | null
          business_name: string
          business_type: Database["public"]["Enums"]["business_type"]
          city_area: string
          created_at?: string
          delivery_option: Database["public"]["Enums"]["delivery_option"]
          full_name: string
          id?: string
          instagram_handle?: string | null
          phone_number: string
          updated_at?: string
          user_id: string
          whatsapp_number: string
          whatsapp_connected?: boolean
          whatsapp_phone_number?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_waba_id?: string | null
          whatsapp_access_token?: string | null
          working_hours_close: string
          working_hours_open: string
        }
        Update: {
          accepts_card?: boolean
          accepts_cash?: boolean
          accepts_omt?: boolean
          accepts_whish?: boolean
          business_address?: string
          business_description?: string | null
          business_name?: string
          business_type?: Database["public"]["Enums"]["business_type"]
          city_area?: string
          created_at?: string
          delivery_option?: Database["public"]["Enums"]["delivery_option"]
          full_name?: string
          id?: string
          instagram_handle?: string | null
          phone_number?: string
          updated_at?: string
          user_id?: string
          whatsapp_number?: string
          whatsapp_connected?: boolean
          whatsapp_phone_number?: string | null
          whatsapp_phone_id?: string | null
          whatsapp_waba_id?: string | null
          whatsapp_access_token?: string | null
          working_hours_close?: string
          working_hours_open?: string
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
      business_type:
        | "restaurant"
        | "grocery"
        | "clothing"
        | "electronics"
        | "beauty"
        | "services"
        | "other"
      delivery_option: "pickup" | "delivery" | "both"
      order_status:
        | "pending"
        | "confirmed"
        | "preparing"
        | "delivered"
        | "cancelled"
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
      business_type: [
        "restaurant",
        "grocery",
        "clothing",
        "electronics",
        "beauty",
        "services",
        "other",
      ],
      delivery_option: ["pickup", "delivery", "both"],
      order_status: [
        "pending",
        "confirmed",
        "preparing",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const
