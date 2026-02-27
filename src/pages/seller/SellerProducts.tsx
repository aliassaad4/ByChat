import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ProductFormModal } from "@/components/seller/ProductFormModal";

export type Product = {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  category: string;
  image_urls: string[];
  is_available: boolean;
  source: string;
  shopify_product_id: string | null;
  shopify_variant_id: string | null;
  created_at: string;
  updated_at: string;
};

export default function SellerProducts() {
  const { data: seller } = useSellerProfile();
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: ["seller-products", seller?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("seller_id", seller!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!seller,
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, is_available }: { id: string; is_available: boolean }) => {
      const { error } = await supabase.from("products").update({ is_available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["seller-products"] }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      toast.success("Product deleted");
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products / Menu</h1>
        <Button onClick={handleAdd} variant="hero" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add New Product
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : products && products.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <Card key={product.id} className="glass-card border-border overflow-hidden group">
              {product.image_urls?.length > 0 && (
                <div className="h-40 overflow-hidden">
                  <img
                    src={product.image_urls[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="outline" className="text-xs">{product.category}</Badge>
                      {product.source === "shopify" && (
                        <Badge className="bg-[#96BF48]/20 text-[#96BF48] border-[#96BF48]/30 text-xs">
                          Shopify
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="text-lg font-bold text-primary">${Number(product.price).toFixed(2)}</span>
                </div>
                {product.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={product.is_available}
                      onCheckedChange={(checked) =>
                        toggleAvailability.mutate({ id: product.id, is_available: checked })
                      }
                    />
                    <span className="text-xs text-muted-foreground">
                      {product.is_available ? "Available" : "Unavailable"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {product.source === "shopify" ? (
                      <span className="text-xs text-muted-foreground italic px-2 py-1">
                        Edit on Shopify
                      </span>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(product)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProduct.mutate(product.id)}
                          className="hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">No products yet</h3>
          <p className="text-muted-foreground mb-4">Add your first product to get started</p>
          <Button onClick={handleAdd} variant="hero">
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        </div>
      )}

      <ProductFormModal
        open={showModal}
        onOpenChange={setShowModal}
        product={editingProduct}
        sellerId={seller?.id ?? ""}
      />
    </div>
  );
}
