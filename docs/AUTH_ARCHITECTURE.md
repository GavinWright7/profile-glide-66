# Auth Architecture — Durable Fix for 401 / Invalid Token

## Root Causes (Fixed)

1. **Stale token in Sharing Mode** — The sharing module cached `_token` at `startSharing` time. Heartbeats and polls used that cached token even after it expired or was refreshed elsewhere.
2. **No boot validation** — The app trusted localStorage and marked users authenticated without validating the token with the backend.
3. **Token expiry only checked server-side** — Expired tokens were sent to the backend, causing 401s instead of proactively redirecting to login.
4. **Scattered auth logic** — Each file had its own fetch + Authorization header + error handling.
5. **tryAutoResume before auth ready** — HomePage could call tryAutoResume with a token that hadn’t been validated yet.

## Files Changed

### New Files
- `server/utils/jwt.js` — Central JWT signing helper (7d expiry).
- `src/api/client.ts` — Centralized authenticated API client.
- `docs/AUTH_ARCHITECTURE.md` — This document.

### Backend
- `server/controllers/linkedinAuth.js` — Use `signToken()`, add validation logging.
- `server/controllers/profile.js` — Use `signToken()` instead of inline `jwt.sign`.
- `server/middleware/auth.js` — Log 401 reason (expired vs invalid).
- `server/routes/auth.js` — Add `/auth/me` alias for `/auth/verify`.
- `server/server.js` — Log JWT_SECRET presence at startup.

### Frontend — Auth
- `src/auth/authService.ts` — Add `getStoredToken`, `isTokenExpired`, `isTokenStructurallyValid`, `isDemoToken`, `authLog`. Remove `fetchWithAuthCheck`.
- `src/context/AuthContext.tsx` — Boot validation via `/auth/me`, `isAuthReady`, 401 handler with toast, debug logging.

### Frontend — API Client
- `src/api/client.ts` — `apiRequest`, `apiGet`, `apiPost`, `apiPut` with token from storage, exp check, 401 handling.

### Frontend — Sharing
- `src/utils/sharing.ts` — Remove `_token`, use `apiPost`/`apiGet` from api client. Listen for `AUTH_401_EVENT` to stop sharing. Rename `clearSession` → `clearSharingPersistence`.

### Frontend — Pages / Services
- `src/pages/HomePage.tsx` — Gate tryAutoResume on `isAuthReady`.
- `src/pages/SettingsPage.tsx` — Use `apiPut`.
- `src/pages/OnboardingInterestsPage.tsx` — Use `apiPut`.
- `src/pages/OnboardingLinkedInPage.tsx` — Use `apiPut`.
- `src/pages/OnboardingSubcategoriesPage.tsx` — Use `apiPut`.
- `src/pages/OnboardingProfessionalBackgroundPage.tsx` — Use `apiPut`.
- `src/pages/OnboardingGoalsPage.tsx` — Use `apiPut`.
- `src/pages/RadarPage.tsx` — Use `apiRequest`.
- `src/services/entitlementService.ts` — Use `apiRequest`.

### Config
- `.env.example` — Add production/TestFlight URL notes.

## Race Conditions / Stale Token Patterns (Fixed)

- **Sharing `_token`** — Removed. Token is read from storage per request.
- **tryAutoResume before validation** — Now gated on `isAuthReady`.
- **Token in closures** — API client always calls `getStoredToken()` before each request.

## Sharing Mode and Centralized Auth

Sharing Mode now:

1. Uses `apiPost` / `apiGet` from `src/api/client.ts`.
2. Gets the token from `getStoredToken()` on every heartbeat and poll.
3. Stops sharing when `AUTH_401_EVENT` fires (session expired).
4. Only starts after auth boot validation completes (via HomePage’s `isAuthReady` gate).

## Remaining Risks

1. **VITE_BACKEND_URL for TestFlight** — Must be set to the production backend URL before `npm run build`. If wrong or missing, API calls will fail.
2. **JWT_SECRET consistency** — Railway must use the same `JWT_SECRET` as when tokens were issued. Changing it invalidates all existing tokens.
3. **Network during boot** — If `/auth/me` fails due to network (not 401), we clear the session. Offline users with a valid cached token may be logged out. Consider retrying or offline handling later.

## Manual Test Plan

### 1. Fresh login
- Log out if needed.
- Tap “Sign in with LinkedIn”.
- Complete LinkedIn auth.
- **Expected:** Redirect to app, user shown as logged in.

### 2. Expired token behavior
- Log in, then wait 7+ days (or temporarily reduce JWT expiry for testing).
- Open the app.
- **Expected:** Boot validation fails, session cleared, redirect to login. Toast: “Your session expired. Please log in again.”

### 3. App relaunch with valid token
- Log in.
- Force-quit the app.
- Reopen.
- **Expected:** Boot validates with `/auth/me`, user stays logged in.

### 4. App relaunch with invalid token
- Manually corrupt the token in localStorage (e.g. change one character) or use an old token from another environment.
- Reopen the app.
- **Expected:** Boot validation fails (structure or backend), session cleared, redirect to login.

### 5. Enabling Sharing Mode
- Log in.
- Go to Home or Settings.
- Turn on “Discoverable by nearby users”.
- **Expected:** Sharing starts, no 401. Heartbeats succeed.

### 6. TestFlight production
- Build with `VITE_BACKEND_URL=https://your-railway-url.up.railway.app`.
- Deploy backend to Railway.
- Install TestFlight build.
- Log in and enable Sharing.
- **Expected:** No 401. Backend logs show `[auth] validate: success userId=...`.
