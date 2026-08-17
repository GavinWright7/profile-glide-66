import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import BottomNav from "./components/BottomNav";
import SwipeableTabs from "./components/SwipeableTabs";
import AnimatedTabPage from "./components/AnimatedTabPage";
import LoginPage from "./pages/LoginPage";
import EmailLoginPage from "./pages/EmailLoginPage";
import HomePage from "./pages/HomePage";
import RadarPage from "./pages/RadarPage";
import HistoryPage from "./pages/HistoryPage";
import SavedProfilesPage from "./pages/SavedProfilesPage";
import SettingsPage from "./pages/SettingsPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import OnboardingLinkedInPage from "./pages/OnboardingLinkedInPage";
import OnboardingProfessionalBackgroundPage from "./pages/OnboardingProfessionalBackgroundPage";
import OnboardingIndustryPage from "./pages/OnboardingIndustryPage";
import OnboardingBackgroundLocationPage from "./pages/OnboardingBackgroundLocationPage";
import NotFound from "./pages/NotFound";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ConnectionsProvider } from "./context/ConnectionsContext";
import LinkedInCallbackPage from "./pages/LinkedInCallbackPage";
import { isValidLinkedInUrl } from "./utils/linkedinUrl";
import { BG_LOCATION_KEY } from "./utils/sharing";

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

/** Redirects to onboarding if user has no valid linkedin_url or incomplete professional background. */
function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isDemoUser } = useAuth();
  const location = useLocation();
  const isLinkedIn = location.pathname === '/onboarding/linkedin-url';
  const isProfessionalBackground = location.pathname === '/onboarding/professional-background';
  const isIndustry = location.pathname === '/onboarding/industry';
  const isBackgroundLocation = location.pathname === '/onboarding/background-location';

  if (isLoading) return null;
  if (isDemoUser) return <>{children}</>;
  if (isLinkedIn || isProfessionalBackground || isIndustry || isBackgroundLocation) return <>{children}</>;

  const hasValidUrl = user?.linkedinUrl && isValidLinkedInUrl(user.linkedinUrl);
  if (!hasValidUrl) {
    return <Navigate to="/onboarding/linkedin-url" replace />;
  }

  const hasProfessionalBackground =
    user?.currentJobTitle?.trim() &&
    user?.almaMater?.trim();
  if (!hasProfessionalBackground) {
    return <Navigate to="/onboarding/professional-background" replace />;
  }

  const hasIndustry = Array.isArray(user?.interests) && user.interests.length > 0;
  if (!hasIndustry) {
    return <Navigate to="/onboarding/industry" replace />;
  }

  if (localStorage.getItem(BG_LOCATION_KEY) === null) {
    return <Navigate to="/onboarding/background-location" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ConnectionsProvider>
          <div className="app-shell">
            <SwipeableTabs>
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
              path="/login/email"
              element={
                <PublicRoute>
                  <EmailLoginPage />
                </PublicRoute>
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
              path="/onboarding/professional-background"
              element={
                <ProtectedRoute>
                  <OnboardingProfessionalBackgroundPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/industry"
              element={
                <ProtectedRoute>
                  <OnboardingIndustryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/onboarding/background-location"
              element={
                <ProtectedRoute>
                  <OnboardingBackgroundLocationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <AnimatedTabPage>
                      <HomePage />
                    </AnimatedTabPage>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/radar"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <AnimatedTabPage>
                      <RadarPage />
                    </AnimatedTabPage>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <ProfileEditPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <AnimatedTabPage>
                      <HistoryPage />
                    </AnimatedTabPage>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/saved-profiles"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <SavedProfilesPage />
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AnimatedTabPage>
                    <SettingsPage />
                  </AnimatedTabPage>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <OnboardingGuard>
                    <AnimatedTabPage>
                      <ProfilePage />
                    </AnimatedTabPage>
                  </OnboardingGuard>
                </ProtectedRoute>
              }
            />
            {/* OAuth callback — must be public and outside ProtectedRoute */}
            <Route path="/auth/linkedin/callback" element={<LinkedInCallbackPage />} />
            <Route path="*" element={<NotFound />} />
              </Routes>
            </SwipeableTabs>
            <BottomNav />
          </div>
          </ConnectionsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
