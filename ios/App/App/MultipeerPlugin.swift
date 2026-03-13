import Capacitor
import MultipeerConnectivity
import Foundation

// MARK: - Profile model (JSON wire format)

private struct PGProfile: Codable {
    let userId:      String
    let name:        String
    let headline:    String
    let picture:     String
    let linkedinUrl: String
}

// MARK: - Plugin

/**
 * MultipeerPlugin — AirDrop-style peer discovery via iOS MultipeerConnectivity.
 *
 * Service type: "pg-share"  (8 chars, valid: lowercase + hyphen only)
 * Both phones advertise AND browse simultaneously (symmetric).
 * Flow:
 *   1. startSharing() → MCNearbyServiceAdvertiser + MCNearbyServiceBrowser
 *   2. Browser finds a peer → invites it
 *   3. Advertiser auto-accepts invitation
 *   4. MCSession reaches .connected → each side sends profile JSON
 *   5. JS receives "peerDiscovered" with full name/headline/photo data
 *
 * JS side: import { Multipeer } from '../utils/multipeer'
 *
 * IMPORTANT: This file MUST appear in Xcode's "Compile Sources" build phase.
 * Check: Xcode → target App → Build Phases → Compile Sources.
 */
@objc(MultipeerPlugin)
public class MultipeerPlugin: CAPPlugin, CAPBridgedPlugin {

    // ── Capacitor registration ───────────────────────────────────────────────

    public let identifier   = "MultipeerPlugin"
    public let jsName       = "Multipeer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "initialize",         returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "startSharing",       returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopSharing",        returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getDiscoveredPeers", returnType: CAPPluginReturnPromise),
    ]

    // ── Strong persistent MPC properties ────────────────────────────────────
    // Must be instance properties (not locals) or ARC will deallocate them.

    private var myPeerID:   MCPeerID?
    private var myProfile:  PGProfile?
    private var session:    MCSession?          // kept alive for full sharing lifetime
    private var advertiser: MCNearbyServiceAdvertiser?
    private var browser:    MCNearbyServiceBrowser?

    private let serviceType = "pg-share"       // 8 chars — valid MPC service type

    // Peer bookkeeping — keyed by MCPeerID.displayName (stable within a session)
    private var connectedPeerIds = Set<String>()
    private var pendingPeerIds   = Set<String>()
    private var discoveredPeers  = [String: [String: Any]]()

    // ── MARK: Plugin Methods ─────────────────────────────────────────────────

    @objc func initialize(_ call: CAPPluginCall) {
        log("▶ initialize called")

        let rawName     = call.getString("displayName") ?? UIDevice.current.name
        let displayName = String(rawName.trimmingCharacters(in: .whitespaces).prefix(60))
        let safeName    = displayName.isEmpty ? "PG-User" : displayName

        log("  creating MCPeerID displayName='\(safeName)'")
        myPeerID = MCPeerID(displayName: safeName)
        log("  MCPeerID created ✓")

        log("  creating MCSession")
        session          = MCSession(peer: myPeerID!,
                                     securityIdentity: nil,
                                     encryptionPreference: .required)
        session?.delegate = self
        log("  MCSession created ✓  serviceType='\(serviceType)'")

        notifyListeners("initialized", data: ["peerId": safeName, "status": "ready"])
        log("◀ initialize: resolved success=true peerId='\(safeName)'")
        call.resolve(["success": true, "peerId": safeName])
    }

    @objc func startSharing(_ call: CAPPluginCall) {
        log("▶ startSharing called")

        guard let peerID = myPeerID, let session = session else {
            let msg = "startSharing: not initialized — call initialize() first"
            log("  ERROR: \(msg)")
            call.reject(msg)
            return
        }

        // Parse profile payload from JS
        if let p = call.getObject("profile") {
            myProfile = PGProfile(
                userId:      p["userId"]      as? String ?? "",
                name:        p["name"]        as? String ?? "",
                headline:    p["headline"]    as? String ?? "",
                picture:     p["picture"]     as? String ?? "",
                linkedinUrl: p["linkedinUrl"] as? String ?? ""
            )
            log("  profile parsed: name='\(myProfile!.name)' headline='\(myProfile!.headline)'")
        } else {
            log("  WARN: no profile data passed to startSharing")
        }

        // ── Start advertising ──
        let discoveryInfo: [String: String] = ["n": myProfile?.name ?? peerID.displayName]
        log("  creating MCNearbyServiceAdvertiser serviceType='\(serviceType)'")
        advertiser          = MCNearbyServiceAdvertiser(peer: peerID,
                                                        discoveryInfo: discoveryInfo,
                                                        serviceType: serviceType)
        advertiser?.delegate = self
        advertiser?.startAdvertisingPeer()
        log("  advertiser.startAdvertisingPeer() called ✓")
        notifyListeners("advertisingStarted", data: ["peerId": peerID.displayName])

        // ── Start browsing ──
        log("  creating MCNearbyServiceBrowser serviceType='\(serviceType)'")
        browser          = MCNearbyServiceBrowser(peer: peerID, serviceType: serviceType)
        browser?.delegate = self
        browser?.startBrowsingForPeers()
        log("  browser.startBrowsingForPeers() called ✓")
        notifyListeners("browsingStarted", data: [:])

        log("◀ startSharing: resolved success=true advertising=true browsing=true")
        call.resolve(["success": true, "advertising": true, "browsing": true])
    }

    @objc func stopSharing(_ call: CAPPluginCall) {
        log("▶ stopSharing called")

        advertiser?.stopAdvertisingPeer()
        advertiser = nil
        log("  advertising stopped")
        notifyListeners("advertisingStopped", data: [:])

        browser?.stopBrowsingForPeers()
        browser = nil
        log("  browsing stopped")
        notifyListeners("browsingStopped", data: [:])

        session?.disconnect()
        connectedPeerIds.removeAll()
        pendingPeerIds.removeAll()
        discoveredPeers.removeAll()
        notifyListeners("allPeersCleared", data: [:])
        log("  session disconnected, peer state cleared")

        log("◀ stopSharing: resolved success=true")
        call.resolve(["success": true])
    }

    @objc func getDiscoveredPeers(_ call: CAPPluginCall) {
        call.resolve(["peers": Array(discoveredPeers.values)])
    }

    // ── MARK: Helpers ────────────────────────────────────────────────────────

    private func log(_ msg: String) {
        print("[MultipeerPlugin] \(msg)")
        notifyListeners("debugLog", data: [
            "message":   msg,
            "timestamp": Date().timeIntervalSince1970 * 1000,
        ])
    }

    private func sendProfile(to peer: MCPeerID) {
        guard let session = session else {
            log("  sendProfile: no active session — skip")
            return
        }
        guard let profile = myProfile else {
            log("  sendProfile: no profile set — skip")
            return
        }
        do {
            let data = try JSONEncoder().encode(profile)
            try session.send(data, toPeers: [peer], with: .reliable)
            log("  sendProfile: sent \(data.count) bytes to '\(peer.displayName)' ✓")
        } catch {
            log("  sendProfile ERROR → \(error.localizedDescription)")
        }
    }
}

// MARK: - MCSessionDelegate

extension MultipeerPlugin: MCSessionDelegate {

    public func session(_ session: MCSession,
                        peer peerID: MCPeerID,
                        didChange state: MCSessionState) {
        switch state {
        case .connected:
            log("SESSION connected: '\(peerID.displayName)'")
            connectedPeerIds.insert(peerID.displayName)
            pendingPeerIds.remove(peerID.displayName)
            log("  sending profile to '\(peerID.displayName)' after short delay")
            DispatchQueue.global().asyncAfter(deadline: .now() + 0.2) {
                self.sendProfile(to: peerID)
            }

        case .notConnected:
            log("SESSION disconnected: '\(peerID.displayName)'")
            connectedPeerIds.remove(peerID.displayName)
            pendingPeerIds.remove(peerID.displayName)
            if let removed = discoveredPeers.removeValue(forKey: peerID.displayName) {
                log("peerLost: '\(peerID.displayName)'")
                notifyListeners("peerLost", data: removed)
            }

        case .connecting:
            log("SESSION connecting: '\(peerID.displayName)'")

        @unknown default:
            break
        }
    }

    public func session(_ session: MCSession,
                        didReceive data: Data,
                        fromPeer peerID: MCPeerID) {
        log("didReceive: \(data.count) bytes from '\(peerID.displayName)'")
        do {
            let profile = try JSONDecoder().decode(PGProfile.self, from: data)
            let dict: [String: Any] = [
                "peerId":      peerID.displayName,
                "userId":      profile.userId,
                "name":        profile.name,
                "headline":    profile.headline,
                "picture":     profile.picture,
                "linkedinUrl": profile.linkedinUrl,
            ]
            discoveredPeers[peerID.displayName] = dict
            log("peerDiscovered ✓ name='\(profile.name)' peerId='\(peerID.displayName)'")
            notifyListeners("peerDiscovered", data: dict)
        } catch {
            log("didReceive decode ERROR → \(error.localizedDescription)")
        }
    }

    // Required MCSessionDelegate stubs (unused in this implementation)
    public func session(_ session: MCSession,
                        didReceive stream: InputStream,
                        withName streamName: String,
                        fromPeer peerID: MCPeerID) {}

    public func session(_ session: MCSession,
                        didStartReceivingResourceWithName resourceName: String,
                        fromPeer peerID: MCPeerID,
                        with progress: Progress) {}

    public func session(_ session: MCSession,
                        didFinishReceivingResourceWithName resourceName: String,
                        fromPeer peerID: MCPeerID,
                        at localURL: URL?,
                        withError error: Error?) {}
}

// MARK: - MCNearbyServiceAdvertiserDelegate

extension MultipeerPlugin: MCNearbyServiceAdvertiserDelegate {

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                           didReceiveInvitationFromPeer peerID: MCPeerID,
                           withContext context: Data?,
                           invitationHandler: @escaping (Bool, MCSession?) -> Void) {
        log("ADVERTISER: invitation received from '\(peerID.displayName)' — auto-accepting")
        invitationHandler(true, session)
        log("ADVERTISER: invitation accepted ✓ for '\(peerID.displayName)'")
    }

    public func advertiser(_ advertiser: MCNearbyServiceAdvertiser,
                           didNotStartAdvertisingPeer error: Error) {
        log("ADVERTISER ERROR (did not start): \(error.localizedDescription)")
        notifyListeners("advertisingError", data: ["error": error.localizedDescription])
    }
}

// MARK: - MCNearbyServiceBrowserDelegate

extension MultipeerPlugin: MCNearbyServiceBrowserDelegate {

    public func browser(_ browser: MCNearbyServiceBrowser,
                        foundPeer peerID: MCPeerID,
                        withDiscoveryInfo info: [String: String]?) {
        let name = info?["n"] ?? peerID.displayName
        log("BROWSER: found peer '\(name)' displayName='\(peerID.displayName)'")

        guard let session = session else {
            log("BROWSER: no active session — cannot invite '\(peerID.displayName)'")
            return
        }
        guard !connectedPeerIds.contains(peerID.displayName),
              !pendingPeerIds.contains(peerID.displayName) else {
            log("BROWSER: skip invite — '\(peerID.displayName)' already connected or pending")
            return
        }

        pendingPeerIds.insert(peerID.displayName)
        log("BROWSER: inviting '\(peerID.displayName)' (timeout=15s)")
        browser.invitePeer(peerID, to: session, withContext: nil, timeout: 15)
    }

    public func browser(_ browser: MCNearbyServiceBrowser,
                        lostPeer peerID: MCPeerID) {
        log("BROWSER: lost peer '\(peerID.displayName)'")
        pendingPeerIds.remove(peerID.displayName)
    }

    public func browser(_ browser: MCNearbyServiceBrowser,
                        didNotStartBrowsingForPeers error: Error) {
        log("BROWSER ERROR (did not start): \(error.localizedDescription)")
        notifyListeners("browsingError", data: ["error": error.localizedDescription])
    }
}
