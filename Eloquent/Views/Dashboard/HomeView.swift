import SwiftUI
import HotKey

struct HomeView: View {
    @ObservedObject var state = AppState.shared
    @State private var showingStandardRecorder = false
    @State private var showingRewriteRecorder = false
    @State private var standardKeyCombo: KeyCombo?
    @State private var rewriteKeyCombo: KeyCombo?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                shortcutCard
                usageCard
                supportSection
            }
            .padding()
        }
        .navigationTitle("Home")
        .onAppear {
            standardKeyCombo = state.settings.decodedStandardShortcut
            rewriteKeyCombo = state.settings.decodedRewriteShortcut
        }
    }

    private var shortcutCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Recording Shortcut")
                .font(.headline)

            HStack {
                Text("Standard Recording:")
                Spacer()

                if showingStandardRecorder {
                    KeyRecorderView(keyCombo: $standardKeyCombo)
                        .frame(width: 120, height: 30)
                        .onTapGesture {
                            showingStandardRecorder = false
                        }
                } else {
                    Button(standardKeyCombo?.keyEquivalentString ?? "Not Set") {
                        showingStandardRecorder = true
                        showingRewriteRecorder = false
                    }
                    .buttonStyle(BorderlessButtonStyle())
                    .padding(4)
                    .background(RoundedRectangle(cornerRadius: 4).stroke(Color.gray, lineWidth: 1))
                }
            }

            HStack {
                Text("Rewrite Mode:")
                Spacer()

                if showingRewriteRecorder {
                    KeyRecorderView(keyCombo: $rewriteKeyCombo)
                        .frame(width: 120, height: 30)
                        .onTapGesture {
                            showingRewriteRecorder = false
                        }
                } else {
                    Button(rewriteKeyCombo?.keyEquivalentString ?? "Not Set") {
                        showingRewriteRecorder = true
                        showingStandardRecorder = false
                    }
                    .buttonStyle(BorderlessButtonStyle())
                    .padding(4)
                    .background(RoundedRectangle(cornerRadius: 4).stroke(Color.gray, lineWidth: 1))
                }
            }

            HStack {
                Button("Save Shortcuts") {
                    if let standard = standardKeyCombo, let rewrite = rewriteKeyCombo {
                        HotKeyManager.shared.updateShortcuts(standard: standard, rewrite: rewrite)
                        state.settings.decodedStandardShortcut = standard
                        state.settings.decodedRewriteShortcut = rewrite
                    }
                }
                .disabled(standardKeyCombo == nil || rewriteKeyCombo == nil)

                Button("Reset to Default") {
                    standardKeyCombo = Constants.defaultStandardShortcut
                    rewriteKeyCombo = Constants.defaultRewriteShortcut
                    HotKeyManager.shared.updateShortcuts(
                        standard: Constants.defaultStandardShortcut,
                        rewrite: Constants.defaultRewriteShortcut
                    )
                }
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.gray, lineWidth: 1))
    }
    
    private var usageCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Free Recording Time")
                .font(.headline)
            
            VStack(alignment: .leading) {
                ProgressView(value: 1200, total: 2400) // Example progress
                    .progressViewStyle(LinearProgressViewStyle())
                
                HStack {
                    Text("1200 / 2400 seconds used")
                    Spacer()
                    Button("Upgrade to Unlimited") {
                        // Upgrade action
                    }
                }
            }
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.gray, lineWidth: 1))
    }
    
    private var supportSection: some View {
        HStack {
            Text("Need help? Contact support")
            Spacer()
            Link("support@eloquent.app", destination: URL(string: "mailto:support@eloquent.app")!)
        }
        .padding()
        .background(RoundedRectangle(cornerRadius: 8).stroke(Color.gray, lineWidth: 1))
    }
}

struct HomeView_Previews: PreviewProvider {
    static var previews: some View {
        HomeView()
    }
}