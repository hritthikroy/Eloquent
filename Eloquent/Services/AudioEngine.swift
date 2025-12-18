import AVFoundation
import Foundation
import SwiftUI
import AppKit

class AudioEngine: ObservableObject {
    static let shared = AudioEngine()
    
    private let audioEngine = AVAudioEngine()
    private let inputNode: AVAudioInputNode
    private var recordingStartTime: Date?
    private var timer: Timer?
    private var audioFile: AVAudioFile?
    private var silenceTimer: Timer?
    private var maxRecordingTimer: Timer?
    
    @Published var currentAmplitude: Float = 0.0
    @Published var isRecording = false
    @Published var recordingURL: URL?
    
    private var state: AppState {
        return AppState.shared
    }
    
    private init() {
        inputNode = audioEngine.inputNode
        
        // Request microphone permission on macOS
        requestMicrophonePermission()
    }
    
    private func requestMicrophonePermission() {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            break
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                if !granted {
                    DispatchQueue.main.async {
                        self.state.showError(.microphonePermissionDenied)
                    }
                }
            }
        case .denied, .restricted:
            DispatchQueue.main.async {
                self.state.showError(.microphonePermissionDenied)
            }
        @unknown default:
            break
        }
    }
    
    func startRecording() throws {
        guard !isRecording else { return }
        
        // Get the input format from the hardware
        let inputFormat = inputNode.outputFormat(forBus: 0)
        
        // Set up recording file using temp directory as specified in the spec
        let tempPath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Eloquent")
            .appendingPathComponent("recordings")

        // Create directory if it doesn't exist
        try FileManager.default.createDirectory(at: tempPath, withIntermediateDirectories: true)

        let fileName = "eloquent_recording_\(Date().timeIntervalSince1970).m4a"
        let audioURL = tempPath.appendingPathComponent(fileName)
        
        // OPTIMIZED: Audio settings for maximum speed and accuracy
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatLinearPCM), // PCM for faster processing
            AVSampleRateKey: Constants.audioSampleRate,
            AVNumberOfChannelsKey: Constants.audioChannels,
            AVLinearPCMBitDepthKey: 16,
            AVLinearPCMIsBigEndianKey: false,
            AVLinearPCMIsFloatKey: false,
            AVLinearPCMIsNonInterleaved: false
        ]
        
        // Create audio file for writing
        audioFile = try AVAudioFile(forWriting: audioURL, settings: settings)
        recordingURL = audioURL
        
        // OPTIMIZED: Install tap with smaller buffer for lower latency
        inputNode.installTap(onBus: 0, bufferSize: 512, format: inputFormat) { [weak self] buffer, _ in
            self?.processAudioBufferOptimized(buffer)
            
            // Write buffer to file
            if let file = self?.audioFile {
                do {
                    try file.write(from: buffer)
                } catch {
                    print("Error writing audio buffer: \(error)")
                }
            }
        }
        
        // Start audio engine
        try audioEngine.start()
        isRecording = true
        recordingStartTime = Date()
        
        // Play start sound if enabled
        if state.settings.playSoundEffects {
            playStartSound()
        }
        
        // Start amplitude monitoring timer
        timer = Timer.scheduledTimer(withTimeInterval: 0.033, repeats: true) { [weak self] _ in
            self?.updateCurrentAmplitude()
        }
        
        // Schedule max recording time check
        maxRecordingTimer = Timer.scheduledTimer(withTimeInterval: Constants.maxRecordingTime, repeats: false) { [weak self] _ in
            if self?.isRecording == true {
                self?.stopRecording()
            }
        }

        // Schedule silence detection timer if enabled in settings
        if state.settings.autoStopSilence {
            silenceTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] timer in
                guard let self = self, self.isRecording else {
                    timer.invalidate()
                    return
                }

                if self.detectSilence() {
                    self.stopRecording()
                    timer.invalidate()
                }
            }
        }

        state.startRecording()
    }
    
    func stopRecording() {
        guard isRecording else { return }
        
        // Invalidate all timers
        timer?.invalidate()
        timer = nil
        silenceTimer?.invalidate()
        silenceTimer = nil
        maxRecordingTimer?.invalidate()
        maxRecordingTimer = nil
        
        // Remove tap and stop engine
        inputNode.removeTap(onBus: 0)
        
        if audioEngine.isRunning {
            audioEngine.stop()
        }
        
        // Close audio file
        audioFile = nil
        
        isRecording = false
        
        // Play stop sound if enabled
        if state.settings.playSoundEffects {
            playStopSound()
        }
        
        state.stopRecording()
        
        // Process recording
        processRecording()
    }
    
    private func playStartSound() {
        NSSound(named: "Tink")?.play()
    }
    
    private func playStopSound() {
        NSSound(named: "Pop")?.play()
    }
    
    private func processAudioBuffer(_ buffer: AVAudioPCMBuffer) {
        guard let channelData = buffer.floatChannelData else { return }
        let frameCapacity = Int(buffer.frameLength)
        let samples = channelData.pointee
        
        var sum: Float = 0
        for i in 0..<frameCapacity {
            sum += abs(samples[i])
        }
        
        let avgAmplitude = sum / Float(frameCapacity)
        
        // Update UI on main thread
        DispatchQueue.main.async {
            self.currentAmplitude = avgAmplitude
            self.state.updateAmplitude(avgAmplitude)
        }
    }
    
    // OPTIMIZED: Enhanced audio processing with voice activity detection
    private func processAudioBufferOptimized(_ buffer: AVAudioPCMBuffer) {
        // Apply audio enhancement if enabled
        let processedBuffer = state.settings.enhancedAudioProcessing ? 
            AudioOptimizer.shared.enhanceAudioBuffer(buffer) ?? buffer : buffer
        
        // Perform voice activity detection
        let sensitivity = state.settings.voiceSensitivity
        let voiceResult = AudioOptimizer.shared.detectVoiceActivity(buffer: processedBuffer, sensitivity: sensitivity)
        
        // Calculate amplitude from processed buffer
        guard let channelData = processedBuffer.floatChannelData else { return }
        let frameCapacity = Int(processedBuffer.frameLength)
        let samples = channelData.pointee
        
        var sum: Float = 0
        for i in 0..<frameCapacity {
            sum += abs(samples[i])
        }
        let avgAmplitude = sum / Float(frameCapacity)
        
        // Update UI on main thread with optimized batching
        DispatchQueue.main.async {
            self.currentAmplitude = avgAmplitude
            self.state.updateAmplitude(avgAmplitude)
            self.state.updateVoiceActivity(voiceResult.hasVoice)
        }
    }
    
    // OPTIMIZED: Advanced voice activity detection
    private func detectVoiceActivity(amplitude: Float, rms: Float, peak: Float) -> Bool {
        // Multi-feature voice activity detection for better accuracy
        let amplitudeThreshold: Float = 0.02  // Lower threshold for better sensitivity
        let rmsThreshold: Float = 0.015
        let peakThreshold: Float = 0.05
        
        // Voice is detected if any of these conditions are met
        let hasAmplitude = amplitude > amplitudeThreshold
        let hasRMS = rms > rmsThreshold
        let hasPeak = peak > peakThreshold
        
        // Require at least 2 out of 3 features for robust detection
        let featureCount = [hasAmplitude, hasRMS, hasPeak].filter { $0 }.count
        return featureCount >= 2
    }
    
    private func updateCurrentAmplitude() {
        let avgPower = inputNode.averagePowerLevel
        let amplitude = pow(10, avgPower / 20)
        currentAmplitude = max(0, min(Float(amplitude), 1.0))
        
        DispatchQueue.main.async {
            self.state.updateAmplitude(self.currentAmplitude)
        }
    }
    
    private func processRecording() {
        guard let audioURL = recordingURL else { return }
        
        // Store URL before clearing
        let savedURL = audioURL
        recordingURL = nil
        
        Task {
            do {
                // Determine if this was rewrite mode
                let mode = await MainActor.run { state.recordingMode }
                
                // Transcribe audio with retry
                let text = try await withRetry(maxRetries: 3) {
                    try await GroqClient.shared.transcribe(audioURL: savedURL)
                }
                
                // If rewrite mode, process with LLM (with fallback to standard on failure)
                var finalText = text
                if mode == .rewrite {
                    do {
                        finalText = try await withRetry(maxRetries: 3) {
                            try await GroqClient.shared.rewrite(text: text)
                        }
                    } catch {
                        // Graceful degradation: use standard transcription if rewrite fails
                        print("Rewrite failed, using standard transcription: \(error)")
                        finalText = text
                    }
                }
                
                // Apply replace rules (dictionary words are already handled via API prompt)
                let processedText = await MainActor.run { applyReplaceRules(to: finalText) }
                
                // Paste the text
                let preserveClipboard = await MainActor.run { state.settings.preserveClipboard }
                await ClipboardService.shared.pasteText(processedText, preserveClipboard: preserveClipboard)
                
                // Save to history
                let duration = Date().timeIntervalSince(recordingStartTime ?? Date())
                let item = TranscriptionItem(
                    text: processedText,
                    duration: duration,
                    wasRewritten: mode == .rewrite
                )
                
                await StorageManager.shared.saveTranscription(item)
                
                // Clean up audio file
                try? FileManager.default.removeItem(at: savedURL)
                
                // Update UI
                await MainActor.run {
                    self.state.finishProcessing()
                    OverlayWindowController.shared.hide()
                }
            } catch {
                print("Error processing recording: \(error)")
                
                // Save failed transcription to history
                let duration = Date().timeIntervalSince(recordingStartTime ?? Date())
                let item = TranscriptionItem(
                    text: "",
                    duration: duration,
                    wasRewritten: false,
                    errorMessage: error.localizedDescription
                )
                await StorageManager.shared.saveTranscription(item)
                
                // Clean up audio file
                try? FileManager.default.removeItem(at: savedURL)
                
                await MainActor.run {
                    self.state.showError(.transcriptionFailed(error.localizedDescription))
                    OverlayWindowController.shared.hide()
                }
            }
        }
    }
    
    private func withRetry<T>(maxRetries: Int, operation: () async throws -> T) async throws -> T {
        var attempts = 0
        var lastError: Error?

        while attempts <= maxRetries {
            do {
                return try await operation()
            } catch {
                lastError = error
                attempts += 1

                if attempts > maxRetries {
                    break
                }

                // Exponential backoff: 1s, 2s, 4s
                let delay = UInt64(pow(2.0, Double(attempts - 1))) * 1_000_000_000
                try? await Task.sleep(nanoseconds: delay)
            }
        }

        throw lastError ?? AppError.transcriptionFailed("Operation failed after \(maxRetries) retries")
    }
    
    private func applyReplaceRules(to text: String) -> String {
        var result = text

        // Apply replace rules
        for rule in state.settings.replaceRules {
            result = result.replacingOccurrences(of: rule.find, with: rule.replace, options: .caseInsensitive)
        }

        return result
    }
    
    func getAmplitude() -> Float {
        return currentAmplitude
    }
    
    private var silenceStartTime: Date?

func detectSilence(threshold: Float = Constants.silenceThreshold, duration: TimeInterval = Constants.silenceDuration) -> Bool {
    if currentAmplitude < threshold {
        if silenceStartTime == nil {
            silenceStartTime = Date()
        } else if Date().timeIntervalSince(silenceStartTime!) > duration {
            return true
        }
    } else {
        silenceStartTime = nil
    }
    return false
}
}