import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "./components/BottomNav";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import RadarPage from "./pages/RadarPage";
import ConnectionsPage from "./pages/ConnectionsPage";
import SettingsPage from "./pages/SettingsPage";
import OnboardingInterestsPage from "./pages/OnboardingInterestsPage";
import OnboardingSubcategoriesPage from "./pages/OnboardingSubcategoriesPage";
import OnboardingLinkedInPage from "./pages/OnboardingLinkedInPage";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LinkedInCallbackPage from "./pages/LinkedInCallbackPage";
import { isValidLinkedInUrl } from "./utils/linkedinUrl";

const queryClient = new QueryClient();

/** Renders children only when authenticated; otherwise redirects to /login */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

/** Redirects away from /login when already authenticated */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return isAuthenticated ? <Navigate to="/" replace /> : <>{children}</>;
}

/** Redirects to onboarding if user has no interests or no valid linkedin_url. */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const isInterests = location.pathname === '/onboarding/interests';
  const isSubcategories = location.pathname === '/onboarding/subcategories';
  const isLinkedIn = location.pathname === '/onboarding/linkedin-url';

  if (isLoading) return null;
  if (isInterests || isSubcategories || isLinkedIn) return <>{children}</>;

  const hasInterests = Array.isArray(user?.interests) && user.interests.length >= 3;
  if (!hasInterests) {
    return <Navigate to="/onboarding/interests" replace />;
  }

  const hasValidUrl = user?.linkedinUrl && isValidLinkedInUrl(user.linkedinUrl);
  if (!hasValidUrl) {
    return <Navigate to="/onboarding/linkedin-url" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/onboarding/interests"
              element={
                <ProtectedRoute>
                  <OnboardingInterestsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/subcategories"
              element={
                <ProtectedRoute>
                  <OnboardingSubcategoriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/linkedin-url"
              element={
                <ProtectedRoute>
                  <OnboardingLinkedInPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <HomePage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/radar"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <RadarPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/connections"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <ConnectionsPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            {/* OAuth callback — must be public and outside ProtectedRoute */}
            <Route path="/auth/linkedin/callback" element={<LinkedInCallbackPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <BottomNav />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
