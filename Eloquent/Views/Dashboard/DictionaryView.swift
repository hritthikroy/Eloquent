import SwiftUI

struct DictionaryView: View {
    @ObservedObject var state = AppState.shared
    @State private var dictionaryText = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Add custom words for better recognition (comma-separated)")
                .font(.headline)
            
            TextEditor(text: $dictionaryText)
                .frame(minHeight: 100)
                .padding(4)
                .overlay(
                    RoundedRectangle(cornerRadius: 4)
                        .stroke(Color.gray, lineWidth: 1)
                )
                .onChange(of: dictionaryText) { _, newText in
                    // Update state's dictionary words when text changes
                    state.settings.dictionaryWords = newText
                        .components(separatedBy: ",")
                        .map { $0.trimmingCharacters(in: .whitespaces) }
                        .filter { !$0.isEmpty }
                }
            
            Button("Update Dictionary") {
                state.settings.dictionaryWords = dictionaryText
                    .components(separatedBy: ",")
                    .map { $0.trimmingCharacters(in: .whitespaces) }
                    .filter { !$0.isEmpty }
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding()
        .navigationTitle("Dictionary")
        .onAppear {
            dictionaryText = state.settings.dictionaryWords.joined(separator: ", ")
        }
    }
}

struct DictionaryView_Previews: PreviewProvider {
    static var previews: some View {
        DictionaryView()
    }
}