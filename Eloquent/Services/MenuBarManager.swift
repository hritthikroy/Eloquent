import Cocoa
import SwiftUI

class MenuBarManager: ObservableObject {
    static let shared = MenuBarManager()

    private var statusBar: NSStatusBar!
    private var statusBarItem: NSStatusItem!
    private var popover: NSPopover!

    private init() {}

    func setupMenuBar() {
        // Create status bar item
        statusBar = NSStatusBar.system
        statusBarItem = statusBar.statusItem(withLength: NSStatusItem.variableLength)

        // Set up the button with initial idle icon
        if let button = statusBarItem.button {
            updateMenuBarIcon(state: .idle)
            button.action = #selector(toggleDashboard)
        }

        // Create menu
        let menu = NSMenu()

        menu.addItem(NSMenuItem(title: "Open Dashboard", action: #selector(toggleDashboard), keyEquivalent: ","))
        menu.addItem(NSMenuItem(title: "Start Recording", action: #selector(startRecording), keyEquivalent: "r"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "History", action: #selector(showHistory), keyEquivalent: "h"))
        menu.addItem(NSMenuItem(title: "Settings", action: #selector(showSettings), keyEquivalent: "s"))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit Eloquent", action: #selector(quitApp), keyEquivalent: "q"))

        statusBarItem.menu = menu

        // Set initial state
        updateMenuBarIcon(state: .idle)
    }

    private func updateMenuBarIcon(state: MenuBarState) {
        if let button = statusBarItem.button {
            switch state {
            case .idle:
                button.image = NSImage(systemSymbolName: "waveform", accessibilityDescription: "Eloquent Idle")
            case .recording:
                button.image = NSImage(systemSymbolName: "waveform.badge.plus", accessibilityDescription: "Eloquent Recording")
            case .processing:
                button.image = NSImage(systemSymbolName: "waveform.badge.exclamationmark", accessibilityDescription: "Eloquent Processing")
            }

            button.image?.size = NSSize(width: 18, height: 18)
        }
    }

    enum MenuBarState {
        case idle
        case recording
        case processing
    }

    func updateIconBasedOnState() {
        let state = AppState.shared
        if state.isProcessing {
            updateMenuBarIcon(state: .processing)
        } else if state.isRecording {
            updateMenuBarIcon(state: .recording)
        } else {
            updateMenuBarIcon(state: .idle)
        }
    }
    
    @objc private func toggleDashboard() {
        DashboardWindowController.shared.toggle()
    }
    
    @objc private func startRecording() {
        // Simulate the standard hotkey
        HotKeyManager.shared.standardHotKey?.keyDownHandler?()
    }
    
    @objc private func showHistory() {
        DashboardWindowController.shared.show(section: .history)
    }
    
    @objc private func showSettings() {
        DashboardWindowController.shared.show(section: .settings)
    }
    
    @objc private func quitApp() {
        NSApp.terminate(nil)
    }
}