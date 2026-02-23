import { useState } from "react";
import {
  Loader2, AlertTriangle, Check, Unplug,
  Info, Phone, MessageSquare, Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useQueryClient } from "@tanstack/react-query";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SANDBOX_NUMBER = "+14155238886";

export default function SellerWhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: seller, isLoading } = useSellerProfile();

  const [step, setStep]             = useState<1 | 2>(1);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [joinKeyword, setJoinKeyword] = useState("");
  const [copiedJoin, setCopiedJoin] = useState(false);

  const isConnected = !!seller?.whatsapp_connected;

  /* ── Connect: backend uses ByChat's Twilio account ── */
  async function handleConnect() {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { seller_id: seller!.id },
      });
      if (error) throw new Error(error.message ?? "Connection failed");
      if (data?.error) throw new Error(data.error);

      setJoinKeyword(data?.join_keyword ?? "");
      setStep(2);
    } catch (err: unknown) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setConnecting(false);
    }
  }

  /* ── Seller confirmed they sent the join message ── */
  async function handleJoinConfirmed() {
    await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
    toast({ title: "WhatsApp connected!", description: "Your AI agent is now live on WhatsApp." });
  }

  /* ── Disconnect ── */
  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("sellers")
        .update({
          whatsapp_connected:    false,
          whatsapp_phone_number: null,
          twilio_account_sid:    null,
          twilio_auth_token:     null,
          twilio_from_number:    null,
        })
        .eq("id", seller!.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setStep(1);
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  function copyJoin() {
    navigator.clipboard.writeText(joinKeyword ? `join ${joinKeyword}` : "join <keyword>");
    setCopiedJoin(true);
    setTimeout(() => setCopiedJoin(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ════ CONNECTED ════ */
  if (isConnected) {
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your AI agent is live on WhatsApp.</p>
        </div>

        <Card className="glass-card border-[#25D366]/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">WhatsApp Connected</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                    <Phone className="w-3.5 h-3.5" />
                    {seller?.whatsapp_phone_number ?? SANDBOX_NUMBER}
                  </p>
                </div>
              </div>
              <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30">Active</Badge>
            </div>

            <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Customers who message this number on WhatsApp will get instant AI replies based on your store products and settings.
              </p>
            </div>

            <div className="pt-2 border-t border-border">
              <Button
                variant="outline" size="sm"
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unplug className="w-4 h-4" />}
                Disconnect WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════ STEP 1 — ONE BUTTON ════ */
  if (step === 1) {
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            Connect WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Let your AI agent reply to customers on WhatsApp automatically.
          </p>
        </div>

        <Card className="glass-card border-border">
          <CardContent className="p-6 space-y-5">
            <div className="flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                ByChat will assign you a WhatsApp number instantly. Customers can message that number and your AI agent will reply 24/7 — no extra setup on your side.
              </p>
            </div>

            <div className="space-y-3">
              {[
                { icon: Wifi, text: "A WhatsApp number is assigned to your store" },
                { icon: MessageSquare, text: "Customers message it, AI replies automatically" },
                { icon: Check, text: "Works with your existing store products and AI settings" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-7 h-7 rounded-full bg-[#25D366]/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-[#25D366]" />
                  </div>
                  {text}
                </div>
              ))}
            </div>

            <Button
              size="lg"
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white text-base"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting
                ? <Loader2 className="w-5 h-5 animate-spin" />
                : <WhatsAppIcon className="w-5 h-5" />}
              {connecting ? "Setting up your number…" : "Connect WhatsApp"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════ STEP 2 — SEND JOIN MESSAGE ════ */
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
          One Last Step
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Activate your number from your phone.</p>
      </div>

      <Card className="glass-card border-[#25D366]/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#25D366]" />
            Send this activation message from WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open WhatsApp on your phone, send the message below to activate your store's WhatsApp number. This is a one-time step.
          </p>

          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Send to:</p>
            <p className="text-xl font-bold tracking-wide">{SANDBOX_NUMBER}</p>
          </div>

          <div className="rounded-lg bg-muted p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Your activation message:</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xl font-bold font-mono">
                {joinKeyword ? `join ${joinKeyword}` : "join <your-keyword>"}
              </p>
              <Button variant="outline" size="sm" onClick={copyJoin} className="shrink-0 gap-1.5">
                {copiedJoin ? <Check className="w-3.5 h-3.5 text-green-500" /> : null}
                {copiedJoin ? "Copied!" : "Copy"}
              </Button>
            </div>
          </div>

          <a
            href={`https://wa.me/${SANDBOX_NUMBER.replace("+", "")}?text=${encodeURIComponent(joinKeyword ? `join ${joinKeyword}` : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Open WhatsApp &amp; Send Activation
          </a>

          <Button size="lg" variant="outline" className="w-full gap-2" onClick={handleJoinConfirmed}>
            <Check className="w-5 h-5 text-[#25D366]" />
            I sent it — I'm done!
          </Button>

          <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-500 mt-0.5" />
            <p className="text-xs text-yellow-200 leading-relaxed">
              This is a testing number. Your customers need to send the same activation message once before they can chat with you. When ByChat launches fully, each store gets a dedicated number automatically — no activation needed.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
