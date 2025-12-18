import Foundation
import HotKey
import SwiftUI

class HotKeyManager: ObservableObject {
    static let shared = HotKeyManager()
    
    var standardHotKey: HotKey?
    var rewriteHotKey: HotKey?
    
    private let audioEngine = AudioEngine.shared
    private var state: AppState {
        return AppState.shared
    }
    
    private init() {}
    
    func registerShortcuts() {
        // Get shortcuts from settings or use defaults
        let standardCombo = state.settings.decodedStandardShortcut ?? Constants.defaultStandardShortcut
        let rewriteCombo = state.settings.decodedRewriteShortcut ?? Constants.defaultRewriteShortcut
        
        standardHotKey = HotKey(keyCombo: standardCombo)
        rewriteHotKey = HotKey(keyCombo: rewriteCombo)
        
        // Register standard recording shortcut
        standardHotKey?.keyDownHandler = { [weak self] in
            if self?.audioEngine.isRecording == true {
                // Stop recording if already recording
                self?.audioEngine.stopRecording()
            } else {
                self?.startRecording(mode: .standard)
            }
        }
        
        // Register rewrite mode shortcut
        rewriteHotKey?.keyDownHandler = { [weak self] in
            if self?.audioEngine.isRecording == true {
                // Stop recording if already recording
                self?.audioEngine.stopRecording()
            } else {
                self?.startRecording(mode: .rewrite)
            }
        }
    }
    
    private func startRecording(mode: RecordingMode) {
        // Hide dashboard if auto-hide is enabled
        if state.settings.autoHideDashboardOnRecording {
            NSApp.windows.forEach { window in
                if window.title == "Eloquent Dashboard" {
                    window.orderOut(nil)
                }
            }
        }
        
        // Show overlay and start recording
        state.startRecording(mode: mode)
        OverlayWindowController.shared.show(mode: mode)
        
        // Start audio recording
        do {
            try audioEngine.startRecording()
        } catch {
            state.showError(.audioRecordingFailed)
            OverlayWindowController.shared.hide()
        }
    }
    
    func unregisterAll() {
        standardHotKey?.keyDownHandler = nil
        rewriteHotKey?.keyDownHandler = nil
        standardHotKey = nil
        rewriteHotKey = nil
    }
    
    func updateShortcuts(standard: KeyCombo?, rewrite: KeyCombo?) {
        unregisterAll()
        
        if let standard = standard {
            state.settings.decodedStandardShortcut = standard
        }
        
        if let rewrite = rewrite {
            state.settings.decodedRewriteShortcut = rewrite
        }
        
        registerShortcuts()
    }
}