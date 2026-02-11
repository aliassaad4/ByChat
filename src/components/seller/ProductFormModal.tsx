import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, ImagePlus, X } from "lucide-react";
import type { Product } from "@/pages/seller/SellerProducts";

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be positive"),
  category: z.string().min(1, "Category is required"),
});

type FormData = z.infer<typeof schema>;

const categories = [
  "Food",
  "Drinks",
  "Appetizers",
  "Desserts",
  "Clothing",
  "Electronics",
  "Beauty",
  "Services",
  "Other",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  sellerId: string;
}

export function ProductFormModal({ open, onOpenChange, product, sellerId }: Props) {
  const queryClient = useQueryClient();
  const isEditing = !!product;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track existing image URLs (from DB) and new files to upload
  const [existingUrls, setExistingUrls] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      category: "Other",
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        description: product.description ?? "",
        price: Number(product.price),
        category: product.category,
      });
      setExistingUrls(product.image_urls ?? []);
    } else {
      reset({ name: "", description: "", price: 0, category: "Other" });
      setExistingUrls([]);
    }
    setNewFiles([]);
    setNewPreviews([]);
  }, [product, reset, open]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    setNewFiles((prev) => [...prev, ...files]);

    // Generate previews
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setNewPreviews((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeExistingImage = (index: number) => {
    setExistingUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
    setNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("product-images")
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      urls.push(urlData.publicUrl);
    }
    return urls;
  };

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Upload new files
      let uploadedUrls: string[] = [];
      if (newFiles.length > 0) {
        uploadedUrls = await uploadFiles(newFiles);
      }

      const allImageUrls = [...existingUrls, ...uploadedUrls];

      const payload = {
        name: data.name,
        description: data.description || null,
        price: data.price,
        category: data.category,
        image_urls: allImageUrls,
        seller_id: sellerId,
      };

      if (isEditing) {
        const { error } = await supabase.from("products").update(payload).eq("id", product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      toast.success(isEditing ? "Product updated" : "Product added");
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalImages = existingUrls.length + newPreviews.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Product" : "Add New Product"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} className="bg-muted/50 border-border" placeholder="Product name" />
            {errors.name && <p className="text-destructive text-sm">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...register("description")} className="bg-muted/50 border-border" placeholder="Optional description" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price ($)</Label>
              <Input type="number" step="0.01" {...register("price")} className="bg-muted/50 border-border" />
              {errors.price && <p className="text-destructive text-sm">{errors.price.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={watch("category")} onValueChange={(v) => setValue("category", v)}>
                <SelectTrigger className="bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Image Upload Section */}
          <div className="space-y-2">
            <Label>Images</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
            />

            {/* Image Previews Grid */}
            {totalImages > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingUrls.map((url, i) => (
                  <div key={`existing-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeExistingImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {newPreviews.map((preview, i) => (
                  <div key={`new-${i}`} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
                    <img src={preview} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeNewImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Click to add images
              </span>
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? "Update" : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
