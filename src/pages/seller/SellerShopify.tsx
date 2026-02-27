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
    if (!accessToken.trim()) return toast.error("Please enter your access token");
    setConnecting(true);
    setSyncResult(null);
    try {
      const data = await callEdge({
        seller_id: seller!.id,
        action: "connect",
        store_url: storeUrl.trim(),
        access_token: accessToken.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ["seller-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["seller-products"] });
      setSyncResult(data);
      toast.success(
        `Shopify connected! Imported ${data.imported} products, updated ${data.updated}.`
      );
    } catch (err: any) {
      toast.error(err.message);
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
      toast.success("Shopify disconnected.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDisconnecting(false);
    }
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
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShoppingBag className="w-6 h-6" />
          Connect Shopify
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Import your Shopify products so your AI agent can sell them via chat
        </p>
      </div>

      {/* Setup Guide */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ExternalLink className="w-4 h-4" />
            Setup Guide
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-3">
            <StepItem number={1} title="Open your Shopify Admin">
              Go to{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                yourstore.myshopify.com/admin
              </span>
            </StepItem>

            <StepItem number={2} title="Create a Custom App">
              Click <b>Settings</b> (bottom-left) {">"} <b>Apps and sales channels</b>{" "}
              {">"} <b>Develop apps</b> {">"} <b>Create an app</b>. Name it{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                ByChat Integration
              </span>
            </StepItem>

            <StepItem number={3} title="Set API Permissions">
              Click <b>Configure Admin API scopes</b>, search and check{" "}
              <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">
                read_products
              </span>
              , then click <b>Save</b>
            </StepItem>

            <StepItem number={4} title="Install the App">
              Click the <b>API credentials</b> tab {">"} <b>Install app</b> {">"}{" "}
              confirm by clicking <b>Install</b>
            </StepItem>

            <StepItem number={5} title="Copy your Access Token">
              After installing, click <b>Reveal token once</b> and copy it.
              <span className="block mt-1 text-amber-400 text-xs">
                This token is shown only once! Save it somewhere safe.
              </span>
            </StepItem>

            <StepItem number={6} title="Paste below and connect">
              Enter your store URL and access token, then click{" "}
              <b>Test & Connect</b>
            </StepItem>
          </div>
        </CardContent>
      </Card>

      {/* Connect Form */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connect Your Store</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-url">Shopify Store URL</Label>
            <Input
              id="store-url"
              placeholder="mystore.myshopify.com"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Your store's .myshopify.com address (without https://)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-token">Admin API Access Token</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Starts with <span className="font-mono">shpat_</span> — from Step 5 above
            </p>
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
    </div>
  );
}

function StepItem({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-muted-foreground mt-0.5">{children}</p>
      </div>
    </div>
  );
}
