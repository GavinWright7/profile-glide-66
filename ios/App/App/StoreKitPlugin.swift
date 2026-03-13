import Capacitor
import StoreKit

/**
 * StoreKitPlugin — StoreKit 2 integration for Profile Glide Premium.
 * Product ID: premium_monthly
 */
@objc(StoreKitPlugin)
public class StoreKitPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "StoreKitPlugin"
    public let jsName = "StoreKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getProducts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchasePremium", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restorePurchases", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getEntitlementStatus", returnType: CAPPluginReturnPromise),
    ]

    private static let productId = "premium_monthly"

    @objc func getProducts(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: [Self.productId])
                guard let product = products.first else {
                    call.resolve(["products": [], "error": "Product not found"])
                    return
                }
                call.resolve([
                    "products": [[
                        "id": product.id,
                        "displayName": product.displayName,
                        "displayPrice": product.displayPrice,
                        "description": product.description,
                    ]],
                ])
            } catch {
                call.reject("Failed to load products: \(error.localizedDescription)")
            }
        }
    }

    @objc func purchasePremium(_ call: CAPPluginCall) {
        Task {
            do {
                let products = try await Product.products(for: [Self.productId])
                guard let product = products.first else {
                    call.reject("Product premium_monthly not found")
                    return
                }
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try verification.payloadValue
                    await transaction.finish()
                    call.resolve([
                        "success": true,
                        "productId": transaction.productID,
                        "originalTransactionId": String(transaction.originalID),
                    ])
                case .userCancelled:
                    call.resolve(["success": false, "cancelled": true])
                case .pending:
                    call.resolve(["success": false, "pending": true])
                @unknown default:
                    call.resolve(["success": false])
                }
            } catch {
                call.reject("Purchase failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func restorePurchases(_ call: CAPPluginCall) {
        Task {
            do {
                try await AppStore.sync()
                let hasPremium = await checkEntitlement()
                call.resolve(["success": true, "isPremium": hasPremium])
            } catch {
                call.reject("Restore failed: \(error.localizedDescription)")
            }
        }
    }

    @objc func getEntitlementStatus(_ call: CAPPluginCall) {
        Task {
            let hasPremium = await checkEntitlement()
            call.resolve(["isPremium": hasPremium])
        }
    }

    private func checkEntitlement() async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let transaction) = result, transaction.productID == Self.productId {
                return true
            }
        }
        return false
    }
}
