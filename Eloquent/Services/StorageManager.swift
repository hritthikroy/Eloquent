import Foundation
import SwiftData

class StorageManager: ObservableObject {
    static let shared = StorageManager()
    
    private var modelContainer: ModelContainer!
    private var modelContext: ModelContext!
    
    private init() {
        setupModelContainer()
    }
    
    private func setupModelContainer() {
        do {
            // Define the schema with all models
            let schema = Schema([TranscriptionItem.self, AppSettings.self])

            // Use proper storage location as specified in the requirements
            let documentsPath = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Eloquent")
            try FileManager.default.createDirectory(at: documentsPath, withIntermediateDirectories: true)

            let storeURL = documentsPath.appendingPathComponent("eloquent.sqlite")
            let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false, fileURL: storeURL)

            modelContainer = try ModelContainer(for: schema, configurations: [config])
            modelContext = ModelContext(modelContainer)
        } catch {
            print("Failed to set up SwiftData container: \(error)")
        }
    }
    
    func saveTranscription(_ item: TranscriptionItem) async {
        await MainActor.run {
            do {
                modelContext.insert(item)
                try modelContext.save()
            } catch {
                print("Error saving transcription: \(error)")
            }
        }
    }
    
    func fetchTranscriptions() -> [TranscriptionItem] {
        let descriptor = FetchDescriptor<TranscriptionItem>(sortBy: [SortDescriptor(\.timestamp, order: .reverse)])
        
        do {
            return try modelContext.fetch(descriptor)
        } catch {
            print("Error fetching transcriptions: \(error)")
            return []
        }
    }
    
    func deleteTranscription(_ item: TranscriptionItem) {
        Task { @MainActor in
            modelContext.delete(item)
            try? modelContext.save()
        }
    }
    
    func saveSettings(_ settings: AppSettings) async {
        await MainActor.run {
            // In a real implementation, we'd store settings differently
            // For now, we'll use AppStorage in the Settings view
        }
    }
    
    func clearHistory() {
        Task { @MainActor in
            let descriptor = FetchDescriptor<TranscriptionItem>()
            let items = try? modelContext.fetch(descriptor)
            
            if let items = items {
                for item in items {
                    modelContext.delete(item)
                }
                
                try? modelContext.save()
            }
        }
    }
}