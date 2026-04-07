# Shopify Integration - Hussein's Work Summary for Ali

---

## WHAT WE HAD BEFORE

The Shopify integration had these basic features:
- Seller enters store URL + a static `shpat_` access token
- Edge function fetches products from Shopify REST API
- Products are imported into our `products` table with `source: "shopify"`
- Seller can click "Sync Now" to re-import
- Seller can disconnect Shopify
- Token validation (detects wrong token types like shpss_)
- URL cleaning (accepts various Shopify URL formats)

**Limitations:**
- No product images imported from Shopify
- Only 1 variant per product imported (ignoring sizes, colors, etc.)
- No inventory/stock tracking
- No sync history — no record of what happened in past syncs
- No auto-sync — seller must manually click "Sync Now" every time
- No error details — just a count of errors with no info on which products failed
- Only supports legacy Custom App tokens (shpat_), not the new Shopify Dev Dashboard OAuth flow
- No way to push price changes back to Shopify (one-way only)

---

## WHAT WE BUILT / CHANGED

### Files Modified:

**1. `src/pages/seller/SellerShopify.tsx`** (Frontend - Main Shopify page)
- Added **dual authentication**: sellers can now connect using either:
  - **Client ID + Client Secret** (new Shopify Dev Dashboard apps — recommended, tokens auto-refresh)
  - **Access Token** (legacy Custom Apps — static shpat_ token)
- Added **Auto-Sync Schedule** card with options: Off, 1h, 6h, 12h, 24h
- Added **Sync History** section showing last 5 syncs with date, counts, and trigger type
- Added **Error Details** — expandable list showing exactly which products failed and why
- Added **Retry Failed Products** button
- Added **rate limit error handling** — friendly message when Shopify's 2 req/sec limit is hit
- Updated Step 4 in setup guide to mention `write_products` and `read_inventory` scopes

**2. `src/pages/seller/SellerProducts.tsx`** (Frontend - Products page)
- Added `quantity` and `shopify_variant_title` to Product type
- Added **stock badges** on product cards: green "X in stock" or red "Out of stock"

**3. `src/integrations/supabase/types.ts`** (TypeScript types)
- Added to `sellers`: `shopify_auto_sync_interval`, `shopify_client_id`, `shopify_client_secret`
- Added to `products`: `quantity`, `shopify_variant_title`
- Added new table type: `shopify_sync_history`

**4. `supabase/full_schema.sql`** (Full schema reference)
- Added new columns and table definitions at the bottom

### Files Created:

**5. `supabase/migrations/20260404120000_shopify_improvements.sql`** (DB Migration)
- Adds `shopify_auto_sync_interval`, `shopify_client_id`, `shopify_client_secret` to `sellers`
- Adds `quantity`, `shopify_variant_title` to `products`
- Creates `shopify_sync_history` table with RLS policies

**6. `supabase/functions/shopify-sync/index.ts`** (Edge Function - complete rewrite)
- **OAuth token exchange**: exchanges client_id + client_secret for a short-lived shpat_ token on every request (tokens expire every 24h, this handles it automatically)
- **Backward compatible**: still works with static shpat_ tokens from legacy Custom Apps
- **Image sync**: imports all product images from Shopify's `product.images` array into `image_urls`
- **Variant support**: imports ALL variants as separate products (e.g., "Cotton T-Shirt - Small", "Cotton T-Shirt - Large")
- **Inventory sync**: imports `inventory_quantity`, auto-sets `is_available = false` when stock = 0
- **Deleted product detection**: if a product is removed from Shopify, marks it unavailable in ByChat on next sync
- **Sync history**: saves every sync result to `shopify_sync_history` table
- **Error details**: tracks which specific products failed with the exact error message
- **New actions**:
  - `update-auto-sync` — saves auto-sync interval preference
  - `push-price` — pushes a price change from ByChat back to Shopify (two-way sync)
  - `retry-failed` — re-runs a full sync to retry failed products

**7. `DEPLOY_INSTRUCTIONS_FOR_ALI.md`** (this file)

**8. `shopify-app-config/shopify.app.toml`** (temporary, can be deleted)
- Used to deploy Shopify app scopes via Shopify CLI during testing

---

## WHAT ALI NEEDS TO DO

### Step 1: Run the Database Migration

Go to **Supabase Dashboard** → **SQL Editor** → paste and run this:

```sql
-- 1. Add new columns to sellers table
ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS shopify_auto_sync_interval INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_client_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS shopify_client_secret TEXT DEFAULT NULL;

-- 2. Add new columns to products table
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

-- 4. Enable RLS on sync history
ALTER TABLE public.shopify_sync_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers can view their own sync history"
  ON public.shopify_sync_history FOR SELECT
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert sync history"
  ON public.shopify_sync_history FOR INSERT
  WITH CHECK (true);

-- 5. Index for fast sync history lookups
CREATE INDEX IF NOT EXISTS idx_sync_history_seller
  ON public.shopify_sync_history (seller_id, synced_at DESC);
```

### Step 2: Deploy the Updated Edge Function

The new edge function code is at `supabase/functions/shopify-sync/index.ts`.

**Option A — Supabase CLI:**
```bash
supabase functions deploy shopify-sync --project-ref epoqhtjaqmwqmapfrcwn
```

**Option B — Supabase Dashboard:**
Go to Edge Functions → shopify-sync → replace the code with the contents of `supabase/functions/shopify-sync/index.ts`

### Step 3: Merge Hussein's Branch

After running the migration and deploying the edge function:
```bash
git fetch origin
git checkout main
git merge origin/hussein/shopify-improvements
```

### Step 4: Regenerate Supabase Types (Optional)

If you want to keep types.ts auto-generated:
```bash
supabase gen types typescript --project-id epoqhtjaqmwqmapfrcwn > src/integrations/supabase/types.ts
```
(I already updated types.ts manually so this is optional)

---

## TESTING

After deploying, test with the techzone@demo.com account:
1. Go to Shopify page → should show "Connected" to tpd0xm-wy.myshopify.com
2. Click "Sync Now" → should import 7 products (4 Shopify products, one has 4 variants)
3. Go to Products/Menu → Shopify products should show with images and stock badges
4. Test auto-sync toggle → set to "Every 6 hours" and verify it saves
5. The Shopify test store URL is: tpd0xm-wy.myshopify.com
