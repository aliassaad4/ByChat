import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SellerLayout from "./layouts/SellerLayout";
import SellerDashboard from "./pages/seller/SellerDashboard";
import SellerProducts from "./pages/seller/SellerProducts";
import SellerOrders from "./pages/seller/SellerOrders";
import SellerStatistics from "./pages/seller/SellerStatistics";
import SellerPlaceholder from "./pages/seller/SellerPlaceholder";
import SellerAISettings from "./pages/seller/SellerAISettings";
import SellerIntegrations from "./pages/seller/SellerIntegrations";
import SellerWhatsApp from "./pages/seller/SellerWhatsApp";
import SellerShopify from "./pages/seller/SellerShopify";
import BuyerLayout from "./layouts/BuyerLayout";
import BuyerHome from "./pages/buyer/BuyerHome";
import BrowseShops from "./pages/buyer/BrowseShops";
import ShopPage from "./pages/buyer/ShopPage";
import BuyerOrders from "./pages/buyer/BuyerOrders";
import BuyerSearch from "./pages/buyer/BuyerSearch";
import BuyerProfile from "./pages/buyer/BuyerProfile";
import CartPage from "./pages/buyer/CartPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* Seller Dashboard */}
          <Route path="/seller" element={<SellerLayout />}>
            <Route index element={<SellerDashboard />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="statistics" element={<SellerStatistics />} />
            <Route path="ai-settings" element={<SellerAISettings />} />
            <Route path="integrations" element={<SellerIntegrations />} />
            <Route path="whatsapp" element={<SellerWhatsApp />} />
            <Route path="shopify" element={<SellerShopify />} />
            <Route path="settings" element={<SellerPlaceholder />} />
          </Route>

          {/* Buyer Dashboard */}
          <Route path="/buyer" element={<BuyerLayout />}>
            <Route index element={<BuyerHome />} />
            <Route path="shops" element={<BrowseShops />} />
            <Route path="shop/:sellerId" element={<ShopPage />} />
            <Route path="orders" element={<BuyerOrders />} />
            <Route path="search" element={<BuyerSearch />} />
            <Route path="profile" element={<BuyerProfile />} />
            <Route path="cart" element={<CartPage />} />
          </Route>

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
