import Foundation
import CoreLocation

@objc class BackgroundLocationManager: NSObject, CLLocationManagerDelegate {
    @objc static let shared = BackgroundLocationManager()
    private let locationManager = CLLocationManager()
    private var lastSentTime: Date = .distantPast
    private let minIntervalSeconds: TimeInterval = 30
    private let serverUrl = "https://reliable-connection-production.up.railway.app"

    override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        locationManager.distanceFilter = 15
        locationManager.pausesLocationUpdatesAutomatically = false
        if #available(iOS 9.0, *) {
            locationManager.allowsBackgroundLocationUpdates = true
        }
        locationManager.showsBackgroundLocationIndicator = false
    }

    @objc func startIfEnabled() {
        let isDiscoverable = UserDefaults.standard.string(forKey: "CapacitorStorage.pg_sharing_on") == "true"
        guard isDiscoverable else {
            print("[BGLoc] not starting — discoverable is off")
            return
        }
        let status = CLLocationManager.authorizationStatus()
        guard status == .authorizedAlways || status == .authorizedWhenInUse else {
            print("[BGLoc] not starting — no location permission: \(status.rawValue)")
            return
        }
        locationManager.startUpdatingLocation()
        print("[BGLoc] started ✓")
    }

    @objc func stop() {
        locationManager.stopUpdatingLocation()
        print("[BGLoc] stopped")
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        let isDiscoverable = UserDefaults.standard.string(forKey: "CapacitorStorage.pg_sharing_on") == "true"
        guard isDiscoverable else { stop(); return }
        let now = Date()
        guard now.timeIntervalSince(lastSentTime) >= minIntervalSeconds else { return }
        lastSentTime = now
        guard let token = UserDefaults.standard.string(forKey: "CapacitorStorage.pg_sharing_token") else {
            print("[BGLoc] no token — skipping")
            return
        }
        sendLocation(lat: location.coordinate.latitude, lng: location.coordinate.longitude, token: token)
    }

    private func sendLocation(lat: Double, lng: Double, token: String) {
        guard let url = URL(string: "\(serverUrl)/profile/location") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "PATCH"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: ["latitude": lat, "longitude": lng])
        URLSession.shared.dataTask(with: req) { _, resp, err in
            if let err = err { print("[BGLoc] send failed: \(err.localizedDescription)"); return }
            print("[BGLoc] sent ✓ \(lat), \(lng)")
        }.resume()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("[BGLoc] error: \(error.localizedDescription)")
    }
}
