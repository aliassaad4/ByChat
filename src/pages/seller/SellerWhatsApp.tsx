import { useState } from "react";
import {
  Loader2, AlertTriangle, Copy, Check, Unplug,
  Info, Phone, ExternalLink, MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL   = import.meta.env.VITE_SUPABASE_URL || "https://epoqhtjaqmwqmapfrcwn.supabase.co";
const SANDBOX_NUMBER = "+14155238886";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export default function SellerWhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: seller, isLoading } = useSellerProfile();

  // Step 1 = enter credentials, Step 2 = join sandbox
  const [step, setStep]               = useState<1 | 2>(1);
  const [accountSid, setAccountSid]   = useState("");
  const [authToken, setAuthToken]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [joinKeyword, setJoinKeyword] = useState("");  // returned by backend
  const [copiedJoin, setCopiedJoin]   = useState(false);

  const isConnected = !!seller?.whatsapp_connected;

  /* ── Step 1: submit credentials → backend auto-configures webhook ── */
  async function handleConnect() {
    if (!accountSid.trim() || !authToken.trim()) {
      toast({ title: "Missing fields", description: "Enter your Account SID and Auth Token.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: {
          account_sid: accountSid.trim(),
          auth_token:  authToken.trim(),
          seller_id:   seller!.id,
        },
      });
      if (error) throw new Error(error.message ?? "Connection failed");
      if (data?.error) throw new Error(data.error);

      // Move to step 2 — show the join instructions
      setJoinKeyword(data?.join_keyword ?? "");
      setStep(2);
    } catch (err: unknown) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  /* ── Step 2: seller confirmed they sent the join message ── */
  async function handleJoinConfirmed() {
    await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
    toast({ title: "WhatsApp connected!", description: "Your AI agent is now live on WhatsApp." });
  }

  /* ── Disconnect ── */
  async function handleDisconnect() {
    if (!seller) return;
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
        .eq("id", seller.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setStep(1);
      setAccountSid(""); setAuthToken("");
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  function copyJoinMessage() {
    const msg = joinKeyword ? `join ${joinKeyword}` : `join <your-keyword>`;
    navigator.clipboard.writeText(msg);
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

  /* ════════════════════════════════════════
     CONNECTED STATE
  ════════════════════════════════════════ */
  if (isConnected) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            WhatsApp Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your AI agent is live and replying to customers automatically.
          </p>
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
                Customers who message this number on WhatsApp will receive instant AI replies based on your store products and settings.
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

  /* ════════════════════════════════════════
     STEP 1 — ENTER CREDENTIALS
  ════════════════════════════════════════ */
  if (step === 1) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            Connect WhatsApp
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            3 simple steps — takes about 5 minutes.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${n === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {n}
              </div>
              {n < 3 && <div className="w-10 h-px bg-border" />}
            </div>
          ))}
          <p className="text-sm text-muted-foreground ml-2">Create account → Connect → Activate</p>
        </div>

        {/* Step 1 instruction */}
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
              Get your free Twilio account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Twilio is the service that connects your WhatsApp. It's free to sign up.</p>
            <ol className="space-y-1.5 list-decimal list-inside text-xs">
              <li>Click the button below to open Twilio</li>
              <li>Sign up with your email</li>
              <li>On the dashboard homepage, copy your <strong className="text-foreground">Account SID</strong> and <strong className="text-foreground">Auth Token</strong></li>
            </ol>
            <a
              href="https://www.twilio.com/try-twilio"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F22F46] hover:bg-[#d42940] text-white text-sm font-medium transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Open Twilio Sign Up
            </a>
          </CardContent>
        </Card>

        {/* Credentials form */}
        <Card className="glass-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
              Paste your credentials
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="account-sid">Account SID</Label>
              <Input
                id="account-sid"
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accountSid}
                onChange={e => setAccountSid(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auth-token">Auth Token</Label>
              <Input
                id="auth-token"
                type="password"
                placeholder="Your Twilio Auth Token"
                value={authToken}
                onChange={e => setAuthToken(e.target.value)}
              />
            </div>

            <Button
              size="lg"
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
              onClick={handleConnect}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <WhatsAppIcon className="w-5 h-5" />}
              {saving ? "Setting up…" : "Connect WhatsApp"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              We automatically configure everything in Twilio — no extra steps in their console.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════════
     STEP 2 — JOIN SANDBOX
  ════════════════════════════════════════ */
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
          One Last Step
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Activate your WhatsApp connection from your phone.
        </p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex items-center gap-3">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${n < 3 ? "bg-primary text-primary-foreground" : "bg-primary text-primary-foreground"}`}>
              {n < 3 ? <Check className="w-4 h-4" /> : n}
            </div>
            {n < 3 && <div className="w-10 h-px bg-primary" />}
          </div>
        ))}
        <p className="text-sm text-primary font-medium ml-2">Almost done!</p>
      </div>

      <Card className="glass-card border-[#25D366]/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#25D366]" />
            Send this message from your WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Open WhatsApp on your phone, start a new chat with the number below, and send the activation message exactly as shown.
          </p>

          <div className="space-y-3">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Send to this number:</p>
              <p className="text-lg font-bold">{SANDBOX_NUMBER}</p>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-xs text-muted-foreground">Your activation message:</p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-bold font-mono">
                  {joinKeyword ? `join ${joinKeyword}` : "join <your-keyword>"}
                </p>
                <Button variant="outline" size="sm" onClick={copyJoinMessage} className="shrink-0 gap-1.5">
                  {copiedJoin ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedJoin ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>

          <a
            href={`https://wa.me/${SANDBOX_NUMBER.replace("+", "")}?text=${encodeURIComponent(joinKeyword ? `join ${joinKeyword}` : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-medium transition-colors"
          >
            <WhatsAppIcon className="w-4 h-4" />
            Open WhatsApp &amp; Send Activation
          </a>

          <Button
            size="lg"
            variant="outline"
            className="w-full gap-2"
            onClick={handleJoinConfirmed}
          >
            <Check className="w-5 h-5 text-[#25D366]" />
            I sent the message — Done!
          </Button>

          <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500 mt-0.5" />
            <p className="text-xs text-yellow-200 leading-relaxed">
              This activation is a one-time step required by WhatsApp's testing environment. Your customers will also need to send this join message once before receiving messages.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
