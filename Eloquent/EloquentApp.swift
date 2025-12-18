import SwiftUI
import HotKey

@main
struct EloquentApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

class AppDelegate: NSObject, NSApplicationDelegate {
    var hotKeyManager: HotKeyManager?
    var overlayWindowController: OverlayWindowController?
    var dashboardWindowController: DashboardWindowController?
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Initialize HotKey manager
        hotKeyManager = HotKeyManager.shared
        
        // Register shortcuts
        hotKeyManager?.registerShortcuts()
        
        // Create menu bar item
        MenuBarManager.shared.setupMenuBar()
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        hotKeyManager?.unregisterAll()
    }
}