import Foundation
import SwiftData

@Model
class TranscriptionItem {
    @Attribute(.unique) var id: UUID
    var text: String
    var timestamp: Date
    var duration: TimeInterval
    var wasRewritten: Bool
    var language: String
    var errorMessage: String?

    init(text: String, duration: TimeInterval, wasRewritten: Bool = false, language: String = "en", errorMessage: String? = nil) {
        self.id = UUID()
        self.text = text
        self.timestamp = Date()
        self.duration = duration
        self.wasRewritten = wasRewritten
        self.language = language
        self.errorMessage = errorMessage
    }
}