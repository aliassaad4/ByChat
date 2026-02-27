import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Plug, ExternalLink, Loader2, ShoppingBag } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ModalType = "whatsapp" | "instagram" | "shopify" | null;

export default function SellerIntegrations() {
  const { data: seller } = useSellerProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // WhatsApp form
  const [waNumber, setWaNumber] = useState("");
  // Instagram form
  const [igHandle, setIgHandle] = useState("");
  const [igUrl, setIgUrl] = useState("");

  const openModal = (type: ModalType) => {
    if (type === "shopify") {
      navigate("/seller/shopify");
      return;
    }
    if (type === "whatsapp") setWaNumber(seller?.whatsapp_number ?? "");
    if (type === "instagram") {
      setIgHandle(seller?.instagram_handle ?? "");
      setIgUrl(seller?.instagram_handle ? `https://instagram.com/${seller.instagram_handle}` : "");
    }
    setActiveModal(type);
  };

  const updateSeller = useMutation({
    mutationFn: async (fields: Record<string, string>) => {
      if (!seller) throw new Error("No seller profile");
      const { error } = await supabase
        .from("sellers")
        .update(fields)
        .eq("id", seller.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setActiveModal(null);
      toast.success("Integration saved!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveWhatsApp = () => {
    if (!waNumber.trim()) return toast.error("Please enter a phone number");
    updateSeller.mutate({ whatsapp_number: waNumber.trim() });
  };

  const saveInstagram = () => {
    if (!igHandle.trim()) return toast.error("Please enter a username");
    updateSeller.mutate({ instagram_handle: igHandle.trim().replace(/^@/, "") });
  };

  const whatsappConnected = !!seller?.whatsapp_number;
  const instagramConnected = !!seller?.instagram_handle;

  const integrations = [
    {
      id: "whatsapp" as const,
      name: "WhatsApp Business",
      description: "Receive orders and chat with buyers via WhatsApp",
      connected: whatsappConnected,
      connectedLabel: seller?.whatsapp_number ?? "",
      brandColor: "from-[#25D366] to-[#128C7E]",
      borderColor: whatsappConnected ? "border-[#25D366]/40" : "border-border",
      logo: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      ),
      comingSoon: false,
    },
    {
      id: "instagram" as const,
      name: "Instagram",
      description: "Link your Instagram shop and showcase products",
      connected: instagramConnected,
      connectedLabel: seller?.instagram_handle ? `@${seller.instagram_handle}` : "",
      brandColor: "from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
      borderColor: instagramConnected ? "border-[#DD2A7B]/40" : "border-border",
      logo: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      comingSoon: false,
    },
    {
      id: "shopify" as const,
      name: "Shopify",
      description: "Import your Shopify products and keep them in sync",
      connected: !!seller?.shopify_connected,
      connectedLabel: seller?.shopify_store_url ?? "",
      brandColor: "from-[#96BF48] to-[#5E8E3E]",
      borderColor: seller?.shopify_connected ? "border-[#96BF48]/40" : "border-border",
      logo: (
        <ShoppingBag className="w-8 h-8 text-white" />
      ),
      comingSoon: false,
    },
    {
      id: "messenger" as const,
      name: "Facebook Messenger",
      description: "Chat with buyers through Messenger",
      connected: false,
      connectedLabel: "",
      brandColor: "from-[#0084FF] to-[#00C6FF]",
      borderColor: "border-border",
      logo: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12 0C5.373 0 0 4.974 0 11.111c0 3.498 1.744 6.614 4.469 8.654V24l4.088-2.242c1.092.3 2.246.464 3.443.464 6.627 0 12-4.975 12-11.111C24 4.974 18.627 0 12 0zm1.191 14.963l-3.055-3.26-5.963 3.26L10.732 8.2l3.131 3.259L19.752 8.2l-6.561 6.763z" />
        </svg>
      ),
      comingSoon: true,
    },
    {
      id: "telegram" as const,
      name: "Telegram",
      description: "Connect your Telegram bot for orders",
      connected: false,
      connectedLabel: "",
      brandColor: "from-[#2AABEE] to-[#229ED9]",
      borderColor: "border-border",
      logo: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      ),
      comingSoon: true,
    },
    {
      id: "tiktok" as const,
      name: "TikTok Shop",
      description: "Sell products through TikTok Shop",
      connected: false,
      connectedLabel: "",
      brandColor: "from-[#000000] to-[#25F4EE]",
      borderColor: "border-border",
      logo: (
        <svg viewBox="0 0 24 24" className="w-8 h-8" fill="white">
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
        </svg>
      ),
      comingSoon: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your messaging platforms to reach buyers everywhere
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => (
          <Card
            key={item.id}
            className={`glass-card overflow-hidden transition-all duration-300 ${item.borderColor} ${
              item.comingSoon ? "opacity-60" : "hover:shadow-lg hover:-translate-y-1"
            }`}
          >
            <CardContent className="p-0">
              {/* Brand header */}
              <div className={`bg-gradient-to-r ${item.brandColor} p-4 flex items-center gap-3`}>
                {item.logo}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white text-sm">{item.name}</h3>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground">{item.description}</p>

                <div className="flex items-center justify-between">
                  {item.comingSoon ? (
                    <Badge variant="outline" className="text-xs">Coming Soon</Badge>
                  ) : item.connected ? (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Not Connected
                    </Badge>
                  )}

                  {!item.comingSoon && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => openModal(item.id as ModalType)}
                    >
                      {item.connected ? "Edit" : "Connect"}
                    </Button>
                  )}
                </div>

                {item.connected && item.connectedLabel && (
                  <p className="text-xs text-muted-foreground truncate">
                    {item.connectedLabel}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* WhatsApp Modal */}
      <Dialog open={activeModal === "whatsapp"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              Connect WhatsApp Business
            </DialogTitle>
            <DialogDescription>
              Enter your WhatsApp Business phone number to receive orders and chat with buyers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>WhatsApp Business Phone Number</Label>
              <Input
                placeholder="+961 XX XXX XXX"
                value={waNumber}
                onChange={(e) => setWaNumber(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
              <p className="text-xs font-medium flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Setup Guide
              </p>
              <p className="text-xs text-muted-foreground">
                To fully connect, you'll need to set up the WhatsApp Business API. For now, save your number and we'll guide you through the setup.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={saveWhatsApp} disabled={updateSeller.isPending}>
              {updateSeller.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Instagram Modal */}
      <Dialog open={activeModal === "instagram"} onOpenChange={(o) => !o && setActiveModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF] flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="white">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </div>
              Connect Instagram
            </DialogTitle>
            <DialogDescription>
              Link your Instagram account to showcase your products and reach more buyers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Instagram Username</Label>
              <Input
                placeholder="@yourbusiness"
                value={igHandle}
                onChange={(e) => setIgHandle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instagram Page URL</Label>
              <Input
                placeholder="https://instagram.com/yourbusiness"
                value={igUrl}
                onChange={(e) => setIgUrl(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveModal(null)}>Cancel</Button>
            <Button onClick={saveInstagram} disabled={updateSeller.isPending}>
              {updateSeller.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
