import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Send, Store, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";

type ProductResult = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_urls: string[];
  category: string;
  seller_id: string;
  seller_name?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ProductResult[];
};

export default function BuyerSearch() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! 👋 Tell me what you're looking for and I'll find the best options across all shops.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const searchProducts = async (query: string): Promise<ProductResult[]> => {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 2);

    if (terms.length === 0) return [];

    // Build an OR filter for ilike on name and description
    const orFilters = terms
      .flatMap((term) => [
        `name.ilike.%${term}%`,
        `description.ilike.%${term}%`,
        `category.ilike.%${term}%`,
      ])
      .join(",");

    const { data: products, error } = await supabase
      .from("products")
      .select("id, name, description, price, image_urls, category, seller_id")
      .eq("is_available", true)
      .or(orFilters)
      .limit(8);

    if (error || !products || products.length === 0) return [];

    // Fetch seller names for matching products
    const sellerIds = [...new Set(products.map((p) => p.seller_id))];
    const { data: sellers } = await supabase
      .from("sellers")
      .select("id, business_name")
      .in("id", sellerIds);

    const sellerMap = new Map(sellers?.map((s) => [s.id, s.business_name]) || []);

    return products.map((p) => ({
      ...p,
      price: Number(p.price),
      seller_name: sellerMap.get(p.seller_id) || "Unknown Shop",
    }));
  };

  const handleSend = async () => {
    const query = input.trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsSearching(true);

    try {
      const results = await searchProducts(query);

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          results.length > 0
            ? `I found ${results.length} product${results.length > 1 ? "s" : ""} matching "${query}" 🎉`
            : "I couldn't find that right now. Try different keywords! 🔍",
        products: results.length > 0 ? results : undefined,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Oops, something went wrong. Please try again!",
        },
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold">AI Search</h1>
          <p className="text-xs text-muted-foreground">Search across all shops</p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((msg) => (
          <div key={msg.id}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </div>

            {/* Product results cards */}
            {msg.products && msg.products.length > 0 && (
              <div className="mt-3 space-y-2 ml-0">
                {msg.products.map((product) => (
                  <Card
                    key={product.id}
                    className="glass-card border-border overflow-hidden hover:shadow-lg transition-all duration-300"
                  >
                    <CardContent className="p-0">
                      <div className="flex gap-3">
                        {product.image_urls?.length > 0 ? (
                          <img
                            src={product.image_urls[0]}
                            alt={product.name}
                            className="w-20 h-20 object-cover rounded-l-xl"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-20 h-20 bg-muted/50 flex items-center justify-center rounded-l-xl shrink-0">
                            <Store className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 py-2.5 pr-3 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{product.name}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {product.seller_name}
                              </p>
                            </div>
                            <span className="text-primary font-bold text-sm shrink-0">
                              ${product.price.toFixed(2)}
                            </span>
                          </div>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {product.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {product.category}
                            </Badge>
                            <Link to={`/buyer/shop/${product.seller_id}`}>
                              <Button variant="ghost" size="sm" className="h-6 text-xs text-primary px-2">
                                View Shop <ExternalLink className="w-3 h-3 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ))}

        {isSearching && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                <span className="ml-1">Searching...</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="pt-3 border-t border-border">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <Input
            placeholder="Search for products, food, clothes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1"
            disabled={isSearching}
          />
          <Button type="submit" size="icon" variant="hero" disabled={!input.trim() || isSearching}>
            <Send className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Search products by name, description, or category across all stores
        </p>
      </div>
    </div>
  );
}
