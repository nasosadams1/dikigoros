import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import AuthConfirm from "./components/AuthConfirm";
import ResetPasswordPage from "./components/ResetPasswordPage";
import ScrollToHash from "./components/ScrollToHash";
import ForLawyersLanding from "./pages/ForLawyersLanding";
import Index from "./pages/Index";
import Booking from "./pages/Booking";
import LawyerProfile from "./pages/LawyerProfile";
import NotFound from "./pages/NotFound";
import PartnerApply from "./pages/PartnerApply";
import PartnerLogin from "./pages/PartnerLogin";
import PartnerPortal from "./pages/PartnerPortal";
import PartnerVerification from "./pages/PartnerVerification";
import SearchResults from "./pages/SearchResults";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToHash />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/lawyer/:id" element={<LawyerProfile />} />
            <Route path="/booking/:id" element={<Booking />} />
            <Route path="/for-lawyers" element={<ForLawyersLanding />} />
            <Route path="/for-lawyers/login" element={<PartnerLogin />} />
            <Route path="/for-lawyers/verify" element={<PartnerVerification />} />
            <Route path="/for-lawyers/apply" element={<PartnerApply />} />
            <Route path="/for-lawyers/portal" element={<PartnerPortal />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
