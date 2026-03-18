import Capacitor
import CoreBluetooth

/**
 * BleAdvertiserPlugin — custom local Capacitor plugin.
 *
 * @capacitor-community/bluetooth-le is Central (scanner) only.
 * This plugin provides the Peripheral (advertiser) role using CBPeripheralManager,
 * which is required so both iPhones can discover each other.
 *
 * JS side: import { BleAdvertiser } from '../utils/bleAdvertiser'
 */
@objc(BleAdvertiserPlugin)
public class BleAdvertiserPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "BleAdvertiserPlugin"
    public let jsName = "BleAdvertiser"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startAdvertising", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAdvertising",  returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAdvertising",    returnType: CAPPluginReturnPromise),
    ]

    private var peripheralManager: CBPeripheralManager?
    private var pendingStartCall: CAPPluginCall?
    private var serviceUUID = CBUUID(string: "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2")

    // MARK: - Plugin Methods

    @objc func startAdvertising(_ call: CAPPluginCall) {
        let uuidString = call.getString("serviceUUID") ?? "E7810A71-73AE-499D-8C15-FAA9AEF0C3F2"
        serviceUUID = CBUUID(string: uuidString)
        pendingStartCall = call
        print("[BleAdvertiser] startAdvertising requested. UUID=\(serviceUUID.uuidString)")

        if peripheralManager == nil {
            // Creating the manager triggers a delegate callback with the current state.
            peripheralManager = CBPeripheralManager(delegate: self, queue: nil)
        } else {
            tryBeginAdvertising()
        }
    }

    @objc func stopAdvertising(_ call: CAPPluginCall) {
        peripheralManager?.stopAdvertising()
        print("[BleAdvertiser] stopAdvertising called. isAdvertising=\(peripheralManager?.isAdvertising ?? false)")
        notifyListeners("advertisingStateChanged", data: [
            "advertising": false
        ])
        call.resolve(["success": true, "advertising": false])
    }

    @objc func isAdvertising(_ call: CAPPluginCall) {
        let active = peripheralManager?.isAdvertising ?? false
        call.resolve(["advertising": active])
    }

    // MARK: - Internal

    private func tryBeginAdvertising() {
        guard let pm = peripheralManager else { return }

        switch pm.state {
        case .poweredOn:
            let data: [String: Any] = [
                CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
                CBAdvertisementDataLocalNameKey: "AirLinks",
            ]
            pm.startAdvertising(data)
            print("[BleAdvertiser] pm.startAdvertising() called with UUID=\(serviceUUID.uuidString)")

        case .poweredOff:
            print("[BleAdvertiser] ERROR — Bluetooth is powered off")
            pendingStartCall?.reject("Bluetooth is powered off")
            pendingStartCall = nil

        case .unauthorized:
            print("[BleAdvertiser] ERROR — Bluetooth permission not granted")
            pendingStartCall?.reject("Bluetooth permission not granted")
            pendingStartCall = nil

        case .unsupported:
            print("[BleAdvertiser] ERROR — BLE not supported on this device")
            pendingStartCall?.reject("BLE not supported on this device")
            pendingStartCall = nil

        default:
            // .unknown / .resetting — wait for next state update
            print("[BleAdvertiser] Waiting for Bluetooth to be ready. state=\(pm.state.rawValue)")
        }
    }
}

// MARK: - CBPeripheralManagerDelegate

extension BleAdvertiserPlugin: CBPeripheralManagerDelegate {

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        let name: String
        switch peripheral.state {
        case .unknown:     name = "unknown"
        case .resetting:   name = "resetting"
        case .unsupported: name = "unsupported"
        case .unauthorized:name = "unauthorized"
        case .poweredOff:  name = "poweredOff"
        case .poweredOn:   name = "poweredOn"
        @unknown default:  name = "unknown"
        }
        print("[BleAdvertiser] peripheralManagerDidUpdateState: \(name)")
        notifyListeners("peripheralStateChanged", data: ["state": name])

        // Resolve a pending startAdvertising call if we're now on
        if pendingStartCall != nil {
            tryBeginAdvertising()
        }
    }

    public func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager, error: Error?) {
        if let error = error {
            print("[BleAdvertiser] advertising FAILED: \(error.localizedDescription)")
            notifyListeners("advertisingStateChanged", data: [
                "advertising": false,
                "error": error.localizedDescription
            ])
            pendingStartCall?.reject(error.localizedDescription)
        } else {
            print("[BleAdvertiser] advertising STARTED successfully. UUID=\(serviceUUID.uuidString)")
            notifyListeners("advertisingStateChanged", data: ["advertising": true])
            pendingStartCall?.resolve(["success": true, "advertising": true])
        }
        pendingStartCall = nil
    }
}
