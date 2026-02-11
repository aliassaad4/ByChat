import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { SellerSidebar } from "@/components/seller/SellerSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { Loader2 } from "lucide-react";

export default function SellerLayout() {
  const { user, loading: authLoading } = useAuth();
  const { data: seller, isLoading: sellerLoading, isPending: sellerPending } = useSellerProfile();

  if (authLoading || sellerLoading || (!!user && sellerPending)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!seller) {
    return <Navigate to="/" replace />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <SellerSidebar />
        <main className="flex-1 overflow-auto">
          <header className="h-14 border-b border-border flex items-center px-4 gap-4 glass">
            <SidebarTrigger />
            <h2 className="text-sm font-medium text-muted-foreground">
              {seller.business_name}
            </h2>
          </header>
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
