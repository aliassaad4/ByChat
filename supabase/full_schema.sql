-- =============================================
-- FULL DATABASE SCHEMA FOR BYCHAT / INQUIRE SHOP
-- Run this in the Supabase SQL Editor (new project)
-- =============================================

-- ========== MIGRATION 1: Core tables ==========

-- Create enum for business types
CREATE TYPE public.business_type AS ENUM ('restaurant', 'grocery', 'clothing', 'electronics', 'beauty', 'services', 'other');

-- Create enum for delivery options
CREATE TYPE public.delivery_option AS ENUM ('pickup', 'delivery', 'both');

-- Create buyers table
CREATE TABLE public.buyers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    city_area TEXT NOT NULL,
    delivery_address TEXT NOT NULL,
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Create sellers table
CREATE TABLE public.sellers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    business_name TEXT NOT NULL,
    business_type business_type NOT NULL,
    business_description TEXT,
    city_area TEXT NOT NULL,
    business_address TEXT NOT NULL,
    working_hours_open TIME NOT NULL,
    working_hours_close TIME NOT NULL,
    delivery_option delivery_option NOT NULL,
    accepts_cash BOOLEAN NOT NULL DEFAULT false,
    accepts_card BOOLEAN NOT NULL DEFAULT false,
    accepts_omt BOOLEAN NOT NULL DEFAULT false,
    accepts_whish BOOLEAN NOT NULL DEFAULT false,
    whatsapp_number TEXT NOT NULL,
    instagram_handle TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buyers
CREATE POLICY "Users can view their own buyer profile"
ON public.buyers FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own buyer profile"
ON public.buyers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own buyer profile"
ON public.buyers FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for sellers
CREATE POLICY "Users can view their own seller profile"
ON public.sellers FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own seller profile"
ON public.sellers FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own seller profile"
ON public.sellers FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view seller profiles"
ON public.sellers FOR SELECT USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_buyers_updated_at
BEFORE UPDATE ON public.buyers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sellers_updated_at
BEFORE UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== MIGRATION 2: Products & Orders ==========

-- Products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can manage their own products" ON public.products FOR ALL USING (
  seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

CREATE POLICY "Anyone can view available products" ON public.products FOR SELECT USING (is_available = true);

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Order status enum
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'preparing', 'delivered', 'cancelled');

-- Orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  status public.order_status NOT NULL DEFAULT 'pending',
  buyer_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their orders" ON public.orders FOR SELECT USING (
  seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

CREATE POLICY "Sellers can update their orders" ON public.orders FOR UPDATE USING (
  seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

CREATE POLICY "Buyers can view their orders" ON public.orders FOR SELECT USING (
  buyer_id IN (SELECT id FROM public.buyers WHERE user_id = auth.uid())
);

CREATE POLICY "Buyers can create orders" ON public.orders FOR INSERT WITH CHECK (
  buyer_id IN (SELECT id FROM public.buyers WHERE user_id = auth.uid())
);

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== MIGRATION 3: AI Agent Config ==========

CREATE TABLE public.ai_agent_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  store_description TEXT DEFAULT '',
  faq JSONB DEFAULT '[]'::jsonb,
  return_policy TEXT DEFAULT '',
  delivery_time_estimate TEXT DEFAULT '',
  minimum_order_amount NUMERIC DEFAULT 0,
  special_instructions TEXT DEFAULT '',
  agent_name TEXT DEFAULT 'Shopping Assistant',
  tone TEXT DEFAULT 'friendly' CHECK (tone IN ('professional', 'friendly', 'casual')),
  language TEXT DEFAULT 'both' CHECK (language IN ('arabic', 'english', 'both')),
  auto_greeting TEXT DEFAULT 'Hi! Welcome to our store 👋 How can I help you today?',
  can_take_orders BOOLEAN DEFAULT true,
  can_give_quotes BOOLEAN DEFAULT true,
  collect_delivery_address BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id)
);

ALTER TABLE public.ai_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own ai config"
  ON public.ai_agent_config FOR SELECT
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Sellers can insert their own ai config"
  ON public.ai_agent_config FOR INSERT
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Sellers can update their own ai config"
  ON public.ai_agent_config FOR UPDATE
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE TRIGGER update_ai_agent_config_updated_at
  BEFORE UPDATE ON public.ai_agent_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ========== STORAGE: Product Images Bucket ==========

INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true);

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Allow anyone to view product images
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

-- Allow users to update their own images
CREATE POLICY "Users can update their own product images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'product-images');

-- Allow users to delete their own images
CREATE POLICY "Users can delete their own product images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'product-images');

-- ========== SHOPIFY INTEGRATION ==========

-- Add Shopify connection fields to sellers table
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS shopify_store_url TEXT,
  ADD COLUMN IF NOT EXISTS shopify_access_token TEXT,
  ADD COLUMN IF NOT EXISTS shopify_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shopify_last_sync_at TIMESTAMPTZ;

-- Add source tracking fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT,
  ADD COLUMN IF NOT EXISTS shopify_variant_id TEXT;

ALTER TABLE public.products
  ADD CONSTRAINT products_source_check CHECK (source IN ('manual', 'shopify'));

CREATE INDEX IF NOT EXISTS idx_products_shopify_product_id
  ON public.products (shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_source
  ON public.products (seller_id, source);
