import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import PartnerPortalGuard from "./components/partner/PartnerPortalGuard";
import ScrollToHash from "./components/ScrollToHash";

const AuthConfirm = lazy(() => import("./components/AuthConfirm"));
const ResetPasswordPage = lazy(() => import("./components/ResetPasswordPage"));
const Booking = lazy(() => import("./pages/Booking"));
const ComparePage = lazy(() => import("./pages/ComparePage"));
const DiscoveryPage = lazy(() => import("./pages/DiscoveryPage"));
const ForLawyersLanding = lazy(() => import("./pages/ForLawyersLanding"));
const Index = lazy(() => import("./pages/Index"));
const LawyerProfile = lazy(() => import("./pages/LawyerProfile"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const OperationsCenter = lazy(() => import("./pages/OperationsCenter"));
const PartnerApply = lazy(() => import("./pages/PartnerApply"));
const PartnerLogin = lazy(() => import("./pages/PartnerLogin"));
const PartnerPortal = lazy(() => import("./pages/PartnerPortal"));
const PartnerVerification = lazy(() => import("./pages/PartnerVerification"));
const SearchResults = lazy(() => import("./pages/SearchResults"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const TrustPage = lazy(() => import("./pages/TrustPage"));
const UserProfile = lazy(() => import("./pages/UserProfile"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="min-h-screen bg-background px-5 py-10">
    <div className="mx-auto h-2 w-full max-w-3xl overflow-hidden rounded-full bg-secondary">
      <div className="h-full w-1/3 animate-pulse rounded-full bg-primary" />
    </div>
  </div>
);

const AccountRoute = () => <UserProfile />;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <ScrollToHash />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/compare" element={<ComparePage />} />
              <Route path="/lawyer/:id" element={<LawyerProfile />} />
              <Route path="/lawyers/:issueSlug" element={<DiscoveryPage />} />
              <Route path="/lawyers/:issueSlug/:citySlug" element={<DiscoveryPage />} />
              <Route path="/booking/:id" element={<Booking />} />
              <Route path="/account" element={<AccountRoute />} />
              <Route path="/for-lawyers" element={<ForLawyersLanding />} />
              <Route path="/for-lawyers/login" element={<PartnerLogin />} />
              <Route path="/for-lawyers/verify" element={<PartnerVerification />} />
              <Route path="/for-lawyers/apply" element={<PartnerApply />} />
              <Route element={<PartnerPortalGuard />}>
                <Route path="/for-lawyers/portal" element={<PartnerPortal />} />
              </Route>
              <Route path="/auth/confirm" element={<AuthConfirm />} />
              <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
              <Route path="/terms" element={<LegalPage />} />
              <Route path="/privacy" element={<LegalPage />} />
              <Route path="/contact" element={<LegalPage />} />
              <Route path="/help" element={<SupportCenter />} />
              <Route path="/operations" element={<OperationsCenter />} />
              <Route path="/trust/verification-standards" element={<TrustPage />} />
              <Route path="/trust/reviews-policy" element={<TrustPage />} />
              <Route path="/trust/payments-refunds" element={<TrustPage />} />
              <Route path="/trust/privacy-documents" element={<TrustPage />} />
              <Route path="/trust/support-complaints" element={<TrustPage />} />
              <Route path="/trust/security" element={<TrustPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
