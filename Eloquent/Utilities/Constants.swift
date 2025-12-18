import Foundation
import SwiftUI
import HotKey

// MARK: - App Constants
struct Constants {
    static let appName = "Eloquent"
    static let bundleIdentifier = "com.eloquent.app"
    static let appVersion = "1.0.0"
    
    // Window sizes
    static let overlayWidth: CGFloat = 480
    static let overlayHeight: CGFloat = 120
    static let dashboardWidth: CGFloat = 900
    static let dashboardHeight: CGFloat = 600
    
    // Audio settings
    static let audioSampleRate: Double = 16000
    static let audioChannels: UInt32 = 1
    static let audioBitDepth: UInt32 = 16
    
    // API settings
    static let groqAPIBaseURL = "https://api.groq.com/openai/v1"
    
    // Colors
    static let brandBlue = Color(red: 0.0, green: 0.72, blue: 0.83)  // #00B8D4
    static let brandDarkBlue = Color(red: 0.0, green: 0.5, blue: 1.0)  // #0080FF
    
    // OPTIMIZED: Defaults for maximum responsiveness
    static let defaultStandardShortcut = KeyCombo(carbonKeyCode: 2, carbonModifiers: 0x80)  // Alt+D
    static let defaultRewriteShortcut = KeyCombo(carbonKeyCode: 2, carbonModifiers: 0x88)   // Alt+Shift+D
    static let silenceThreshold: Float = 0.02  // Lower threshold for better voice detection
    static let silenceDuration: TimeInterval = 1.5  // Faster silence detection
    static let maxRecordingTime: TimeInterval = 30.0  // 30 seconds max
    
    // OPTIMIZED: Voice activity detection thresholds
    static let voiceActivityThreshold: Float = 0.015
    static let voiceActivityRMSThreshold: Float = 0.012
    static let voiceActivityPeakThreshold: Float = 0.04
}

// MARK: - App State Enum
enum RecordingMode {
    case standard
    case rewrite
}

enum AppError: LocalizedError {
    case microphonePermissionDenied
    case apiKeyMissing
    case apiKeyInvalid
    case networkTimeout
    case audioRecordingFailed
    case transcriptionFailed(String)
    case clipboardAccessFailed
    
    var errorDescription: String? {
        switch self {
        case .microphonePermissionDenied:
            return "Microphone access is required. Please enable in System Settings > Privacy & Security > Microphone."
        case .apiKeyMissing:
            return "Please add your Groq API key in Settings."
        case .apiKeyInvalid:
            return "Invalid API key. Please check your Groq API key."
        case .networkTimeout:
            return "Network request timed out. Please check your internet connection."
        case .audioRecordingFailed:
            return "Failed to record audio. Please try again."
        case .transcriptionFailed(let reason):
            return "Transcription failed: \(reason)"
        case .clipboardAccessFailed:
            return "Failed to paste text. Please grant Accessibility permissions."
        }
    }
}

// MARK: - Replace Rule Model
struct ReplaceRule: Identifiable, Codable {
    var id = UUID()
    var find: String
    var replace: String
    
    init(find: String, replace: String) {
        self.find = find
        self.replace = replace
    }
}