import Foundation
import AVFoundation
import Accelerate

// MARK: - Audio Optimization Utilities
class AudioOptimizer {
    static let shared = AudioOptimizer()
    
    private init() {}
    
    // OPTIMIZED: Real-time audio enhancement for better voice detection
    func enhanceAudioBuffer(_ buffer: AVAudioPCMBuffer) -> AVAudioPCMBuffer? {
        guard let channelData = buffer.floatChannelData else { return buffer }
        let frameCount = Int(buffer.frameLength)
        let samples = channelData.pointee
        
        // Apply noise gate to remove background noise
        applyNoiseGate(samples: samples, frameCount: frameCount, threshold: -40.0)
        
        // Apply dynamic range compression for consistent levels
        applyCompression(samples: samples, frameCount: frameCount)
        
        // Apply high-pass filter to remove low-frequency noise
        applyHighPassFilter(samples: samples, frameCount: frameCount, cutoffFreq: 80.0)
        
        return buffer
    }
    
    // OPTIMIZED: Advanced voice activity detection using multiple features
    func detectVoiceActivity(buffer: AVAudioPCMBuffer, sensitivity: Float = 0.7) -> VoiceActivityResult {
        guard let channelData = buffer.floatChannelData else {
            return VoiceActivityResult(hasVoice: false, confidence: 0.0, features: AudioFeatures())
        }
        
        let frameCount = Int(buffer.frameLength)
        let samples = channelData.pointee
        
        // Calculate multiple audio features
        let features = calculateAudioFeatures(samples: samples, frameCount: frameCount)
        
        // Multi-feature voice activity detection
        let voiceScore = calculateVoiceScore(features: features, sensitivity: sensitivity)
        let hasVoice = voiceScore > 0.5
        
        return VoiceActivityResult(hasVoice: hasVoice, confidence: voiceScore, features: features)
    }
    
    // OPTIMIZED: Calculate comprehensive audio features
    private func calculateAudioFeatures(samples: UnsafeMutablePointer<Float>, frameCount: Int) -> AudioFeatures {
        var rms: Float = 0.0
        var peak: Float = 0.0
        var zeroCrossings: Int = 0
        var spectralCentroid: Float = 0.0
        
        // Calculate RMS and peak
        for i in 0..<frameCount {
            let sample = samples[i]
            rms += sample * sample
            peak = max(peak, abs(sample))
            
            // Count zero crossings for spectral analysis
            if i > 0 && ((samples[i-1] >= 0 && sample < 0) || (samples[i-1] < 0 && sample >= 0)) {
                zeroCrossings += 1
            }
        }
        
        rms = sqrt(rms / Float(frameCount))
        let zcr = Float(zeroCrossings) / Float(frameCount)
        
        // Estimate spectral centroid (simplified)
        spectralCentroid = zcr * 8000.0 // Rough approximation
        
        return AudioFeatures(
            rms: rms,
            peak: peak,
            zeroCrossingRate: zcr,
            spectralCentroid: spectralCentroid
        )
    }
    
    // OPTIMIZED: Calculate voice activity score using multiple features
    private func calculateVoiceScore(features: AudioFeatures, sensitivity: Float) -> Float {
        // Adaptive thresholds based on sensitivity
        let rmsThreshold = 0.01 * (1.0 + sensitivity)
        let peakThreshold = 0.03 * (1.0 + sensitivity)
        let zcrMin: Float = 0.02
        let zcrMax: Float = 0.3
        let spectralMin: Float = 200.0
        let spectralMax: Float = 4000.0
        
        // Score each feature
        let rmsScore = features.rms > rmsThreshold ? 1.0 : 0.0
        let peakScore = features.peak > peakThreshold ? 1.0 : 0.0
        let zcrScore = (features.zeroCrossingRate >= zcrMin && features.zeroCrossingRate <= zcrMax) ? 1.0 : 0.0
        let spectralScore = (features.spectralCentroid >= spectralMin && features.spectralCentroid <= spectralMax) ? 1.0 : 0.0
        
        // Weighted combination of features
        let voiceScore = (rmsScore * 0.3 + peakScore * 0.2 + zcrScore * 0.3 + spectralScore * 0.2)
        
        return voiceScore
    }
    
    // OPTIMIZED: Apply noise gate to remove background noise
    private func applyNoiseGate(samples: UnsafeMutablePointer<Float>, frameCount: Int, threshold: Float) {
        let linearThreshold = pow(10.0, threshold / 20.0) // Convert dB to linear
        
        for i in 0..<frameCount {
            if abs(samples[i]) < linearThreshold {
                samples[i] = 0.0
            }
        }
    }
    
    // OPTIMIZED: Apply dynamic range compression
    private func applyCompression(samples: UnsafeMutablePointer<Float>, frameCount: Int) {
        let ratio: Float = 4.0 // 4:1 compression ratio
        let threshold: Float = 0.1
        
        for i in 0..<frameCount {
            let sample = abs(samples[i])
            if sample > threshold {
                let excess = sample - threshold
                let compressedExcess = excess / ratio
                let newSample = threshold + compressedExcess
                samples[i] = samples[i] >= 0 ? newSample : -newSample
            }
        }
    }
    
    // OPTIMIZED: Apply high-pass filter to remove low-frequency noise
    private func applyHighPassFilter(samples: UnsafeMutablePointer<Float>, frameCount: Int, cutoffFreq: Float) {
        // Simple high-pass filter implementation
        let sampleRate: Float = 16000.0
        let rc = 1.0 / (2.0 * Float.pi * cutoffFreq)
        let dt = 1.0 / sampleRate
        let alpha = rc / (rc + dt)
        
        var previousInput: Float = 0.0
        var previousOutput: Float = 0.0
        
        for i in 0..<frameCount {
            let currentInput = samples[i]
            let output = alpha * (previousOutput + currentInput - previousInput)
            samples[i] = output
            
            previousInput = currentInput
            previousOutput = output
        }
    }
}

// MARK: - Audio Feature Models
struct AudioFeatures {
    let rms: Float
    let peak: Float
    let zeroCrossingRate: Float
    let spectralCentroid: Float
}

struct VoiceActivityResult {
    let hasVoice: Bool
    let confidence: Float
    let features: AudioFeatures
}