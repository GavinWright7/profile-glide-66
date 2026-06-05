import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        #if DEBUG
        resetDebugApplicationState()
        #endif
        BackgroundLocationManager.shared.startIfEnabled()
        return true
    }

    #if DEBUG
    /// Wipe persisted state before the WebView loads so every Xcode Run feels like a fresh App Store install.
    private func resetDebugApplicationState() {
        NSLog("[DEV RESET] Clearing app state")

        if let bundleID = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: bundleID)
            UserDefaults.standard.synchronize()
        }

        URLCache.shared.removeAllCachedResponses()

        HTTPCookieStorage.shared.cookies?.forEach { cookie in
            HTTPCookieStorage.shared.deleteCookie(cookie)
        }

        let dataTypes = WKWebsiteDataStore.allWebsiteDataTypes()
        let sem = DispatchSemaphore(value: 0)
        WKWebsiteDataStore.default().removeData(ofTypes: dataTypes, modifiedSince: Date(timeIntervalSince1970: 0)) {
            NSLog("[DEV RESET] WebView storage cleared")
            sem.signal()
        }
        _ = sem.wait(timeout: .now() + 3.0)

        // Signal JS bootstrap to run resetDevState() even for production-mode web bundles.
        UserDefaults.standard.set("1", forKey: "CapacitorStorage.__airlinks_debug_reset")
        UserDefaults.standard.synchronize()

        NSLog("[DEV RESET] Fresh launch enabled")
    }
    #endif

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        BackgroundLocationManager.shared.startIfEnabled()
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        BackgroundLocationManager.shared.startIfEnabled()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
