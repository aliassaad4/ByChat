import { useState } from "react";
import {
  Phone,
  Info,
  AlertTriangle,
  Loader2,
  Unplug,
  Eye,
  EyeOff,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function SellerWhatsApp() {
  const { data: seller, isLoading } = useSellerProfile();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [showModal, setShowModal] = useState(false);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = seller?.whatsapp_connected ?? false;
  const connectedNumber = seller?.whatsapp_phone_number ?? "";

  /* ── Connect via Twilio credentials ── */
  async function handleConnect() {
    if (!accountSid.trim() || !authToken.trim() || !fromNumber.trim()) {
      toast({ title: "All fields required", description: "Please fill in all three fields.", variant: "destructive" });
      return;
    }

    setConnecting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const jwt = session.session?.access_token;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          seller_id: seller!.id,
          account_sid: accountSid.trim(),
          auth_token: authToken.trim(),
          from_number: fromNumber.trim().startsWith("whatsapp:")
            ? fromNumber.trim()
            : `whatsapp:${fromNumber.trim()}`,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Connection failed");

      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setShowModal(false);
      setAccountSid(""); setAuthToken(""); setFromNumber("");
      toast({ title: "WhatsApp connected!", description: `${result.display_number} is now live.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Connection failed", description: msg, variant: "destructive" });
    } finally {
      setConnecting(false);
    }
  }

  /* ── Disconnect ── */
  async function handleDisconnect() {
    if (!seller) return;
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("sellers")
        .update({
          whatsapp_connected: false,
          whatsapp_phone_number: null,
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_from_number: null,
        })
        .eq("id", seller.id);

      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected from your shop." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
          WhatsApp Integration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Let your AI agent reply to customers on WhatsApp — 24/7, automatically.
        </p>
      </div>

      {/* Connection Status */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          {isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-[#25D366] animate-pulse" />
                <span className="font-medium">Connected</span>
                <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 text-xs">Active</Badge>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="w-4 h-4" />
                <span>{connectedNumber}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/40" />
                <span className="text-muted-foreground font-medium">Not Connected</span>
              </div>
              <Button
                size="lg"
                className="w-full sm:w-auto gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
                onClick={() => setShowModal(true)}
              >
                <WhatsAppIcon className="w-5 h-5" />
                Connect WhatsApp Business
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="glass-card border-border">
        <CardContent className="p-5">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">How it works</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                When a customer messages your WhatsApp number, your AI agent
                (already configured in your shop settings) will reply
                automatically — same products, same personality, 24/7.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Connect Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <div className="w-9 h-9 rounded-xl bg-[#25D366] flex items-center justify-center">
                <WhatsAppIcon className="w-5 h-5 text-white" />
              </div>
              Connect via Twilio
            </DialogTitle>
            <DialogDescription>
              Enter your Twilio credentials. We'll handle the rest automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Step hint */}
            <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <ExternalLink className="w-4 h-4 shrink-0 text-muted-foreground mt-0.5" />
              <p className="text-xs text-muted-foreground">
                Find your credentials at{" "}
                <span className="font-mono text-foreground">console.twilio.com</span>{" "}
                → Account Info (top of dashboard)
              </p>
            </div>

            {/* Account SID */}
            <div className="space-y-1.5">
              <Label htmlFor="sid">Account SID</Label>
              <Input
                id="sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={(e) => setAccountSid(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            {/* Auth Token */}
            <div className="space-y-1.5">
              <Label htmlFor="token">Auth Token</Label>
              <div className="relative">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  placeholder="Your Twilio auth token"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  className="font-mono text-sm pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowToken((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* From Number */}
            <div className="space-y-1.5">
              <Label htmlFor="from">WhatsApp Business Number</Label>
              <Input
                id="from"
                placeholder="+14155238886"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The Twilio phone number enabled for WhatsApp (with country code)
              </p>
            </div>

            <Button
              size="lg"
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Connecting...</>
              ) : (
                <><WhatsAppIcon className="w-5 h-5" /> Connect</>
              )}
            </Button>

            <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500 mt-0.5" />
              <p className="text-xs text-yellow-200 leading-relaxed">
                Your Twilio credentials are stored securely and only used to send
                and receive WhatsApp messages on your behalf.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
