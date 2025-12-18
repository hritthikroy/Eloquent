import SwiftUI
import SwiftData

struct HistoryView: View {
    @State private var transcriptions: [TranscriptionItem] = []
    @State private var isLoading = true
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Your recent transcriptions (stored locally)")
                    .font(.headline)
                Spacer()
                Button("Clear History") {
                    clearHistory()
                }
                .foregroundColor(.red)
            }
            
            if isLoading {
                ProgressView("Loading history...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if transcriptions.isEmpty {
                VStack {
                    Spacer()
                    Text("No transcriptions yet")
                        .foregroundColor(.secondary)
                    Text("Press ⌥D to start recording")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    LazyVStack(spacing: 8) {
                        ForEach(transcriptions, id: \.id) { item in
                            TranscriptionCard(item: item, onDelete: {
                                deleteTranscription(item)
                            })
                        }
                    }
                }
            }
        }
        .padding()
        .navigationTitle("History")
        .onAppear {
            loadTranscriptions()
        }
    }
    
    private func loadTranscriptions() {
        Task {
            isLoading = true
            transcriptions = StorageManager.shared.fetchTranscriptions()
            isLoading = false
        }
    }
    
    private func deleteTranscription(_ item: TranscriptionItem) {
        StorageManager.shared.deleteTranscription(item)
        if let index = transcriptions.firstIndex(where: { $0.id == item.id }) {
            transcriptions.remove(at: index)
        }
    }
    
    private func clearHistory() {
        StorageManager.shared.clearHistory()
        transcriptions = []
    }
}

struct TranscriptionCard: View {
    let item: TranscriptionItem
    var onDelete: (() -> Void)?
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(item.timestamp.timeAgoDisplay())
                    .font(.caption)
                    .foregroundColor(.secondary)
                
                Spacer()
                
                if item.errorMessage == nil {
                    Button("Copy") {
                        NSPasteboard.general.clearContents()
                        NSPasteboard.general.setString(item.text, forType: .string)
                    }
                    .buttonStyle(BorderlessButtonStyle())
                    .foregroundColor(.blue)
                }
                
                Button(action: { onDelete?() }) {
                    Image(systemName: "trash")
                        .foregroundColor(.red)
                }
                .buttonStyle(BorderlessButtonStyle())
            }
            
            if let errorMessage = item.errorMessage {
                HStack {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundColor(.orange)
                    Text("Processing failed")
                        .font(.headline)
                        .foregroundColor(.orange)
                    Spacer()
                }
                Text(errorMessage)
                    .font(.caption)
                    .foregroundColor(.secondary)
            } else {
                Text(item.text)
                    .lineLimit(3)
                
                HStack {
                    if item.wasRewritten {
                        Label("Rewrite Mode", systemImage: "sparkles")
                            .font(.caption)
                            .foregroundColor(.purple)
                    }
                    
                    Text(item.language.uppercased())
                        .font(.caption2)
                        .padding(.horizontal, 4)
                        .padding(.vertical, 2)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(4)
                    
                    Spacer()
                    
                    Text("\(Int(item.duration))s")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 8).fill(Color(NSColor.controlBackgroundColor)))
        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3), lineWidth: 1))
    }
}

struct HistoryView_Previews: PreviewProvider {
    static var previews: some View {
        HistoryView()
    }
}