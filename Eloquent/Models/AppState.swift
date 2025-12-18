import Foundation
import SwiftUI

@MainActor
class AppState: ObservableObject {
    static let shared = AppState()

    @Published var isRecording = false
    @Published var isProcessing = false
    @Published var recordingMode: RecordingMode = .standard
    @Published var currentAmplitude: Float = 0.0
    @Published var waveformAmplitudes: [Float] = Array(repeating: 0.0, count: 40)
    @Published var isOverlayVisible = false
    @Published var isDashboardVisible = false
    @Published var statusMessage = "Ready"
    @Published var settings = AppSettings()
    
    // OPTIMIZED: Voice activity detection state
    @Published var hasVoiceActivity = false
    @Published var voiceActivityHistory: [Bool] = Array(repeating: false, count: 10)

    private init() {}
    
    func startRecording(mode: RecordingMode = .standard) {
        isRecording = true
        recordingMode = mode
        isProcessing = false
        statusMessage = mode == .rewrite ? "Recording (Rewrite Mode)" : "Recording..."
        MenuBarManager.shared.updateIconBasedOnState()
    }

    func stopRecording() {
        isRecording = false
        isProcessing = true
        statusMessage = "Processing..."
        MenuBarManager.shared.updateIconBasedOnState()
    }

    func finishProcessing() {
        isProcessing = false
        statusMessage = "Ready"
        resetAmplitudes()
        MenuBarManager.shared.updateIconBasedOnState()
    }
    
    func updateAmplitude(_ amplitude: Float) {
        currentAmplitude = amplitude
        // Update waveform by shifting values and adding new amplitude
        waveformAmplitudes.removeFirst()
        waveformAmplitudes.append(amplitude)
    }
    
    // OPTIMIZED: Update voice activity with smoothing
    func updateVoiceActivity(_ activity: Bool) {
        // Shift history and add new value
        voiceActivityHistory.removeFirst()
        voiceActivityHistory.append(activity)
        
        // Smooth voice activity detection (require 3 out of last 5 frames)
        let recentActivity = Array(voiceActivityHistory.suffix(5))
        let activeCount = recentActivity.filter { $0 }.count
        hasVoiceActivity = activeCount >= 3
    }
    
    func resetAmplitudes() {
        currentAmplitude = 0.0
        waveformAmplitudes = Array(repeating: 0.0, count: 40)
    }
    
    func showError(_ error: AppError) {
        statusMessage = "Error: \(error.localizedDescription)"
        MenuBarManager.shared.updateIconBasedOnState()
    }
}