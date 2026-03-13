# Profile Glide Premium — StoreKit Setup

## Architecture

### Entitlement flow
- **Backend (Neon)** is the source of truth for premium status.
- **Apple StoreKit** provides purchase/restore; after success we call `POST /premium/apple-purchase` to sync.
- **Promo code "premium"** grants premium via `POST /premium/promo-code` for dev/testing.
- All premium checks use `entitlementService.hasPremiumAccess(token)` or `useEntitlement().isPremium`.

### Premium sources
1. **apple_iap** — StoreKit subscription
2. **promo_code** — code "premium"
3. **admin_grant** — future backend admin

### Feature gating
| Feature | Free | Premium |
|---------|------|---------|
| Radius | 500 ft | 2000 ft |
| Sort by relevance | ❌ | ✅ |
| Radar filters | ❌ | ✅ |

---

## Xcode StoreKit Testing

### 1. Add StoreKit configuration to the scheme
1. In Xcode, open **Product → Scheme → Edit Scheme** (or ⌘<).
2. Select **Run** in the left sidebar.
3. Open the **Options** tab.
4. Under **StoreKit Configuration**, choose **ProfileGlide.storekit**.
5. Close the scheme editor.

### 2. StoreKit config file
- Path: `ios/App/ProfileGlide.storekit` (in project root: `ios/App/ProfileGlide.storekit`)
- Product: `premium_monthly`, $1.99/month, auto-renewable
- To add to Xcode: **File → Add Files to "App"…** → select `ProfileGlide.storekit` (optional; you can also browse to it when setting the scheme)

### 3. Test purchase flow
1. Run the app in the simulator or on a device.
2. Go to Discover (Radar).
3. Tap **Relevance** (or another premium feature).
4. Paywall appears.
5. Tap **Subscribe** — StoreKit uses the local config; no real charge.
6. Complete the test purchase; premium unlocks.

### 4. Restore purchases
- Tap **Restore Purchases** on the paywall.
- StoreKit syncs; backend records the purchase if Apple reports entitlement.

---

## App Store Connect (production)

1. Create an in-app purchase: **Auto-Renewable Subscription**.
2. Use product ID: `premium_monthly`.
3. Configure pricing (e.g. $1.99/month).
4. No code changes needed — the same product ID is used.
5. Remove or disable the StoreKit configuration file from the scheme for release builds.

---

## Commands

```bash
# Run migrations (includes user_premium table)
cd server && node scripts/run-migration.js

# Build and run
npm run build && npx cap sync ios && npx cap open ios
```
