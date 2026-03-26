import { useState } from "react";
import {
  Loader2, AlertTriangle, Check, Unplug, Info, Phone,
  MessageSquare, ChevronDown, ChevronUp, Zap, Settings2, ExternalLink,
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
import { WhatsAppInbox } from "@/components/seller/WhatsAppInbox";

const WhatsAppIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const SANDBOX_NUMBER = "+14155238886";
const META_WEBHOOK_URL = "https://epoqhtjaqmwqmapfrcwn.supabase.co/functions/v1/whatsapp-meta-webhook";
const META_VERIFY_TOKEN = "bychat_meta_webhook_verify_2024";

type ConnectionMethod = null | "meta" | "bychat";

export default function SellerWhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: seller, isLoading } = useSellerProfile();

  const [method, setMethod] = useState<ConnectionMethod>(null);

  // ByChat/Twilio state
  const [step, setStep] = useState<1 | 2>(1);
  const [connecting, setConnecting] = useState(false);
  const [joinKeyword, setJoinKeyword] = useState("");
  const [copiedJoin, setCopiedJoin] = useState(false);

  // Meta direct state
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [metaConnecting, setMetaConnecting] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedVerify, setCopiedVerify] = useState(false);

  // Shared
  const [disconnecting, setDisconnecting] = useState(false);

  const isConnected = !!seller?.whatsapp_connected;

  /* ── ByChat/Twilio Connect ── */
  async function handleByChatConnect() {
    setConnecting(true);
    try {
      const res = await fetch(
        "https://epoqhtjaqmwqmapfrcwn.supabase.co/functions/v1/whatsapp-connect",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seller_id: seller!.id }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Connection failed");

      if (data?.is_sandbox) {
        setJoinKeyword(data?.join_keyword ?? "");
        setStep(2);
      } else {
        await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
        toast({ title: "WhatsApp connected!", description: `Your number is ${data.phone_number}` });
      }
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

  /* ── Meta Direct Connect ── */
  async function handleMetaConnect() {
    if (!phoneNumberId.trim()) return toast({ title: "Missing Phone Number ID", variant: "destructive" });
    if (!wabaId.trim()) return toast({ title: "Missing WABA ID", variant: "destructive" });
    if (!metaAccessToken.trim()) return toast({ title: "Missing Access Token", variant: "destructive" });

    setMetaConnecting(true);
    try {
      // Test the credentials by calling Meta API
      const testRes = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}`,
        { headers: { Authorization: `Bearer ${metaAccessToken.trim()}` } }
      );
      const testData = await testRes.json();

      if (!testRes.ok) {
        throw new Error(
          testData?.error?.message ?? "Meta API rejected your credentials. Double-check your Phone Number ID and Access Token."
        );
      }

      const displayPhone = testData.display_phone_number ?? testData.verified_name ?? phoneNumberId;

      // Save to DB
      const { error } = await supabase
        .from("sellers")
        .update({
          whatsapp_connected: true,
          whatsapp_phone_number: displayPhone,
          whatsapp_phone_id: phoneNumberId.trim(),
          whatsapp_waba_id: wabaId.trim(),
          whatsapp_access_token: metaAccessToken.trim(),
          // Clear Twilio fields
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_from_number: null,
        })
        .eq("id", seller!.id);

      if (error) throw new Error(error.message);

      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      toast({ title: "WhatsApp connected!", description: `Connected via Meta API — ${displayPhone}` });
    } catch (err: unknown) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setMetaConnecting(false);
    }
  }

  /* ── Disconnect ── */
  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const { error } = await supabase
        .from("sellers")
        .update({
          whatsapp_connected: false,
          whatsapp_phone_number: null,
          whatsapp_phone_id: null,
          whatsapp_waba_id: null,
          whatsapp_access_token: null,
          twilio_account_sid: null,
          twilio_auth_token: null,
          twilio_from_number: null,
        })
        .eq("id", seller!.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setMethod(null);
      setStep(1);
      toast({ title: "Disconnected", description: "WhatsApp has been disconnected." });
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  function handleJoinConfirmed() {
    queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
    toast({ title: "WhatsApp connected!", description: "Your AI agent is now live on WhatsApp." });
  }

  function copyToClipboard(text: string, setter: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     CONNECTED STATE
     ════════════════════════════════════════════════ */
  if (isConnected) {
    const isMeta = !!seller?.whatsapp_phone_id;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
              WhatsApp
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Your AI agent is live on WhatsApp.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center">
                <WhatsAppIcon className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  {seller?.whatsapp_phone_number ?? SANDBOX_NUMBER}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isMeta ? "Meta API" : "Twilio"}
                </p>
              </div>
            </div>
            <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30">Active</Badge>
            <Button
              variant="outline" size="sm"
              className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
              Disconnect
            </Button>
          </div>
        </div>

        <WhatsAppInbox sellerId={seller!.id} />
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     BYCHAT METHOD — STEP 2 (SANDBOX JOIN)
     ════════════════════════════════════════════════ */
  if (method === "bychat" && step === 2) {
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
                <Button
                  variant="outline" size="sm"
                  onClick={() => copyToClipboard(joinKeyword ? `join ${joinKeyword}` : "", setCopiedJoin)}
                  className="shrink-0 gap-1.5"
                >
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
              Open WhatsApp & Send Activation
            </a>

            <Button size="lg" variant="outline" className="w-full gap-2" onClick={handleJoinConfirmed}>
              <Check className="w-5 h-5 text-[#25D366]" />
              I sent it — I'm done!
            </Button>

            <div className="flex gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-500 mt-0.5" />
              <p className="text-xs text-yellow-200 leading-relaxed">
                This is a testing number. Your customers need to send the same activation message once before they can chat with you. When ByChat launches fully, each store gets a dedicated number automatically.
              </p>
            </div>

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => { setMethod(null); setStep(1); }}>
              Back to options
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     META METHOD — SETUP FORM
     ════════════════════════════════════════════════ */
  if (method === "meta") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
            Connect Your Own WhatsApp Number
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Use the official Meta WhatsApp Business API with your own phone number
          </p>
        </div>

        {/* What you need banner */}
        <div className="flex gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <Info className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-medium text-blue-300">What you need</p>
            <p className="text-muted-foreground">
              A <b>Meta Business account</b> with a <b>WhatsApp Business App</b> set up in the{" "}
              <b>Meta Developer Portal</b>. You'll get 3 things from there: Phone Number ID, WABA ID, and an Access Token.
            </p>
          </div>
        </div>

        {/* Step-by-step guide */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4" />
              Step-by-Step Setup Guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">

            <CollapsibleStep
              number={1}
              title="Create a Meta Business Account"
              expanded={expandedStep === 1}
              onToggle={() => setExpandedStep(expandedStep === 1 ? null : 1)}
            >
              <div className="space-y-2">
                <p>If you don't already have one:</p>
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>Go to <b className="text-foreground">business.facebook.com</b></li>
                  <li>Click <b className="text-foreground">Create Account</b></li>
                  <li>Enter your business name and your info</li>
                  <li>Verify your email address</li>
                </ol>
                <p className="text-xs text-muted-foreground">If you already have a Meta Business account, skip to Step 2.</p>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={2}
              title="Create a WhatsApp Business App"
              expanded={expandedStep === 2}
              onToggle={() => setExpandedStep(expandedStep === 2 ? null : 2)}
            >
              <div className="space-y-2">
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>Go to <b className="text-foreground">developers.facebook.com</b></li>
                  <li>Click <b className="text-foreground">My Apps</b> (top-right) then <b className="text-foreground">Create App</b></li>
                  <li>Choose <b className="text-foreground">"Other"</b> as the use case, then click Next</li>
                  <li>Choose <b className="text-foreground">"Business"</b> as the app type</li>
                  <li>Give it a name like <b className="text-foreground">"ByChat WhatsApp"</b></li>
                  <li>Select your Meta Business account and click <b className="text-foreground">Create App</b></li>
                </ol>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={3}
              title="Add WhatsApp to your app"
              expanded={expandedStep === 3}
              onToggle={() => setExpandedStep(expandedStep === 3 ? null : 3)}
            >
              <div className="space-y-2">
                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                  <li>On your app's dashboard, find <b className="text-foreground">"WhatsApp"</b> in the product list</li>
                  <li>Click <b className="text-foreground">Set Up</b></li>
                  <li>Select your Meta Business account when asked</li>
                  <li>You'll see the <b className="text-foreground">WhatsApp Getting Started</b> page</li>
                </ol>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={4}
              title="Get your Phone Number ID and WABA ID"
              expanded={expandedStep === 4}
              onToggle={() => setExpandedStep(expandedStep === 4 ? null : 4)}
              highlight
            >
              <div className="space-y-2">
                <p>On the WhatsApp Getting Started page:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    You'll see a <b className="text-foreground">test phone number</b> provided by Meta, or you can add your own number
                  </li>
                  <li>
                    Look for <b className="text-foreground">Phone Number ID</b> — it's a long number like{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs text-foreground">123456789012345</span>
                  </li>
                  <li>
                    Look for <b className="text-foreground">WhatsApp Business Account ID</b> (WABA ID) — also a long number
                  </li>
                </ol>
                <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 mt-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <p className="text-xs text-amber-200/80">
                    You can find these in: <b>WhatsApp</b> {">"} <b>API Setup</b> on the left sidebar of your Meta app dashboard.
                  </p>
                </div>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={5}
              title="Generate an Access Token"
              expanded={expandedStep === 5}
              onToggle={() => setExpandedStep(expandedStep === 5 ? null : 5)}
              highlight
            >
              <div className="space-y-2">
                <p>You need a <b>permanent access token</b> (not the temporary one):</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>
                    Go to <b className="text-foreground">Business Settings</b> {">"} <b className="text-foreground">System Users</b>
                  </li>
                  <li>Click <b className="text-foreground">Add</b> to create a new system user (name it "ByChat")</li>
                  <li>Set the role to <b className="text-foreground">Admin</b></li>
                  <li>Click <b className="text-foreground">Generate New Token</b></li>
                  <li>Select your <b className="text-foreground">WhatsApp app</b></li>
                  <li>
                    Check these permissions:{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs text-foreground">whatsapp_business_messaging</span>{" "}
                    and{" "}
                    <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs text-foreground">whatsapp_business_management</span>
                  </li>
                  <li>Click <b className="text-foreground">Generate Token</b> and <b className="text-foreground">copy it</b></li>
                </ol>
                <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 mt-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                  <p className="text-xs text-red-200/80">
                    Copy this token immediately — it won't be shown again!
                  </p>
                </div>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={6}
              title="Set up the Webhook in Meta"
              expanded={expandedStep === 6}
              onToggle={() => setExpandedStep(expandedStep === 6 ? null : 6)}
              highlight
            >
              <div className="space-y-3">
                <p>This tells Meta where to send incoming messages:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>In your Meta app, go to <b className="text-foreground">WhatsApp</b> {">"} <b className="text-foreground">Configuration</b></li>
                  <li>Under <b className="text-foreground">Webhook</b>, click <b className="text-foreground">Edit</b></li>
                  <li>Paste this <b className="text-foreground">Callback URL</b>:</li>
                </ol>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">Callback URL:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all flex-1 text-foreground">{META_WEBHOOK_URL}</code>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => copyToClipboard(META_WEBHOOK_URL, setCopiedWebhook)}
                      className="shrink-0 text-xs"
                    >
                      {copiedWebhook ? <Check className="w-3 h-3 text-green-500" /> : null}
                      {copiedWebhook ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs text-muted-foreground mb-1">Verify Token:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono break-all flex-1 text-foreground">{META_VERIFY_TOKEN}</code>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => copyToClipboard(META_VERIFY_TOKEN, setCopiedVerify)}
                      className="shrink-0 text-xs"
                    >
                      {copiedVerify ? <Check className="w-3 h-3 text-green-500" /> : null}
                      {copiedVerify ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>

                <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground" start={4}>
                  <li>Click <b className="text-foreground">Verify and Save</b></li>
                  <li>Under <b className="text-foreground">Webhook Fields</b>, click <b className="text-foreground">Manage</b> and subscribe to <b className="text-foreground">messages</b></li>
                </ol>
              </div>
            </CollapsibleStep>

            <CollapsibleStep
              number={7}
              title="Paste your details below and connect"
              expanded={expandedStep === 7}
              onToggle={() => setExpandedStep(expandedStep === 7 ? null : 7)}
            >
              <p>
                Scroll down to the connection form below. Enter your Phone Number ID, WABA ID, and Access Token, then click <b>Test & Connect</b>.
              </p>
            </CollapsibleStep>
          </CardContent>
        </Card>

        {/* Connection Form */}
        <Card className="glass-card border-[#25D366]/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Connect Your WhatsApp</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Phone Number ID</Label>
              <Input
                placeholder="123456789012345"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Found in: WhatsApp {">"} API Setup {">"} Phone Number ID
              </p>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Business Account ID (WABA ID)</Label>
              <Input
                placeholder="123456789012345"
                value={wabaId}
                onChange={(e) => setWabaId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Found in: WhatsApp {">"} API Setup {">"} WhatsApp Business Account ID
              </p>
            </div>

            <div className="space-y-2">
              <Label>Permanent Access Token</Label>
              <Input
                type="password"
                placeholder="EAAxxxxxxxxxxxxxxx..."
                value={metaAccessToken}
                onChange={(e) => setMetaAccessToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                From Step 5 — the system user token with WhatsApp permissions
              </p>
            </div>

            <Button
              onClick={handleMetaConnect}
              disabled={metaConnecting}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white"
            >
              {metaConnecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <WhatsAppIcon className="w-4 h-4" />
              )}
              {metaConnecting ? "Testing connection..." : "Test & Connect"}
            </Button>
          </CardContent>
        </Card>

        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setMethod(null)}>
          Back to options
        </Button>
      </div>
    );
  }

  /* ════════════════════════════════════════════════
     BYCHAT METHOD — COMING SOON (redirect back)
     ════════════════════════════════════════════════ */
  if (method === "bychat") {
    // This option is disabled / coming soon — redirect back to selection
    setMethod(null);
  }

  /* ════════════════════════════════════════════════
     METHOD SELECTION (DEFAULT VIEW)
     ════════════════════════════════════════════════ */
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <WhatsAppIcon className="w-6 h-6 text-[#25D366]" />
          Connect WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Let your AI agent reply to customers on WhatsApp automatically. Choose how you want to connect:
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Option A: Your Own Number (Meta) */}
        <Card
          className="glass-card border-[#25D366]/30 hover:border-[#25D366]/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          onClick={() => setMethod("meta")}
        >
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center">
                <Settings2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <Badge className="bg-[#25D366]/20 text-[#25D366] border-[#25D366]/30 text-xs mb-1">
                  Recommended
                </Badge>
                <h3 className="font-semibold text-base">Your Own Number</h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              Connect your own WhatsApp Business number through <b>Meta's official API</b>. Customers message your real business number.
            </p>

            <div className="space-y-2">
              {[
                "Use your own phone number",
                "Full control over your WhatsApp",
                "Professional & branded",
                "Works immediately",
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <b>Requires:</b> Meta Business account + WhatsApp Business API setup (~15 min)
              </p>
            </div>

            <Button className="w-full gap-2 bg-[#25D366] hover:bg-[#1da851] text-white">
              <Settings2 className="w-4 h-4" />
              Set Up My Own Number
            </Button>
          </CardContent>
        </Card>

        {/* Option B: ByChat Number (Twilio) — Coming Soon */}
        <Card className="glass-card border-border opacity-60 cursor-not-allowed relative overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted-foreground/30 to-muted-foreground/20 flex items-center justify-center">
                <Zap className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <Badge variant="outline" className="text-xs mb-1 border-yellow-500/40 text-yellow-400">
                  Coming Soon
                </Badge>
                <h3 className="font-semibold text-base">ByChat Dedicated Number</h3>
              </div>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              We buy and assign a <b>dedicated WhatsApp number</b> for your store. One click — no setup needed on your side. Your AI agent is connected to it automatically.
            </p>

            <div className="space-y-2">
              {[
                "One-click setup — we do everything",
                "Dedicated number just for your store",
                "No Meta account needed",
                "AI agent connected automatically",
              ].map((text, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Check className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  {text}
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground">
                <b>Requires:</b> Nothing — just click and go
              </p>
            </div>

            <Button variant="outline" className="w-full gap-2" disabled>
              <Zap className="w-4 h-4" />
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Comparison */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <Info className="w-4 h-4" />
            What's the difference?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 pr-4 text-muted-foreground font-medium"></th>
                  <th className="text-left py-2 px-3 font-medium text-[#25D366]">Your Own Number</th>
                  <th className="text-left py-2 px-3 font-medium text-muted-foreground">ByChat Number <span className="text-yellow-400">(Soon)</span></th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground">How it works</td>
                  <td className="py-2 px-3">You set up WhatsApp Business API and give us your credentials</td>
                  <td className="py-2 px-3">We buy a number for you and connect it automatically</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground">Phone number</td>
                  <td className="py-2 px-3">Your own real number</td>
                  <td className="py-2 px-3">A dedicated number we assign to you</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground">Setup</td>
                  <td className="py-2 px-3">~15 minutes (you do it yourself)</td>
                  <td className="py-2 px-3">1 click (we handle everything)</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground">Customer experience</td>
                  <td className="py-2 px-3">They message your real number</td>
                  <td className="py-2 px-3">They message the number we give you</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 pr-4 font-medium text-foreground">Status</td>
                  <td className="py-2 px-3 text-[#25D366] font-medium">Available now</td>
                  <td className="py-2 px-3 text-yellow-400 font-medium">Coming soon</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-medium text-foreground">Cost</td>
                  <td className="py-2 px-3">Free (Meta API is free)</td>
                  <td className="py-2 px-3">Free</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Collapsible Step Component ── */
function CollapsibleStep({
  number,
  title,
  children,
  expanded,
  onToggle,
  highlight,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
  expanded?: boolean;
  onToggle?: () => void;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border transition-colors ${
        highlight
          ? "border-[#25D366]/30 bg-[#25D366]/5"
          : expanded
          ? "border-border bg-muted/10"
          : "border-transparent"
      }`}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-3 w-full p-3 text-left hover:bg-muted/20 rounded-lg transition-colors"
      >
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
            highlight
              ? "bg-[#25D366] text-white"
              : "bg-[#25D366]/20 text-[#25D366]"
          }`}
        >
          {number}
        </div>
        <p className="font-medium flex-1 text-sm">{title}</p>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pl-[2.75rem] text-sm text-muted-foreground animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}
