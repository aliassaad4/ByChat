import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ─── Shopify API helpers ───

/** Exchange client_id + client_secret for a short-lived access token (OAuth client_credentials) */
async function getOAuthToken(storeUrl: string, clientId: string, clientSecret: string): Promise<string> {
  const res = await fetch(`https://${storeUrl}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify OAuth failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.access_token;
}

/** Resolve access token: use OAuth if client_id/secret available, otherwise use stored token */
async function resolveToken(seller: {
  shopify_store_url: string;
  shopify_access_token?: string | null;
  shopify_client_id?: string | null;
  shopify_client_secret?: string | null;
}): Promise<string> {
  if (seller.shopify_client_id && seller.shopify_client_secret) {
    return await getOAuthToken(seller.shopify_store_url, seller.shopify_client_id, seller.shopify_client_secret);
  }
  if (seller.shopify_access_token) {
    return seller.shopify_access_token;
  }
  throw new Error("No Shopify credentials available");
}

async function shopifyFetch(storeUrl: string, token: string, endpoint: string) {
  const url = `https://${storeUrl}/admin/api/2024-01/${endpoint}`;
  const res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify returned ${res.status}: ${text}`);
  }
  return res.json();
}

/** Fetch ALL products from Shopify with pagination (250 per page max) */
async function fetchAllShopifyProducts(storeUrl: string, token: string) {
  const allProducts: any[] = [];
  let url: string | null =
    `https://${storeUrl}/admin/api/2024-01/products.json?limit=250`;

  while (url) {
    const res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": token },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Shopify returned ${res.status}: ${text}`);
    }
    const data = await res.json();
    allProducts.push(...(data.products || []));

    // Parse Link header for pagination
    const linkHeader = res.headers.get("Link");
    url = null;
    if (linkHeader) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      if (nextMatch) url = nextMatch[1];
    }
  }
  return allProducts;
}

// ─── CONNECT action ───

async function handleConnect(
  sellerId: string,
  storeUrl: string,
  accessToken: string | null,
  clientId: string | null,
  clientSecret: string | null,
) {
  // Resolve token (OAuth or direct)
  let token: string;
  if (clientId && clientSecret) {
    token = await getOAuthToken(storeUrl, clientId, clientSecret);
  } else if (accessToken) {
    token = accessToken;
  } else {
    throw new Error("Either access_token or client_id + client_secret required");
  }

  // Validate by fetching shop info
  await shopifyFetch(storeUrl, token, "shop.json");

  // Save credentials
  const updateData: Record<string, unknown> = {
    shopify_store_url: storeUrl,
    shopify_connected: true,
  };
  if (clientId && clientSecret) {
    updateData.shopify_client_id = clientId;
    updateData.shopify_client_secret = clientSecret;
    updateData.shopify_access_token = null; // clear static token if using OAuth
  } else {
    updateData.shopify_access_token = accessToken;
    updateData.shopify_client_id = null;
    updateData.shopify_client_secret = null;
  }

  const { error: updateErr } = await supabase
    .from("sellers")
    .update(updateData)
    .eq("id", sellerId);

  if (updateErr) throw new Error(`DB error: ${updateErr.message}`);

  // Do initial sync
  return await handleSync(sellerId, "connect");
}

// ─── SYNC action ───

async function handleSync(sellerId: string, triggerType = "manual") {
  // Get seller's Shopify credentials
  const { data: seller, error: sellerErr } = await supabase
    .from("sellers")
    .select("shopify_store_url, shopify_access_token, shopify_client_id, shopify_client_secret")
    .eq("id", sellerId)
    .single();

  if (sellerErr || !seller?.shopify_store_url) {
    throw new Error("Shopify not connected or credentials missing");
  }

  const storeUrl = seller.shopify_store_url;
  const token = await resolveToken(seller);

  // Fetch all products from Shopify
  const shopifyProducts = await fetchAllShopifyProducts(storeUrl, token);

  let imported = 0;
  let updated = 0;
  let errors = 0;
  const errorDetails: { product: string; variant: string; error: string }[] = [];

  // Track which shopify variant IDs we see (for marking deleted ones)
  const seenVariantIds = new Set<string>();

  for (const product of shopifyProducts) {
    // Collect image URLs from Shopify product
    const imageUrls: string[] = (product.images || []).map(
      (img: any) => img.src
    );

    // Product type/category - use product_type or fallback to "other"
    const category = product.product_type || "other";

    // Process ALL variants for this product
    const variants = product.variants || [];
    if (variants.length === 0) continue;

    for (const variant of variants) {
      const variantId = String(variant.id);
      const productId = String(product.id);
      seenVariantIds.add(variantId);

      // Build product name: if multiple variants, append variant title
      let name = product.title;
      if (
        variants.length > 1 &&
        variant.title &&
        variant.title !== "Default Title"
      ) {
        name = `${product.title} - ${variant.title}`;
      }

      const variantTitle =
        variant.title !== "Default Title" ? variant.title : null;

      // Inventory quantity
      const quantity =
        variant.inventory_quantity !== undefined
          ? variant.inventory_quantity
          : null;

      // Auto-set availability based on inventory
      const isAvailable = quantity === null || quantity > 0;

      const productData = {
        seller_id: sellerId,
        name,
        description: product.body_html
          ? product.body_html.replace(/<[^>]*>/g, "").substring(0, 2000)
          : null,
        price: parseFloat(variant.price) || 0,
        category,
        image_urls: imageUrls,
        is_available: isAvailable,
        source: "shopify",
        shopify_product_id: productId,
        shopify_variant_id: variantId,
        shopify_variant_title: variantTitle,
        quantity,
      };

      try {
        // Check if this variant already exists
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("seller_id", sellerId)
          .eq("shopify_variant_id", variantId)
          .maybeSingle();

        if (existing) {
          // Update existing product
          const { error: upErr } = await supabase
            .from("products")
            .update(productData)
            .eq("id", existing.id);
          if (upErr) throw upErr;
          updated++;
        } else {
          // Insert new product
          const { error: insErr } = await supabase
            .from("products")
            .insert(productData);
          if (insErr) throw insErr;
          imported++;
        }
      } catch (err: any) {
        errors++;
        errorDetails.push({
          product: name,
          variant: variantId,
          error: err.message || "Unknown error",
        });
      }
    }
  }

  // Mark Shopify products that no longer exist on Shopify as unavailable
  const { data: allShopifyProducts } = await supabase
    .from("products")
    .select("id, shopify_variant_id")
    .eq("seller_id", sellerId)
    .eq("source", "shopify");

  if (allShopifyProducts) {
    for (const p of allShopifyProducts) {
      if (p.shopify_variant_id && !seenVariantIds.has(p.shopify_variant_id)) {
        await supabase
          .from("products")
          .update({ is_available: false, quantity: 0 })
          .eq("id", p.id);
      }
    }
  }

  // Update last sync time
  await supabase
    .from("sellers")
    .update({ shopify_last_sync_at: new Date().toISOString() })
    .eq("id", sellerId);

  // Count total variants across all Shopify products
  const totalShopifyProducts = shopifyProducts.reduce(
    (sum: number, p: any) => sum + (p.variants?.length || 0),
    0
  );

  // Save sync history
  await supabase.from("shopify_sync_history").insert({
    seller_id: sellerId,
    imported,
    updated,
    errors,
    total_shopify_products: totalShopifyProducts,
    error_details: errorDetails,
    trigger_type: triggerType,
  });

  return {
    imported,
    updated,
    errors,
    total_shopify_products: totalShopifyProducts,
    error_details: errorDetails,
  };
}

// ─── DISCONNECT action ───

async function handleDisconnect(sellerId: string) {
  // Mark all Shopify products as unavailable
  await supabase
    .from("products")
    .update({ is_available: false })
    .eq("seller_id", sellerId)
    .eq("source", "shopify");

  // Clear Shopify credentials
  const { error } = await supabase
    .from("sellers")
    .update({
      shopify_store_url: null,
      shopify_access_token: null,
      shopify_client_id: null,
      shopify_client_secret: null,
      shopify_connected: false,
      shopify_last_sync_at: null,
      shopify_auto_sync_interval: null,
    })
    .eq("id", sellerId);

  if (error) throw new Error(`DB error: ${error.message}`);

  return { success: true };
}

// ─── UPDATE-AUTO-SYNC action ───

async function handleUpdateAutoSync(
  sellerId: string,
  interval: number | null
) {
  const { error } = await supabase
    .from("sellers")
    .update({ shopify_auto_sync_interval: interval })
    .eq("id", sellerId);

  if (error) throw new Error(`DB error: ${error.message}`);
  return { success: true, interval };
}

// ─── PUSH-PRICE action (two-way sync) ───

async function handlePushPrice(
  sellerId: string,
  productId: string,
  newPrice: number
) {
  // Get seller credentials
  const { data: seller } = await supabase
    .from("sellers")
    .select("shopify_store_url, shopify_access_token, shopify_client_id, shopify_client_secret")
    .eq("id", sellerId)
    .single();

  if (!seller?.shopify_store_url) {
    throw new Error("Shopify not connected");
  }

  const token = await resolveToken(seller);

  // Get the product's Shopify IDs
  const { data: product } = await supabase
    .from("products")
    .select("shopify_product_id, shopify_variant_id")
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .single();

  if (!product?.shopify_product_id || !product?.shopify_variant_id) {
    throw new Error("Product not linked to Shopify");
  }

  // Push price update to Shopify
  const url = `https://${seller.shopify_store_url}/admin/api/2024-01/variants/${product.shopify_variant_id}.json`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      variant: { id: parseInt(product.shopify_variant_id), price: String(newPrice) },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify returned ${res.status}: ${text}`);
  }

  // Update local price too
  await supabase
    .from("products")
    .update({ price: newPrice })
    .eq("id", productId);

  return { success: true };
}

// ─── RETRY-FAILED action ───

async function handleRetryFailed(sellerId: string) {
  return await handleSync(sellerId, "manual");
}

// ─── Main handler ───

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, seller_id } = body;

    if (!seller_id) throw new Error("seller_id is required");
    if (!action) throw new Error("action is required");

    let result;

    switch (action) {
      case "connect":
        if (!body.store_url) {
          throw new Error("store_url is required");
        }
        if (!body.access_token && !(body.client_id && body.client_secret)) {
          throw new Error("Either access_token or client_id + client_secret is required");
        }
        result = await handleConnect(
          seller_id,
          body.store_url,
          body.access_token || null,
          body.client_id || null,
          body.client_secret || null,
        );
        break;

      case "sync":
        result = await handleSync(seller_id, body.trigger_type || "manual");
        break;

      case "disconnect":
        result = await handleDisconnect(seller_id);
        break;

      case "update-auto-sync":
        result = await handleUpdateAutoSync(seller_id, body.interval ?? null);
        break;

      case "push-price":
        if (!body.product_id || body.new_price === undefined) {
          throw new Error("product_id and new_price are required");
        }
        result = await handlePushPrice(
          seller_id,
          body.product_id,
          body.new_price
        );
        break;

      case "retry-failed":
        result = await handleRetryFailed(seller_id);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    const message = err.message || "Internal server error";
    const status = message.includes("429") ? 429 : message.includes("401") ? 401 : 400;

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
