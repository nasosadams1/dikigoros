import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import AuthConfirm from "./components/AuthConfirm";
import ResetPasswordPage from "./components/ResetPasswordPage";
import Index from "./pages/Index";
import SearchResults from "./pages/SearchResults";
import LawyerProfile from "./pages/LawyerProfile";
import Booking from "./pages/Booking";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/lawyer/:id" element={<LawyerProfile />} />
            <Route path="/booking/:id" element={<Booking />} />
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
