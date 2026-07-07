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
      rv_affiliate_sale_signals: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          loja_id: string
          note: string | null
          status: string
          vehicle_id: number | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          loja_id: string
          note?: string | null
          status?: string
          vehicle_id?: number | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          loja_id?: string
          note?: string | null
          status?: string
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_affiliate_sale_signals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_affiliate_sale_signals_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_affiliate_sale_signals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "rv_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_buyers: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rv_charges: {
        Row: {
          asaas_id: string | null
          asaas_subscription_id: string | null
          billing_type: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          invoice_url: string | null
          plan_id: string | null
          seller_id: string
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          plan_id?: string | null
          seller_id: string
          status?: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_id?: string | null
          asaas_subscription_id?: string | null
          billing_type?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          invoice_url?: string | null
          plan_id?: string | null
          seller_id?: string
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rv_charges_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "rv_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_charges_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_click_events: {
        Row: {
          affiliate_id: string | null
          buyer_id: string | null
          created_at: string
          id: number
          kind: string
          seller_id: string
          vehicle_id: number | null
        }
        Insert: {
          affiliate_id?: string | null
          buyer_id?: string | null
          created_at?: string
          id?: never
          kind: string
          seller_id: string
          vehicle_id?: number | null
        }
        Update: {
          affiliate_id?: string | null
          buyer_id?: string | null
          created_at?: string
          id?: never
          kind?: string
          seller_id?: string
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_click_events_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_click_events_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "rv_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_click_events_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_click_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "rv_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_commissions: {
        Row: {
          affiliate_id: string | null
          amount: number
          created_at: string
          due_date: string | null
          id: string
          paid_at: string | null
          rate: number
          sale_id: string
          seller_id: string
          status: Database["public"]["Enums"]["commission_status"]
          vendedor_id: string
        }
        Insert: {
          affiliate_id?: string | null
          amount: number
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          rate: number
          sale_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          vendedor_id: string
        }
        Update: {
          affiliate_id?: string | null
          amount?: number
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          rate?: number
          sale_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_commissions_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: true
            referencedRelation: "rv_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_commissions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_commissions_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_leads: {
        Row: {
          buyer_id: string | null
          city: string | null
          created_at: string
          email: string | null
          financing: boolean
          id: string
          message: string | null
          name: string
          phone: string | null
          seller_id: string
          stage: Database["public"]["Enums"]["lead_stage"]
          updated_at: string
          vehicle_id: number | null
        }
        Insert: {
          buyer_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          financing?: boolean
          id?: string
          message?: string | null
          name: string
          phone?: string | null
          seller_id: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          vehicle_id?: number | null
        }
        Update: {
          buyer_id?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          financing?: boolean
          id?: string
          message?: string | null
          name?: string
          phone?: string | null
          seller_id?: string
          stage?: Database["public"]["Enums"]["lead_stage"]
          updated_at?: string
          vehicle_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_leads_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "rv_buyers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_leads_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_leads_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "rv_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_pending_signups: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          city: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string
          id: string
          invoice_url: string | null
          name: string
          phone: string | null
          plan_cycle: string | null
          pricing_plan_key: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email: string
          id?: string
          invoice_url?: string | null
          name: string
          phone?: string | null
          plan_cycle?: string | null
          pricing_plan_key: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          city?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string
          id?: string
          invoice_url?: string | null
          name?: string
          phone?: string | null
          plan_cycle?: string | null
          pricing_plan_key?: string
        }
        Relationships: []
      }
      rv_plan_items: {
        Row: {
          billing_type: Database["public"]["Enums"]["plan_billing_type"]
          created_at: string
          id: string
          label: string
          plan_id: string
          value: number
        }
        Insert: {
          billing_type: Database["public"]["Enums"]["plan_billing_type"]
          created_at?: string
          id?: string
          label: string
          plan_id: string
          value: number
        }
        Update: {
          billing_type?: Database["public"]["Enums"]["plan_billing_type"]
          created_at?: string
          id?: string
          label?: string
          plan_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "rv_plan_items_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "rv_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_plans: {
        Row: {
          active: boolean
          asaas_subscription_id: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          asaas_subscription_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          asaas_subscription_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_plans_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: true
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_pricing_plans: {
        Row: {
          active: boolean
          affiliates_enabled: boolean
          color: string
          created_at: string
          cta_label: string
          highlights: string[]
          id: string
          key: string
          name: string
          popular: boolean
          price_annual: number
          price_monthly: number
          sort_order: number
          tagline: string | null
          trial_days: number
          updated_at: string
          vehicle_limit: number | null
        }
        Insert: {
          active?: boolean
          affiliates_enabled?: boolean
          color?: string
          created_at?: string
          cta_label?: string
          highlights?: string[]
          id?: string
          key: string
          name: string
          popular?: boolean
          price_annual: number
          price_monthly: number
          sort_order?: number
          tagline?: string | null
          trial_days?: number
          updated_at?: string
          vehicle_limit?: number | null
        }
        Update: {
          active?: boolean
          affiliates_enabled?: boolean
          color?: string
          created_at?: string
          cta_label?: string
          highlights?: string[]
          id?: string
          key?: string
          name?: string
          popular?: boolean
          price_annual?: number
          price_monthly?: number
          sort_order?: number
          tagline?: string | null
          trial_days?: number
          updated_at?: string
          vehicle_limit?: number | null
        }
        Relationships: []
      }
      rv_sales: {
        Row: {
          affiliate_id: string | null
          buyer_name: string
          buyer_phone: string | null
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_date: string
          sale_price: number
          sale_reason: string | null
          seller_id: string
          vehicle_id: number
          vendedor_id: string
        }
        Insert: {
          affiliate_id?: string | null
          buyer_name: string
          buyer_phone?: string | null
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          sale_date?: string
          sale_price: number
          sale_reason?: string | null
          seller_id: string
          vehicle_id: number
          vendedor_id: string
        }
        Update: {
          affiliate_id?: string | null
          buyer_name?: string
          buyer_phone?: string | null
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          sale_date?: string
          sale_price?: number
          sale_reason?: string | null
          seller_id?: string
          vehicle_id?: number
          vendedor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rv_sales_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_sales_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_sales_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "rv_vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_sales_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_sellers: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          city: string | null
          commission_rate: number
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          id: string
          instagram: string | null
          name: string
          parent_id: string | null
          phone: string | null
          plan_cycle: string | null
          pricing_plan_key: string | null
          ref_code: string | null
          role: Database["public"]["Enums"]["app_role"]
          slug: string | null
          state: string | null
          status: Database["public"]["Enums"]["seller_status"]
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          commission_rate?: number
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          name: string
          parent_id?: string | null
          phone?: string | null
          plan_cycle?: string | null
          pricing_plan_key?: string | null
          ref_code?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          city?: string | null
          commission_rate?: number
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          id?: string
          instagram?: string | null
          name?: string
          parent_id?: string | null
          phone?: string | null
          plan_cycle?: string | null
          pricing_plan_key?: string | null
          ref_code?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          slug?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["seller_status"]
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_sellers_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_sellers_pricing_plan_key_fkey"
            columns: ["pricing_plan_key"]
            isOneToOne: false
            referencedRelation: "rv_pricing_plans"
            referencedColumns: ["key"]
          },
        ]
      }
      rv_site_settings: {
        Row: {
          home_banner_url: string | null
          id: number
          updated_at: string
        }
        Insert: {
          home_banner_url?: string | null
          id?: number
          updated_at?: string
        }
        Update: {
          home_banner_url?: string | null
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      rv_vehicle_owners: {
        Row: {
          owner_name: string | null
          owner_phone: string | null
          updated_at: string
          vehicle_id: number
        }
        Insert: {
          owner_name?: string | null
          owner_phone?: string | null
          updated_at?: string
          vehicle_id: number
        }
        Update: {
          owner_name?: string | null
          owner_phone?: string | null
          updated_at?: string
          vehicle_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rv_vehicle_owners_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "rv_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      rv_vehicles: {
        Row: {
          armored: boolean
          blocked: boolean
          body_type: Database["public"]["Enums"]["vehicle_body_type"] | null
          clicks: number
          color: string | null
          created_at: string
          description: string | null
          documentacao: string | null
          featured: boolean
          fipe_price: number | null
          fuel: Database["public"]["Enums"]["fuel_type"] | null
          garantia: string | null
          id: number
          images: string[]
          ipva: string | null
          leilao: boolean | null
          make: string
          mileage: number | null
          model: string
          options: string[]
          origem: string | null
          price: number
          primeiro_dono: boolean | null
          removal_reason: string | null
          removed_at: string | null
          removed_by: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["vehicle_status"]
          transmission: Database["public"]["Enums"]["transmission_type"] | null
          updated_at: string
          vendedor_id: string | null
          year: number | null
        }
        Insert: {
          armored?: boolean
          blocked?: boolean
          body_type?: Database["public"]["Enums"]["vehicle_body_type"] | null
          clicks?: number
          color?: string | null
          created_at?: string
          description?: string | null
          documentacao?: string | null
          featured?: boolean
          fipe_price?: number | null
          fuel?: Database["public"]["Enums"]["fuel_type"] | null
          garantia?: string | null
          id?: never
          images?: string[]
          ipva?: string | null
          leilao?: boolean | null
          make: string
          mileage?: number | null
          model: string
          options?: string[]
          origem?: string | null
          price: number
          primeiro_dono?: boolean | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          updated_at?: string
          vendedor_id?: string | null
          year?: number | null
        }
        Update: {
          armored?: boolean
          blocked?: boolean
          body_type?: Database["public"]["Enums"]["vehicle_body_type"] | null
          clicks?: number
          color?: string | null
          created_at?: string
          description?: string | null
          documentacao?: string | null
          featured?: boolean
          fipe_price?: number | null
          fuel?: Database["public"]["Enums"]["fuel_type"] | null
          garantia?: string | null
          id?: never
          images?: string[]
          ipva?: string | null
          leilao?: boolean | null
          make?: string
          mileage?: number | null
          model?: string
          options?: string[]
          origem?: string | null
          price?: number
          primeiro_dono?: boolean | null
          removal_reason?: string | null
          removed_at?: string | null
          removed_by?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["vehicle_status"]
          transmission?: Database["public"]["Enums"]["transmission_type"] | null
          updated_at?: string
          vendedor_id?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rv_vehicles_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rv_vehicles_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "rv_sellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_store: { Args: { p_seller_id: string }; Returns: undefined }
      current_loja: { Args: never; Returns: string }
      current_person: { Args: never; Returns: string }
      increment_vehicle_clicks: { Args: { p_id: number }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      is_loja_manager: { Args: never; Returns: boolean }
      log_affiliate_share: {
        Args: { p_vehicle_id: number }
        Returns: undefined
      }
      log_affiliate_visit: {
        Args: { p_ref_code: string; p_vehicle_id?: number }
        Returns: undefined
      }
      log_click_event: {
        Args: { p_kind: string; p_seller_id: string; p_vehicle_id?: number }
        Returns: undefined
      }
      mark_commission_paid: {
        Args: { p_commission_id: string }
        Returns: undefined
      }
      mark_commission_pending: {
        Args: { p_commission_id: string }
        Returns: undefined
      }
      mark_overdue_commissions: { Args: never; Returns: number }
      register_sale: {
        Args: {
          p_affiliate_id?: string
          p_buyer_name: string
          p_buyer_phone?: string
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_sale_date?: string
          p_sale_price: number
          p_sale_reason?: string
          p_vehicle_id: number
          p_vendedor_id: string
        }
        Returns: string
      }
      signal_affiliate_sale: {
        Args: { p_note?: string; p_vehicle_id?: number }
        Returns: string
      }
      suggest_affiliate_for_sale: {
        Args: { p_buyer_phone: string; p_vehicle_id: number }
        Returns: {
          affiliate_id: string
          affiliate_name: string
        }[]
      }
    }
    Enums: {
      app_role: "garagista" | "admin" | "vendedor" | "afiliado"
      commission_status: "pending" | "paid" | "overdue"
      fuel_type:
        | "flex"
        | "gasolina"
        | "diesel"
        | "etanol"
        | "hibrido"
        | "eletrico"
        | "gnv"
      lead_stage: "novo" | "em_contato" | "negociando" | "ganho" | "perdido"
      payment_method: "pix" | "financiamento" | "a_vista"
      plan_billing_type:
        | "mensal"
        | "por_anuncio"
        | "percentual_venda"
        | "taxa_unica"
      seller_status: "pending" | "active" | "suspended"
      transmission_type: "manual" | "automatico" | "automatizado" | "cvt"
      vehicle_body_type:
        | "hatch"
        | "sedan"
        | "suv"
        | "picape"
        | "utilitario"
        | "cupe"
        | "conversivel"
        | "minivan"
      vehicle_status: "available" | "reserved" | "sold" | "removed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      iceberg_namespaces: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          metadata: Json
          name: string
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
        ]
      }
      iceberg_tables: {
        Row: {
          bucket_name: string
          catalog_id: string
          created_at: string
          id: string
          location: string
          name: string
          namespace_id: string
          remote_table_id: string | null
          shard_id: string | null
          shard_key: string | null
          updated_at: string
        }
        Insert: {
          bucket_name: string
          catalog_id: string
          created_at?: string
          id?: string
          location: string
          name: string
          namespace_id: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Update: {
          bucket_name?: string
          catalog_id?: string
          created_at?: string
          id?: string
          location?: string
          name?: string
          namespace_id?: string
          remote_table_id?: string | null
          shard_id?: string | null
          shard_key?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "iceberg_tables_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "buckets_analytics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "iceberg_tables_namespace_id_fkey"
            columns: ["namespace_id"]
            isOneToOne: false
            referencedRelation: "iceberg_namespaces"
            referencedColumns: ["id"]
          },
        ]
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          bucket_id: string | null
          created_at: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: never
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          levels?: number
          limits?: number
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          created_at: string
          id: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          levels?: number
          limits?: number
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
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
      app_role: ["garagista", "admin", "vendedor", "afiliado"],
      commission_status: ["pending", "paid", "overdue"],
      fuel_type: [
        "flex",
        "gasolina",
        "diesel",
        "etanol",
        "hibrido",
        "eletrico",
        "gnv",
      ],
      lead_stage: ["novo", "em_contato", "negociando", "ganho", "perdido"],
      payment_method: ["pix", "financiamento", "a_vista"],
      plan_billing_type: [
        "mensal",
        "por_anuncio",
        "percentual_venda",
        "taxa_unica",
      ],
      seller_status: ["pending", "active", "suspended"],
      transmission_type: ["manual", "automatico", "automatizado", "cvt"],
      vehicle_body_type: [
        "hatch",
        "sedan",
        "suv",
        "picape",
        "utilitario",
        "cupe",
        "conversivel",
        "minivan",
      ],
      vehicle_status: ["available", "reserved", "sold", "removed"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const

