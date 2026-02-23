import { useState } from "react";
import { Loader2, AlertTriangle, Copy, Check, Unplug, Info, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { useQueryClient } from "@tanstack/react-query";

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL as string;
const WEBHOOK_URL   = `${SUPABASE_URL}/functions/v1/whatsapp-webhook`;

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold">
        {n}
      </div>
      <div className="pt-0.5 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="text-sm text-muted-foreground mt-1">{children}</div>}
      </div>
    </div>
  );
}

export default function SellerWhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: seller, isLoading } = useSellerProfile();

  const [accountSid, setAccountSid]   = useState("");
  const [authToken, setAuthToken]     = useState("");
  const [fromNumber, setFromNumber]   = useState("");
  const [saving, setSaving]           = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [copied, setCopied]           = useState(false);

  const isConnected = !!seller?.whatsapp_connected;

  async function handleConnect() {
    if (!accountSid.trim() || !authToken.trim() || !fromNumber.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all three fields.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData.session?.access_token;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          account_sid: accountSid.trim(),
          auth_token:  authToken.trim(),
          from_number: fromNumber.trim(),
          seller_id:   seller!.id,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Connection failed");
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setAccountSid(""); setAuthToken(""); setFromNumber("");
      toast({ title: "WhatsApp connected!", description: `${result.phone_number} is now active.` });
    } catch (err: unknown) {
      toast({ title: "Connection failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

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
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  function copyWebhook() {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
          WhatsApp Integration
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Let your AI agent reply to customers on WhatsApp — 24/7, automatically.
        </p>
      </div>

      {/* ── Connected state ── */}
      {isConnected ? (
        <Card className="glass-card border-[#25D366]/30">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center">
                  <WhatsAppIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold">WhatsApp Connected</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    {seller?.whatsapp_phone_number}
                  </p>
                </div>
              </div>
              <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30">Active</Badge>
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">
                Your AI agent is live on WhatsApp. Customers who message your number will get instant AI replies.
              </p>
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
      ) : (
        /* ── Setup state ── */
        <>
          {/* How it works */}
          <Card className="glass-card border-border">
            <CardContent className="p-5 flex gap-3">
              <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                ByChat uses <strong className="text-foreground">Twilio</strong> to connect your WhatsApp number.
                Twilio is a free-to-sign-up messaging platform. You pay only for messages sent (~$0.005 each).
                Setup takes about 10 minutes and happens only once.
              </p>
            </CardContent>
          </Card>

          {/* Steps */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Setup Instructions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Step n={1} title="Create a free Twilio account">
                Go to{" "}
                <a href="https://www.twilio.com/try-twilio" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  twilio.com/try-twilio
                </a>{" "}
                and sign up. No credit card needed for the free trial.
              </Step>

              <Step n={2} title="Activate the WhatsApp Sandbox">
                In Twilio Console → left menu →{" "}
                <strong className="text-foreground">Messaging → Try it out → Send a WhatsApp message</strong>.
                Follow the on-screen steps to activate the sandbox (you send a join code to Twilio's number).
              </Step>

              <Step n={3} title="Set the webhook URL in Twilio">
                In the Sandbox settings page, find the field{" "}
                <strong className="text-foreground">"When a message comes in"</strong> and paste this URL:
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg break-all select-all">
                    {WEBHOOK_URL}
                  </code>
                  <Button variant="outline" size="sm" onClick={copyWebhook} className="shrink-0 gap-1.5">
                    {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                Make sure the method is set to <strong className="text-foreground">HTTP POST</strong>. Save.
              </Step>

              <Step n={4} title="Copy your credentials from Twilio Console">
                Go to the{" "}
                <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Twilio Console homepage
                </a>
                . You'll see your <strong className="text-foreground">Account SID</strong> and{" "}
                <strong className="text-foreground">Auth Token</strong> in the top section. The sandbox number is{" "}
                <strong className="text-foreground">+14155238886</strong>.
              </Step>

              <Step n={5} title="Paste your credentials below and click Connect" />
            </CardContent>
          </Card>

          {/* Credentials form */}
          <Card className="glass-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                Enter Your Twilio Credentials
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

              <div className="space-y-1.5">
                <Label htmlFor="from-number">WhatsApp Number</Label>
                <Input
                  id="from-number"
                  placeholder="+14155238886"
                  value={fromNumber}
                  onChange={e => setFromNumber(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  For the sandbox: <code className="bg-muted px-1 rounded">+14155238886</code>. For a paid Twilio number, enter that number instead.
                </p>
              </div>

              <Button
                size="lg"
                className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
                onClick={handleConnect}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <WhatsAppIcon className="w-5 h-5" />}
                {saving ? "Connecting…" : "Connect WhatsApp"}
              </Button>

              <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-yellow-500 mt-0.5" />
                <p className="text-xs text-yellow-200 leading-relaxed">
                  For the sandbox, your customers must first send{" "}
                  <strong className="text-yellow-100">join [your-sandbox-keyword]</strong> to +14155238886
                  before they can receive messages. This is only for testing. A paid Twilio number removes this requirement.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
