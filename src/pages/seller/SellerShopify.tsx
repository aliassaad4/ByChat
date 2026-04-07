import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Clock,
  History,
  RotateCcw,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const EDGE_URL =
  "https://epoqhtjaqmwqmapfrcwn.supabase.co/functions/v1/shopify-sync";

type SyncResult = {
  imported: number;
  updated: number;
  errors: number;
  total_shopify_products: number;
  error_details?: { product: string; variant: string; error: string }[];
};

type SyncHistoryEntry = {
  id: string;
  synced_at: string;
  imported: number;
  updated: number;
  errors: number;
  total_shopify_products: number;
  error_details: { product: string; variant: string; error: string }[] | null;
  trigger_type: string;
};

const AUTO_SYNC_OPTIONS = [
  { value: null, label: "Off" },
  { value: 1, label: "Every 1 hour" },
  { value: 6, label: "Every 6 hours" },
  { value: 12, label: "Every 12 hours" },
  { value: 24, label: "Every 24 hours" },
];

/** Extract the myshopify.com handle from various URL formats */
function cleanStoreUrl(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "");
  const adminMatch = s.match(/admin\.shopify\.com\/store\/([a-z0-9-]+)/);
  if (adminMatch) return `${adminMatch[1]}.myshopify.com`;
  s = s.replace(/\/.*$/, "");
  if (!s.includes(".")) return `${s}.myshopify.com`;
  return s;
}

type AuthMode = "oauth" | "token";

export default function SellerShopify() {
  const { data: seller, isLoading } = useSellerProfile();
  const queryClient = useQueryClient();

  const [storeUrl, setStoreUrl] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("oauth");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [autoSyncInterval, setAutoSyncInterval] = useState<number | null>(null);
  const [savingAutoSync, setSavingAutoSync] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  const isConnected = !!seller?.shopify_connected;

  // Load auto-sync interval from seller profile
  useEffect(() => {
    if (seller?.shopify_auto_sync_interval !== undefined) {
      setAutoSyncInterval(seller.shopify_auto_sync_interval ?? null);
    }
  }, [seller?.shopify_auto_sync_interval]);

  // Fetch sync history
  const { data: syncHistory } = useQuery({
    queryKey: ["shopify-sync-history", seller?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shopify_sync_history")
        .select("*")
        .eq("seller_id", seller!.id)
        .order("synced_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as SyncHistoryEntry[];
    },
    enabled: !!seller?.id && isConnected,
  });

  async function callEdge(payload: Record<string, unknown>) {
    const res = await fetch(EDGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      if (res.status === 429) {
        throw new Error(
          "Shopify rate limit reached. Please wait a minute and try again. Shopify allows 2 requests/second."
        );
      }
      throw new Error(data?.error ?? "Request failed");
    }
    return data;
  }

  async function handleConnect() {
    if (!storeUrl.trim()) return toast.error("Please enter your store URL");

    if (authMode === "oauth") {
      if (!clientId.trim()) return toast.error("Please enter the Client ID");
      if (!clientSecret.trim()) return toast.error("Please enter the Client Secret");
    } else {
      if (!accessToken.trim()) return toast.error("Please enter the access token");
      if (!accessToken.trim().startsWith("shpat_")) {
        setConnectError("The access token should start with shpat_");
        return toast.error("The access token should start with shpat_");
      }
    }

    setConnectError(null);
    setConnecting(true);
    setSyncResult(null);
    try {
      const cleanedUrl = cleanStoreUrl(storeUrl);
      const payload: Record<string, unknown> = {
        seller_id: seller!.id,
        action: "connect",
        store_url: cleanedUrl,
      };
      if (authMode === "oauth") {
        payload.client_id = clientId.trim();
        payload.client_secret = clientSecret.trim();
      } else {
        payload.access_token = accessToken.trim();
      }
      const data = await callEdge(payload);
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      await queryClient.invalidateQueries({ queryKey: ["shopify-sync-history"] });
      setSyncResult(data);
      toast.success(
        `Shopify connected! Imported ${data.imported} products, updated ${data.updated}.`
      );
    } catch (err: any) {
      const msg = err.message || "Connection failed";
      if (msg.includes("401") || msg.includes("OAuth failed")) {
        const errMsg = authMode === "oauth"
          ? "Shopify rejected the credentials. Double-check your Client ID and Client Secret."
          : "Shopify rejected the token. Make sure you have the Admin API Access Token (starts with shpat_).";
        toast.error(errMsg);
        setConnectError(errMsg);
      } else if (msg.includes("404") || msg.includes("Not Found")) {
        toast.error(
          "Store not found. Double-check your store URL. It should look like: yourstore.myshopify.com"
        );
      } else if (msg.includes("429") || msg.includes("rate limit")) {
        toast.error(msg);
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
      await queryClient.invalidateQueries({ queryKey: ["shopify-sync-history"] });
      setSyncResult(data);
      toast.success(`Sync complete! ${data.imported} new, ${data.updated} updated.`);
    } catch (err: any) {
      if (err.message?.includes("429") || err.message?.includes("rate limit")) {
        toast.error(
          "Shopify rate limit reached. Please wait a minute and try again."
        );
      } else {
        toast.error(err.message);
      }
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
      setClientId("");
      setClientSecret("");
      setConnectError(null);
      toast.success("Shopify disconnected.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleAutoSyncChange(interval: number | null) {
    setAutoSyncInterval(interval);
    setSavingAutoSync(true);
    try {
      await callEdge({
        seller_id: seller!.id,
        action: "update-auto-sync",
        interval,
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      toast.success(
        interval
          ? `Auto-sync set to every ${interval} hour${interval > 1 ? "s" : ""}`
          : "Auto-sync disabled"
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingAutoSync(false);
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
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
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

        {/* Auto-Sync Settings */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              Auto-Sync Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Automatically sync products from Shopify at a regular interval so
              new products appear without manual action.
            </p>
            <div className="flex flex-wrap gap-2">
              {AUTO_SYNC_OPTIONS.map((opt) => (
                <Button
                  key={String(opt.value)}
                  variant={autoSyncInterval === opt.value ? "default" : "outline"}
                  size="sm"
                  disabled={savingAutoSync}
                  onClick={() => handleAutoSyncChange(opt.value)}
                  className={
                    autoSyncInterval === opt.value
                      ? "bg-primary text-primary-foreground"
                      : ""
                  }
                >
                  {savingAutoSync && autoSyncInterval === opt.value && (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  )}
                  {opt.label}
                </Button>
              ))}
            </div>
            {autoSyncInterval && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <Check className="w-3 h-3" />
                Products will auto-sync every {autoSyncInterval} hour
                {autoSyncInterval > 1 ? "s" : ""}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Sync Results */}
        {syncResult && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Latest Sync Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <PackagePlus className="w-5 h-5 mx-auto text-green-400 mb-1" />
                  <p className="text-lg font-bold text-green-400">
                    {syncResult.imported}
                  </p>
                  <p className="text-xs text-muted-foreground">New</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <PackageCheck className="w-5 h-5 mx-auto text-blue-400 mb-1" />
                  <p className="text-lg font-bold text-blue-400">
                    {syncResult.updated}
                  </p>
                  <p className="text-xs text-muted-foreground">Updated</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <PackageX className="w-5 h-5 mx-auto text-red-400 mb-1" />
                  <p className="text-lg font-bold text-red-400">
                    {syncResult.errors}
                  </p>
                  <p className="text-xs text-muted-foreground">Errors</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center pt-1">
                Total products on Shopify: {syncResult.total_shopify_products}
              </p>

              {/* Error details */}
              {syncResult.errors > 0 && syncResult.error_details && syncResult.error_details.length > 0 && (
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-300 w-full"
                    onClick={() => setShowErrorDetails(!showErrorDetails)}
                  >
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {showErrorDetails ? "Hide" : "Show"} error details ({syncResult.error_details.length})
                    {showErrorDetails ? (
                      <ChevronUp className="w-3 h-3 ml-1" />
                    ) : (
                      <ChevronDown className="w-3 h-3 ml-1" />
                    )}
                  </Button>
                  {showErrorDetails && (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {syncResult.error_details.map((err, i) => (
                        <div
                          key={i}
                          className="text-xs rounded-lg border border-red-500/20 bg-red-500/5 p-2.5"
                        >
                          <p className="font-medium text-red-300">{err.product}</p>
                          <p className="text-red-400/70 mt-0.5">{err.error}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={handleSync}
                    disabled={syncing}
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    Retry Failed Products
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Sync History */}
        {syncHistory && syncHistory.length > 0 && (
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4" />
                Sync History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {syncHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/10 border border-border text-sm"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {new Date(entry.synced_at).toLocaleString()}
                        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">
                          {entry.trigger_type}
                        </Badge>
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {entry.imported > 0 && (
                        <span className="text-green-400">+{entry.imported} new</span>
                      )}
                      {entry.updated > 0 && (
                        <span className="text-blue-400">{entry.updated} updated</span>
                      )}
                      {entry.errors > 0 && (
                        <span className="text-red-400">{entry.errors} errors</span>
                      )}
                      {entry.imported === 0 && entry.updated === 0 && entry.errors === 0 && (
                        <span className="text-muted-foreground">No changes</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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
                    {disconnecting && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
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
            You need to create a <b>Custom App</b> in your Shopify store and get
            the{" "}
            <b>Admin API Access Token</b> (starts with{" "}
            <span className="font-mono bg-muted px-1 py-0.5 rounded text-xs">
              shpat_
            </span>
            ). Follow the steps below — it takes about 2 minutes.
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
                If you're already logged in to Shopify, you should see your
                store dashboard.
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
                <li>
                  Click{" "}
                  <b className="text-foreground">Settings</b> (gear icon at the
                  bottom-left of the page)
                </li>
                <li>
                  In the Settings menu, click{" "}
                  <b className="text-foreground">Apps and sales channels</b>
                </li>
                <li>
                  Click{" "}
                  <b className="text-foreground">Develop apps</b> (button at the
                  top of the page)
                </li>
                <li>
                  If you see a message saying "Allow custom app development",
                  click{" "}
                  <b className="text-foreground">
                    Allow custom app development
                  </b>{" "}
                  and confirm
                </li>
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
                <li>
                  Click the{" "}
                  <b className="text-foreground">Create an app</b> button
                </li>
                <li>
                  For the app name, type:{" "}
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">
                    ByChat Integration
                  </span>
                </li>
                <li>
                  Click <b className="text-foreground">Create app</b>
                </li>
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
              <p>
                After creating the app, you'll be on the app overview page:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground">
                <li>
                  Click{" "}
                  <b className="text-foreground">
                    Configure Admin API scopes
                  </b>
                </li>
                <li>
                  Search and check these scopes:
                </li>
              </ol>
              <div className="ml-6 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground text-xs">
                    read_products
                  </span>
                  <span className="text-xs text-muted-foreground">— read your products</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground text-xs">
                    write_products
                  </span>
                  <span className="text-xs text-muted-foreground">— push price changes back (optional)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground text-xs">
                    read_inventory
                  </span>
                  <span className="text-xs text-muted-foreground">— track stock levels</span>
                </div>
              </div>
              <ol className="list-decimal list-inside space-y-1.5 text-muted-foreground" start={3}>
                <li>
                  Scroll down and click{" "}
                  <b className="text-foreground">Save</b>
                </li>
              </ol>
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
                <li>
                  Click the{" "}
                  <b className="text-foreground">API credentials</b> tab (at the
                  top of the page)
                </li>
                <li>
                  Click the{" "}
                  <b className="text-foreground">Install app</b> button, then
                  confirm by clicking{" "}
                  <b className="text-foreground">Install</b>
                </li>
                <li>
                  After installing, you'll see a section called{" "}
                  <b className="text-foreground">Admin API access token</b>
                </li>
                <li>
                  Click{" "}
                  <b className="text-foreground">Reveal token once</b> — a token
                  starting with{" "}
                  <span className="font-mono bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">
                    shpat_
                  </span>{" "}
                  will appear
                </li>
                <li>
                  <b className="text-foreground">
                    Copy this token immediately
                  </b>
                </li>
              </ol>

              <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                <div className="text-xs space-y-1">
                  <p className="font-medium text-red-300">Very Important!</p>
                  <p className="text-red-200/80">
                    This token is <b>shown only once</b>. If you close the page
                    without copying it, you'll need to uninstall and reinstall
                    the app to get a new one.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <Info className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div className="text-xs space-y-1.5">
                  <p className="font-medium text-amber-300">
                    Don't confuse these tokens!
                  </p>
                  <div className="space-y-1 text-amber-200/80">
                    <p>
                      <span className="font-mono bg-green-500/10 text-green-400 px-1 py-0.5 rounded">
                        shpat_...
                      </span>{" "}
                      = <b>Admin API Access Token</b> — this is the one you need
                    </p>
                    <p>
                      <span className="font-mono bg-red-500/10 text-red-400 px-1 py-0.5 rounded">
                        shpss_...
                      </span>{" "}
                      = API Secret Key — do NOT use this one
                    </p>
                    <p>
                      <span className="font-mono bg-red-500/10 text-red-400 px-1 py-0.5 rounded">
                        API key
                      </span>{" "}
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
                Scroll down to the <b>"Connect Your Store"</b> form below. Enter
                your store URL and paste the{" "}
                <span className="font-mono bg-green-500/10 text-green-400 px-1 py-0.5 rounded text-xs">
                  shpat_
                </span>{" "}
                token, then click <b>Test & Connect</b>.
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
              <li>
                <span className="font-mono">yourstore.myshopify.com</span>
              </li>
              <li>
                <span className="font-mono">
                  https://admin.shopify.com/store/yourstore
                </span>
              </li>
              <li>
                <span className="font-mono">yourstore</span> (just the store
                name)
              </li>
            </ul>
          </div>

          {/* Auth mode toggle */}
          <div className="space-y-2">
            <Label>Authentication Method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={authMode === "oauth" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMode("oauth")}
              >
                Client ID & Secret (Recommended)
              </Button>
              <Button
                type="button"
                variant={authMode === "token" ? "default" : "outline"}
                size="sm"
                onClick={() => setAuthMode("token")}
              >
                Access Token (Legacy)
              </Button>
            </div>
          </div>

          {authMode === "oauth" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  placeholder="e171842e34abba4b146f0eea..."
                  value={clientId}
                  onChange={(e) => {
                    setClientId(e.target.value);
                    setConnectError(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  From Dev Dashboard &gt; Your App &gt; Settings
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-secret">
                  Client Secret
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (starts with shpss_)
                  </span>
                </Label>
                <Input
                  id="client-secret"
                  type="password"
                  placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={clientSecret}
                  onChange={(e) => {
                    setClientSecret(e.target.value);
                    setConnectError(null);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Click the eye icon to reveal, then copy it
                </p>
              </div>
            </>
          ) : (
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
                  setConnectError(null);
                }}
              />
              <p className="text-xs text-muted-foreground">
                From a legacy Custom App — click "Reveal token once" after installing
              </p>
            </div>
          )}

          {connectError && (
            <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
              <p className="text-xs text-red-300">{connectError}</p>
            </div>
          )}

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
            {connecting
              ? "Connecting & importing products..."
              : "Test & Connect"}
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
              Imported {syncResult.imported} products, updated{" "}
              {syncResult.updated}
              {syncResult.errors > 0 && `, ${syncResult.errors} errors`}.
            </p>
            {syncResult.errors > 0 &&
              syncResult.error_details &&
              syncResult.error_details.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium text-red-400">
                    Failed products:
                  </p>
                  {syncResult.error_details.slice(0, 3).map((err, i) => (
                    <p key={i} className="text-xs text-red-300/70">
                      {err.product}: {err.error}
                    </p>
                  ))}
                  {syncResult.error_details.length > 3 && (
                    <p className="text-xs text-muted-foreground">
                      ...and {syncResult.error_details.length - 3} more
                    </p>
                  )}
                </div>
              )}
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
                <p className="font-medium text-foreground">
                  "Shopify returned 401"
                </p>
                <p>
                  The token is wrong. Make sure you're using the{" "}
                  <b>Admin API Access Token</b> (starts with{" "}
                  <span className="font-mono text-green-400">shpat_</span>),
                  NOT the API Secret Key (
                  <span className="font-mono text-red-400">shpss_</span>) and
                  NOT the API Key.
                </p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">"Store not found"</p>
                <p>
                  Check your store URL. It should be your{" "}
                  <span className="font-mono">.myshopify.com</span> address. You
                  can find it in your browser URL when you're logged in to
                  Shopify.
                </p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">
                  "Rate limit" or "429" error
                </p>
                <p>
                  Shopify limits API calls to 2 per second. Wait a minute and
                  try again. If you have many products, the sync might take
                  longer.
                </p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">
                  "I can't find the access token"
                </p>
                <p>
                  You need to <b>install the app first</b> (Step 5), then click
                  "Reveal token once". The token only appears after the app is
                  installed.
                </p>
              </div>
              <div className="rounded-lg bg-muted/20 p-3 space-y-1">
                <p className="font-medium text-foreground">
                  "I lost my token"
                </p>
                <p>
                  Go back to your Shopify app, uninstall it, then reinstall it.
                  You'll get a new token to copy.
                </p>
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
