-- =============================================
-- SHOPIFY IMPROVEMENTS: auto-sync, inventory, sync history, variants
-- =============================================

-- 1. Add auto-sync interval and OAuth credentials to sellers table
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS shopify_auto_sync_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_client_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_client_secret TEXT DEFAULT NULL;
-- shopify_auto_sync_interval values: NULL = disabled, 1, 6, 12, 24 (hours)
-- shopify_client_id + shopify_client_secret: for OAuth client_credentials flow (new Shopify Dev apps)

-- 2. Add inventory quantity to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_variant_title TEXT DEFAULT NULL;

-- 3. Create sync history table
CREATE TABLE IF NOT EXISTS public.shopify_sync_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  imported INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  total_shopify_products INTEGER NOT NULL DEFAULT 0,
  error_details JSONB DEFAULT '[]'::jsonb,
  trigger_type TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger_type IN ('manual', 'auto', 'connect'))
);

ALTER TABLE public.shopify_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own sync history"
  ON public.shopify_sync_history FOR SELECT
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert sync history"
  ON public.shopify_sync_history FOR INSERT
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_sync_history_seller
  ON public.shopify_sync_history (seller_id, synced_at DESC);
