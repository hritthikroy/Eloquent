import SwiftUI

struct ReplaceTextView: View {
    @ObservedObject var state = AppState.shared
    @State private var newFindText = ""
    @State private var newReplaceText = ""
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Auto-replace words or phrases in transcripts")
                .font(.headline)
            
            List {
                ForEach(state.settings.replaceRules) { rule in
                    HStack {
                        Text("'\(rule.find)' → '\(rule.replace)'")
                        Spacer()
                        Button("Delete") {
                            if let index = state.settings.replaceRules.firstIndex(where: { $0.id == rule.id }) {
                                state.settings.replaceRules.remove(at: index)
                            }
                        }
                        .buttonStyle(BorderlessButtonStyle())
                        .foregroundColor(.red)
                    }
                }
                .onDelete(perform: deleteRules)
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Find:")
                    TextField("Text to find", text: $newFindText)
                }
                
                VStack(alignment: .leading) {
                    Text("Replace with:")
                    TextField("Replacement text", text: $newReplaceText)
                }
                
                Button("Add") {
                    if !newFindText.isEmpty && !newReplaceText.isEmpty {
                        let newRule = ReplaceRule(find: newFindText, replace: newReplaceText)
                        state.settings.replaceRules.append(newRule)
                        newFindText = ""
                        newReplaceText = ""
                    }
                }
                .disabled(newFindText.isEmpty || newReplaceText.isEmpty)
            }
            .padding(.top)
        }
        .padding()
        .navigationTitle("Replace Text")
    }
    
    private func deleteRules(offsets: IndexSet) {
        for index in offsets {
            state.settings.replaceRules.remove(at: index)
        }
    }
}

struct ReplaceTextView_Previews: PreviewProvider {
    static var previews: some View {
        ReplaceTextView()
    }
}