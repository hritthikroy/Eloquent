import SwiftUI

struct SettingsView: View {
    @ObservedObject var state = AppState.shared
    @State private var isTestingConnection = false
    @State private var connectionTestResult: Bool?
    
    var body: some View {
        Form {
            Section("General") {
                Toggle("Start at Login", isOn: Binding(
                    get: { state.settings.startAtLogin },
                    set: { state.settings.setStartAtLogin($0) }
                ))
                Toggle("Auto-hide Dashboard on Recording", isOn: $state.settings.autoHideDashboardOnRecording)
                Toggle("Preserve Clipboard", isOn: $state.settings.preserveClipboard)
                    .help("May add 200ms delay to paste operation")
            }
            
            Section("Audio") {
                Picker("Recording Language", selection: $state.settings.selectedLanguage) {
                    Text("English (US)").tag("en")
                    Text("Spanish").tag("es")
                    Text("German").tag("de")
                    Text("French").tag("fr")
                }
                
                Toggle("Auto-stop on Silence", isOn: $state.settings.autoStopSilence)
                
                if state.settings.autoStopSilence {
                    VStack(alignment: .leading) {
                        Text("Silence threshold: \(Int(state.settings.silenceThreshold)) seconds")
                        Slider(
                            value: $state.settings.silenceThreshold,
                            in: 1...10,
                            step: 1
                        )
                    }
                }
            }
            
            Section("API") {
                SecureField("Groq API Key", text: $state.settings.apiKey)
                
                HStack {
                    Button("Test Connection") {
                        testAPIConnection()
                    }
                    .disabled(state.settings.apiKey.isEmpty)
                    
                    if isTestingConnection {
                        ProgressView()
                            .scaleEffect(0.7)
                    }
                    
                    if let result = connectionTestResult {
                        Image(systemName: result ? "checkmark.circle.fill" : "xmark.circle.fill")
                            .foregroundColor(result ? .green : .red)
                    }
                }
            }
            
            Section("Experimental") {
                Toggle("Experimental Features", isOn: $state.settings.experimentalFeatures)
                    .help("Enable punctuation commands (e.g., 'period', 'comma')")
                Toggle("Play Sound Effects", isOn: $state.settings.playSoundEffects)
            }
        }
        .formStyle(GroupedFormStyle())
        .padding()
        .navigationTitle("Settings")
    }
}

extension SettingsView {
    private func testAPIConnection() {
        isTestingConnection = true
        connectionTestResult = nil
        
        Task {
            do {
                // Simple test by making a models list request
                var request = URLRequest(url: URL(string: "https://api.groq.com/openai/v1/models")!)
                request.setValue("Bearer \(state.settings.apiKey)", forHTTPHeaderField: "Authorization")
                
                let (_, response) = try await URLSession.shared.data(for: request)
                
                if let httpResponse = response as? HTTPURLResponse {
                    await MainActor.run {
                        connectionTestResult = httpResponse.statusCode == 200
                        isTestingConnection = false
                    }
                }
            } catch {
                await MainActor.run {
                    connectionTestResult = false
                    isTestingConnection = false
                }
            }
        }
    }
}

struct SettingsView_Previews: PreviewProvider {
    static var previews: some View {
        SettingsView()
    }
}