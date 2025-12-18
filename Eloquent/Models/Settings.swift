import Foundation
import HotKey
import SwiftData
import ServiceManagement

@Model
class AppSettings {
    var apiKey: String = ""
    var standardShortcut: Data = Data()
    var rewriteShortcut: Data = Data()
    var autoStopSilence: Bool = true
    var silenceThreshold: TimeInterval = 1.5  // Faster silence detection
    var dictionaryWords: [String] = []
    var replaceRulesData: Data = Data() // Store ReplaceRule array as encoded Data
    var selectedLanguage: String = "en"
    var startAtLogin: Bool = true
    var autoHideDashboardOnRecording: Bool = true
    var experimentalFeatures: Bool = false
    var playSoundEffects: Bool = true
    var preserveClipboard: Bool = false
    
    // OPTIMIZED: Voice detection and performance settings
    var voiceActivityDetection: Bool = true
    var enhancedAudioProcessing: Bool = true
    var lowLatencyMode: Bool = true
    var voiceSensitivity: Float = 0.7  // 0.0 = low sensitivity, 1.0 = high sensitivity
    var noiseReduction: Bool = true
    var audioCompression: Bool = true
    
    init() {
        // Set default shortcuts
        let standard = Constants.defaultStandardShortcut
        let rewrite = Constants.defaultRewriteShortcut
        self.standardShortcut = (try? JSONEncoder().encode(standard)) ?? Data()
        self.rewriteShortcut = (try? JSONEncoder().encode(rewrite)) ?? Data()
        self.replaceRulesData = (try? JSONEncoder().encode([ReplaceRule]())) ?? Data()
    }
    
    var decodedStandardShortcut: KeyCombo? {
        get {
            try? JSONDecoder().decode(KeyCombo.self, from: standardShortcut)
        }
        set {
            standardShortcut = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }
    
    var decodedRewriteShortcut: KeyCombo? {
        get {
            try? JSONDecoder().decode(KeyCombo.self, from: rewriteShortcut)
        }
        set {
            rewriteShortcut = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }
    
    // Computed property to access replace rules
    var replaceRules: [ReplaceRule] {
        get {
            (try? JSONDecoder().decode([ReplaceRule].self, from: replaceRulesData)) ?? []
        }
        set {
            replaceRulesData = (try? JSONEncoder().encode(newValue)) ?? Data()
        }
    }
    
    // Start at login functionality
    func setStartAtLogin(_ enabled: Bool) {
        startAtLogin = enabled
        
        if #available(macOS 13.0, *) {
            do {
                if enabled {
                    try SMAppService.mainApp.register()
                } else {
                    try SMAppService.mainApp.unregister()
                }
            } catch {
                print("Failed to \(enabled ? "enable" : "disable") start at login: \(error)")
            }
        }
    }
}