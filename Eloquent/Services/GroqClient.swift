import Foundation
import SwiftUI

class GroqClient: ObservableObject {
    static let shared = GroqClient()
    
    private var apiKey: String {
        get {
            return AppState.shared.settings.apiKey
        }
    }

    private var state: AppState {
        return AppState.shared
    }
    
    private let session = URLSession(configuration: .default)
    
    private init() {}
    
    // Set to true for UI testing without API calls
    #if DEBUG
    static var mockMode = false
    #endif
    
    func transcribe(audioURL: URL) async throws -> String {
        guard !apiKey.isEmpty else {
            throw AppError.apiKeyMissing
        }

        // For development, we can use mock mode
        #if DEBUG
        if GroqClient.mockMode {
            try await Task.sleep(nanoseconds: 500_000_000) // Simulate 0.5s delay
            return "This is mock transcribed text for testing UI."
        }
        #endif
        
        // Prepare multipart form data
        let boundary = UUID().uuidString
        var body = Data()
        
        // Add audio file
        let fileData = try Data(contentsOf: audioURL)
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"recording.m4a\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(fileData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Add model
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
        body.append("distil-whisper-large-v3-en\r\n".data(using: .utf8)!)
        
        // Add language
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
        body.append("\(state.settings.selectedLanguage)\r\n".data(using: .utf8)!)

        // Add prompt (for custom dictionary words)
        if !state.settings.dictionaryWords.isEmpty {
            let prompt = state.settings.dictionaryWords.joined(separator: ", ")
            body.append("--\(boundary)\r\n".data(using: .utf8)!)
            body.append("Content-Disposition: form-data; name=\"prompt\"\r\n\r\n".data(using: .utf8)!)
            body.append("\(prompt)\r\n".data(using: .utf8)!)
        }

        // Add temperature
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"temperature\"\r\n\r\n".data(using: .utf8)!)
        body.append("0.0\r\n".data(using: .utf8)!)

        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        // Create request
        var request = URLRequest(url: URL(string: "\(Constants.groqAPIBaseURL)/audio/transcriptions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        
        // Execute request
        let (data, response) = try await session.data(for: request)

        // Check response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.transcriptionFailed("Invalid response")
        }

        if httpResponse.statusCode == 401 {
            throw AppError.apiKeyInvalid
        } else if httpResponse.statusCode == 413 {
            throw AppError.transcriptionFailed("Audio file too large")
        } else if httpResponse.statusCode == 429 {
            throw AppError.transcriptionFailed("Rate limit exceeded, please try again")
        } else if httpResponse.statusCode >= 400 {
            let errorResponse = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AppError.transcriptionFailed("HTTP \(httpResponse.statusCode): \(errorResponse)")
        }

        // Parse response
        struct TranscriptionResponse: Codable {
            let text: String
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(TranscriptionResponse.self, from: data)
        return result.text
    }
    
    func rewrite(text: String) async throws -> String {
        guard !apiKey.isEmpty else {
            throw AppError.apiKeyMissing
        }

        // For development, we can use mock mode
        #if DEBUG
        if GroqClient.mockMode {
            try await Task.sleep(nanoseconds: 500_000_000) // Simulate 0.5s delay
            return "This is mock rewritten text for testing UI."
        }
        #endif
        
        // Prepare request body
        struct RewriteRequest: Codable {
            struct Message: Codable {
                let role: String
                let content: String
            }
            
            let model: String
            let messages: [Message]
            let temperature: Double
            let max_tokens: Int
        }
        
        let rewriteRequest = RewriteRequest(
            model: "llama3-70b-8192",
            messages: [
                .init(
                    role: "system",
                    content: "You are a professional copy editor. Fix grammar, punctuation, and remove filler words (um, uh, like). Make the text concise and clear. Preserve the original meaning. Return ONLY the corrected text without any commentary."
                ),
                .init(
                    role: "user",
                    content: text
                )
            ],
            temperature: 0.3,
            max_tokens: 500
        )
        
        let encoder = JSONEncoder()
        let requestData = try encoder.encode(rewriteRequest)
        
        // Create request
        var request = URLRequest(url: URL(string: "\(Constants.groqAPIBaseURL)/chat/completions")!)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = requestData
        
        // Execute request
        let (data, response) = try await session.data(for: request)
        
        // Check response
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AppError.transcriptionFailed("Invalid response")
        }

        if httpResponse.statusCode == 401 {
            throw AppError.apiKeyInvalid
        } else if httpResponse.statusCode == 429 {
            throw AppError.transcriptionFailed("Rate limit exceeded, please try again")
        } else if httpResponse.statusCode >= 400 {
            let errorResponse = String(data: data, encoding: .utf8) ?? "Unknown error"
            throw AppError.transcriptionFailed("HTTP \(httpResponse.statusCode): \(errorResponse)")
        }
        
        // Parse response
        struct Choice: Codable {
            struct Message: Codable {
                let content: String
            }
            let message: Message
        }
        
        struct RewriteResponse: Codable {
            let choices: [Choice]
        }
        
        let decoder = JSONDecoder()
        let result = try decoder.decode(RewriteResponse.self, from: data)
        return result.choices[0].message.content
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

                // Exponential backoff: 1s, 2s, 4s, etc.
                let delay = UInt64(pow(2.0, Double(attempts - 1))) * 1_000_000_000 // nanoseconds
                try await Task.sleep(nanoseconds: delay)
            }
        }

        throw lastError ?? AppError.transcriptionFailed("Operation failed after \(maxRetries) retries")
    }
}