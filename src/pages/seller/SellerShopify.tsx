import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import {
  Loader2,
  ShoppingBag,
  Check,
  RefreshCw,
  Unplug,
  ExternalLink,
  AlertTriangle,
  PackageCheck,
  PackagePlus,
  PackageX,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const EDGE_URL =
  "https://epoqhtjaqmwqmapfrcwn.supabase.co/functions/v1/shopify-sync";

type SyncResult = {
  imported: number;
  updated: number;
  errors: number;
  total_shopify_products: number;
};

/** Extract the myshopify.com handle from various URL formats */
function cleanStoreUrl(raw: string): string {
  let s = raw.trim().toLowerCase();
  // Remove protocol
  s = s.replace(/^https?:\/\//, "");
  // Handle admin.shopify.com/store/HANDLE format
  const adminMatch = s.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;
  // Remove trailing path
  s = s.replace(/\/.*$/, "");
  // If they just typed the handle without .myshopify.com
  if (!s.includes(".")) return `${s}.myshopify.com`;
  return s;
}

/** Validate token format and return error message or null */
function validateToken(token: string): string | null {
  const t = token.trim();
  if (!t) return "Please paste your access token";
  if (t.startsWith("shpss_")) {
    return "This is the API Secret Key (shpss_), not the Access Token. You need the Admin API Access Token that starts with shpat_. See Step 5 below for where to find it.";
  }
  if (t.startsWith("shppa_")) {
    return "This looks like a Partner API token. You need the Admin API Access Token that starts with shpat_. See Step 5 below.";
  }
  if (!t.startsWith("shpat_")) {
    return "The access token should start with shpat_. Make sure you copied the Admin API Access Token (not the API Key or Secret). See Step 5 below.";
  }
  return null;
}

export default function SellerShopify() {
  const { data: seller, isLoading } = useSellerProfile();
  const queryClient = useQueryClient();

  const [storeUrl, setStoreUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const isConnected = !!seller?.shopify_connected;

  async function callEdge(payload: Record<string, string>) {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Request failed");
    return data;
  }

  async function handleConnect() {
    if (!storeUrl.trim()) return toast.error("Please enter your store URL");
    const tokErr = validateToken(accessToken);
    if (tokErr) {
      setTokenError(tokErr);
      return toast.error(tokErr);
    }
    setTokenError(null);
    setConnecting(true);
    setSyncResult(null);
    try {
      const cleanedUrl = cleanStoreUrl(storeUrl);
      const data = await callEdge({
        seller_id: seller!.id,
        action: "connect",
        store_url: cleanedUrl,
        access_token: accessToken.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      setSyncResult(data);
      toast.success(
        `Shopify connected! Imported ${data.imported} products, updated ${data.updated}.`
      );
    } catch (err: any) {
      const msg = err.message || "Connection failed";
      if (msg.includes("401")) {
        toast.error(
          "Connection failed: Shopify rejected the token. Make sure you copied the Admin API Access Token (starts with shpat_), not the API Key or Secret."
        );
        setTokenError(
          "Shopify rejected this token. Double-check you copied the Admin API Access Token (shpat_), not the API Key or API Secret."
        );
      } else if (msg.includes("404") || msg.includes("Not Found")) {
        toast.error(
          "Store not found. Double-check your store URL. It should look like: yourstore.myshopify.com"
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const data = await callEdge({
        seller_id: seller!.id,
        action: "sync",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      setSyncResult(data);
      toast.success(`Sync complete! ${data.imported} new, ${data.updated} updated.`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await callEdge({
        seller_id: seller!.id,
        action: "disconnect",
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      setSyncResult(null);
      setConfirmDisconnect(false);
      setStoreUrl("");
      setAccessToken("");
      setTokenError(null);
      toast.success("Shopify disconnected.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  function toggleStep(step: number) {
    setExpandedStep(expandedStep === step ? null : step);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── CONNECTED STATE ──
  if (isConnected) {
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6" />
            Shopify Integration
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your Shopify store is connected and syncing products
          </p>
        </div>

        {/* Connection Status Card */}
        <Card className="glass-card border-[#96BF48]/40">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#96BF48] to-[#5E8E3E] flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">{seller?.shopify_store_url}</p>
                  <p className="text-xs text-muted-foreground">
                    Last synced:{" "}
                    {seller?.shopify_last_sync_at
                      ? new Date(seller.shopify_last_sync_at).toLocaleString()
                      : "Never"}
                  </p>
                </div>
              </div>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <Check className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSync}
                disabled={syncing}
                className="flex-1"
                variant="outline"
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                {syncing ? "Syncing..." : "Sync Now"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sync Results */}
        {syncResult && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Sync Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <PackagePlus className="w-5 h-5 mx-auto text-green-400 mb-1" />
                  <p className="text-lg font-bold text-green-400">{syncResult.imported}</p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <PackageCheck className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                  <p className="text-lg font-bold text-blue-400">{syncResult.updated}</p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <PackageX className="w-5 h-5 mx-auto text-red-400 mb-1" />
                  <p className="text-lg font-bold text-red-400">{syncResult.errors}</p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-1">
                Total products on Shopify: {syncResult.total_shopify_products}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Disconnect */}
        <Card className="glass-card border-destructive/20">
          <CardContent className="p-5">
            {confirmDisconnect ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  <p>
                    This will disconnect your Shopify store and mark all imported
                    products as unavailable. Are you sure?
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Yes, Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDisconnect(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirmDisconnect(true)}
              >
                <Unplug className="w-4 h-4 mr-2" />
                Disconnect Shopify
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── NOT CONNECTED STATE ──
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          Connect Shopify
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import your Shopify products so your AI agent can sell them via chat
        </p>
      </div>

      {/* Important Info Banner */}
      <div className="flex gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <Info className="w-5 h-5 shrink-0 text-blue-400 mt-0.5" />
        <div className="text-sm space-y-1">
          <p className="font-medium text-blue-300">Before you start</p>
          <p className="text-muted-foreground">
            You need to create a <b>Custom App</b> in your Shopify store and get the{" "}
            <b>Admin API Access Token</b> (starts with <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs">shpat_</span>).
            Follow the steps below — it takes about 2 minutes.
          </p>
        </div>
      </div>

      {/* Setup Guide */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Step-by-Step Setup Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {/* Step 1 */}
          <StepItem
            number={1}
            title="Log in to your Shopify Admin"
            expanded={expandedStep === 1}
            onToggle={() => toggleStep(1)}
          >
            <div className="space-y-2">
              <p>Open your browser and go to your Shopify store admin page.</p>
              <p>Your admin URL looks like this:</p>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                <span className="font-mono text-xs flex-1 break-all">
                  https://admin.shopify.com/store/YOUR-STORE-NAME
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                If you're already logged in to Shopify, you should see your store dashboard.
              </p>
            </div>
          </StepItem>

          {/* Step 2 */}
          <StepItem
            number={2}
            title='Go to "Apps and sales channels" in Settings'
            expanded={expandedStep === 2}
            onToggle={() => toggleStep(2)}
          >
            <div className="space-y-2">
              <p>In your Shopify Admin:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Click <b className="text-foreground">Settings</b> (gear icon at the bottom-left of the page)</li>
                <li>In the Settings menu, click <b className="text-foreground">Apps and sales channels</b></li>
                <li>Click <b className="text-foreground">Develop apps</b> (button at the top of the page)</li>
                <li>If you see a message saying "Allow custom app development", click <b className="text-foreground">Allow custom app development</b> and confirm</li>
              </ol>
            </div>
          </StepItem>

          {/* Step 3 */}
          <StepItem
            number={3}
            title="Create a new app"
            expanded={expandedStep === 3}
            onToggle={() => toggleStep(3)}
          >
            <div className="space-y-2">
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Click the <b className="text-foreground">Create an app</b> button</li>
                <li>For the app name, type: <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">ByChat Integration</span></li>
                <li>Click <b className="text-foreground">Create app</b></li>
              </ol>
            </div>
          </StepItem>

          {/* Step 4 */}
          <StepItem
            number={4}
            title="Set permissions (API scopes)"
            expanded={expandedStep === 4}
            onToggle={() => toggleStep(4)}
          >
            <div className="space-y-2">
              <p>After creating the app, you'll be on the app overview page:</p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>Click <b className="text-foreground">Configure Admin API scopes</b></li>
                <li>In the search box, type <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">read_products</span></li>
                <li>Check the box next to <b className="text-foreground">read_products</b></li>
                <li>Scroll down and click <b className="text-foreground">Save</b></li>
              </ol>
              <div className="flex gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5 mt-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-yellow-500 mt-0.5" />
                <p className="text-xs text-yellow-200/80">
                  Only check <b>read_products</b>. ByChat only needs to read your products — it won't change anything in your Shopify store.
                </p>
              </div>
            </div>
          </StepItem>

          {/* Step 5 */}
          <StepItem
            number={5}
            title="Install the app and get your Access Token"
            expanded={expandedStep === 5}
            onToggle={() => toggleStep(5)}
            highlight
          >
            <div className="space-y-3">
              <p>This is the most important step:</p>
              <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                <li>Click the <b className="text-foreground">API credentials</b> tab (at the top of the page)</li>
                <li>Click the <b className="text-foreground">Install app</b> button, then confirm by clicking <b className="text-foreground">Install</b></li>
                <li>
                  After installing, you'll see a section called{" "}
                  <b className="text-foreground">Admin API access token</b>
                </li>
                <li>
                  Click <b className="text-foreground">Reveal token once</b> — a token starting with{" "}
                  <span className="font-mono bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">shpat_</span>{" "}
                  will appear
                </li>
                <li><b className="text-foreground">Copy this token immediately</b></li>
              </ol>

              <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-red-300">Very Important!</p>
                  <p className="text-red-200/80">
                    This token is <b>shown only once</b>. If you close the page without copying it, you'll need to uninstall and reinstall the app to get a new one.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="text-xs space-y-1.5">
                  <p className="font-medium text-amber-300">Don't confuse these tokens!</p>
                  <div className="space-y-1 text-amber-200/80">
                    <p>
                      <span className="font-mono bg-green-500/10 text-green-400 px-1 py-0.5 rounded">shpat_...</span>{" "}
                      = <b>Admin API Access Token</b> — this is the one you need
                    </p>
                    <p>
                      <span className="font-mono bg-red-500/10 text-red-400 px-1 py-0.5 rounded">shpss_...</span>{" "}
                      = API Secret Key — do NOT use this one
                    </p>
                    <p>
                      <span className="font-mono bg-red-500/10 text-red-400 px-1 py-0.5 rounded">API key</span>{" "}
                      = also NOT the right one
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </StepItem>

          {/* Step 6 */}
          <StepItem
            number={6}
            title="Paste your details below and connect"
            expanded={expandedStep === 6}
            onToggle={() => toggleStep(6)}
          >
            <div className="space-y-2">
              <p>
                Scroll down to the <b>"Connect Your Store"</b> form below. Enter your store URL and paste
                the <span className="font-mono bg-green-500/10 text-green-400 px-1 py-0.5 rounded text-xs">shpat_</span> token,
                then click <b>Test & Connect</b>.
              </p>
            </div>
          </StepItem>
        </CardContent>
      </Card>

      {/* Connect Form */}
      <Card className="glass-card border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connect Your Store</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-url">Shopify Store URL</Label>
            <Input
              id="store-url"
              placeholder="yourstore.myshopify.com"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              You can paste any of these formats — we'll figure it out:
            </p>
            <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5 pl-1">
              <li><span className="font-mono">yourstore.myshopify.com</span></li>
              <li><span className="font-mono">https://admin.shopify.com/store/yourstore</span></li>
              <li><span className="font-mono">yourstore</span> (just the store name)</li>
            </ul>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">
              Admin API Access Token
              <span className="text-xs text-muted-foreground font-normal ml-2">
                (starts with shpat_)
              </span>
            </Label>
            <Input
              id="access-token"
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setTokenError(null);
              }}
              className={tokenError ? "border-red-500/50" : ""}
            />
            {tokenError ? (
              <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <p className="text-xs text-red-300">{tokenError}</p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                From Step 5 above — click "Reveal token once" after installing the app
              </p>
            )}
          </div>

          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full"
            variant="hero"
          >
            {connecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ShoppingBag className="w-4 h-4 mr-2" />
            )}
            {connecting ? "Connecting & importing products..." : "Test & Connect"}
          </Button>
        </CardContent>
      </Card>

      {/* Sync Results (shown after initial connect) */}
      {syncResult && (
        <Card className="glass-card border-green-500/30">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center gap-2 text-green-400">
              <Check className="w-5 h-5" />
              <span className="font-medium">Connected successfully!</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Imported {syncResult.imported} products, updated {syncResult.updated}
              {syncResult.errors > 0 && `, ${syncResult.errors} errors`}.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Troubleshooting */}
      <Card className="glass-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="w-4 h-4" />
            Having trouble?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <div className="space-y-2">
            <p className="font-medium text-foreground">Common issues:</p>
            <div className="space-y-2">
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">"Shopify returned 401"</p>
                <p>The token is wrong. Make sure you're using the <b>Admin API Access Token</b> (starts with <span className="font-mono text-green-400">shpat_</span>), NOT the API Secret Key (<span className="font-mono text-red-400">shpss_</span>) and NOT the API Key.</p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">"Store not found"</p>
                <p>Check your store URL. It should be your <span className="font-mono">.myshopify.com</span> address. You can find it in your browser URL when you're logged in to Shopify.</p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">"I can't find the access token"</p>
                <p>You need to <b>install the app first</b> (Step 5), then click "Reveal token once". The token only appears after the app is installed.</p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">"I lost my token"</p>
                <p>Go back to your Shopify app, uninstall it, then reinstall it. You'll get a new token to copy.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StepItem({
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
          ? "border-primary/30 bg-primary/5"
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
              ? "bg-primary text-primary-foreground"
              : "bg-primary/20 text-primary"
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
