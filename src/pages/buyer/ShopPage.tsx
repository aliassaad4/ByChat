import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import {
  Store, Clock, MapPin, Truck, CreditCard, DollarSign, Banknote,
  MessageCircle, ShoppingCart, Plus, Check
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShopChatPanel } from "@/components/buyer/ShopChatPanel";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function ShopPage() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const { addItem, items } = useCart();
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data: buyerProfile } = useQuery({
    queryKey: ["buyer-profile-chat", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("buyers")
        .select("id, full_name")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: seller } = useQuery({
    queryKey: ["shop-seller", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sellers")
        .select("*")
        .eq("id", sellerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });

  const { data: products } = useQuery({
    queryKey: ["shop-products", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", sellerId!)
        .eq("is_available", true)
        .order("category")
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });

  const { data: agentConfig } = useQuery({
    queryKey: ["shop-agent-config", sellerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_agent_config")
        .select("*")
        .eq("seller_id", sellerId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!sellerId,
  });

  // Group products by category
  const categories = products
    ? Object.entries(
        products.reduce<Record<string, typeof products>>((acc, p) => {
          const cat = p.category || "Other";
          if (!acc[cat]) acc[cat] = [];
          acc[cat].push(p);
          return acc;
        }, {})
      )
    : [];

  const handleAddToCart = (product: NonNullable<typeof products>[0]) => {
    addItem({
      productId: product.id,
      name: product.name,
      price: Number(product.price),
      imageUrl: product.image_urls?.[0] ?? null,
      sellerId: product.seller_id,
      sellerName: seller?.business_name || "",
    });
    setAddedIds((prev) => new Set(prev).add(product.id));
    toast.success(`${product.name} added to cart`);
    setTimeout(() => {
      setAddedIds((prev) => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 1500);
  };

  const paymentMethods = seller
    ? [
        seller.accepts_cash && "Cash",
        seller.accepts_card && "Card",
        seller.accepts_omt && "OMT",
        seller.accepts_whish && "Whish",
      ].filter(Boolean)
    : [];

  const agentName = agentConfig?.agent_name || "Shopping Assistant";
  const autoGreeting = agentConfig?.auto_greeting || undefined;
  const buyerId = buyerProfile?.id ?? null;
  const buyerName = buyerProfile?.full_name || user?.email?.split("@")[0] || "Customer";
  const cartItemCount = items.filter((i) => i.sellerId === sellerId).length;

  if (!seller) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Shop Header */}
      <div className="glass-card overflow-hidden animate-fade-in">
        <div className="h-32 bg-gradient-to-br from-primary/20 via-secondary/10 to-muted relative">
          <div className="absolute inset-0 bg-gradient-to-t from-card to-transparent" />
        </div>
        <div className="px-6 pb-6 -mt-8 relative">
          <div className="flex items-end gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg border-4 border-card">
              <Store className="w-7 h-7 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-2xl font-bold">{seller.business_name}</h1>
              <Badge variant="outline" className="mt-1 text-xs">
                {seller.business_type}
              </Badge>
            </div>
          </div>

          {seller.business_description && (
            <p className="text-sm text-muted-foreground mt-3">{seller.business_description}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {seller.working_hours_open} – {seller.working_hours_close}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {seller.city_area}
            </span>
            <span className="flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" />
              {seller.delivery_option}
            </span>
          </div>

          {paymentMethods.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {paymentMethods.map((m) => (
                <Badge key={m} variant="outline" className="text-[10px]">
                  {m === "Cash" && <Banknote className="w-3 h-3 mr-1" />}
                  {m === "Card" && <CreditCard className="w-3 h-3 mr-1" />}
                  {m === "OMT" && <DollarSign className="w-3 h-3 mr-1" />}
                  {m === "Whish" && <DollarSign className="w-3 h-3 mr-1" />}
                  {m}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Products Grid */}
      <div className="space-y-8">
        {categories.length > 0 ? (
          categories.map(([category, categoryProducts]) => (
            <div key={category} className="space-y-3">
              <h2 className="text-lg font-semibold capitalize">{category}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {categoryProducts.map((product) => (
                  <Card
                    key={product.id}
                    className="glass-card border-border overflow-hidden group hover:shadow-lg transition-all duration-300"
                  >
                    {product.image_urls?.length > 0 && (
                      <div className="h-36 overflow-hidden">
                        <img
                          src={product.image_urls[0]}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{product.name}</h3>
                        <span className="text-primary font-bold text-sm shrink-0">
                          ${Number(product.price).toFixed(2)}
                        </span>
                      </div>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {product.description}
                        </p>
                      )}
                      <Button
                        variant={addedIds.has(product.id) ? "outline" : "hero"}
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => handleAddToCart(product)}
                      >
                        {addedIds.has(product.id) ? (
                          <>
                            <Check className="w-4 h-4 mr-1" /> Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-1" /> Add to Cart
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Store className="w-10 h-10 mx-auto mb-3" />
            <p>No products available yet.</p>
          </div>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartItemCount > 0 && (
        <Link to="/buyer/cart">
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
            <Button variant="hero" size="lg" className="shadow-xl gap-2 px-6">
              <ShoppingCart className="w-5 h-5" />
              View Cart ({cartItemCount})
            </Button>
          </div>
        </Link>
      )}

      {/* Chat FAB */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className={`fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-xl hover:scale-110 transition-all duration-300 ${chatOpen ? "rotate-90 opacity-0 pointer-events-none" : ""}`}
      >
        <MessageCircle className="w-6 h-6 text-primary-foreground" />
      </button>

      {/* Chat Panel — larger, responsive */}
      {chatOpen && (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[420px] h-[85vh] sm:h-[600px] glass-card border-border sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-2xl animate-scale-in">
          <ShopChatPanel
            agentName={agentName}
            storeName={seller.business_name}
            sellerId={sellerId!}
            buyerId={buyerId}
            buyerName={buyerName}
            autoGreeting={autoGreeting}
            onClose={() => setChatOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
