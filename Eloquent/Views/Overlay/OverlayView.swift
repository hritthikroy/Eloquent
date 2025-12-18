import SwiftUI
import HotKey

struct OverlayView: View {
    @ObservedObject var state = AppState.shared
    @State private var showingCancelButton = false
    
    private var shortcutString: String {
        if state.recordingMode == .rewrite {
            return state.settings.decodedRewriteShortcut?.keyEquivalentString ?? "⌥⇧D"
        } else {
            return state.settings.decodedStandardShortcut?.keyEquivalentString ?? "⌥D"
        }
    }
    
    var body: some View {
        ZStack {
            VisualEffectView(material: .hudWindow, blendingMode: .behindWindow)
                .ignoresSafeArea()
            
            VStack(spacing: 0) {
                // Top section - Mode indicator and cancel
                HStack {
                    if state.recordingMode == .rewrite {
                        Text("Rewrite Mode")
                            .font(.system(size: 12, weight: .medium))
                            .padding(EdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12))
                            .background(Color(red: 0.0, green: 0.72, blue: 0.83)) // brandBlue
                            .foregroundColor(.white)
                            .cornerRadius(8)
                            .opacity(state.recordingMode == .rewrite ? 1.0 : 0.0)
                            .animation(.easeInOut(duration: 0.2), value: state.recordingMode)
                    } else {
                        Spacer()
                    }
                    
                    Spacer()
                    
                    Button("Cancel [Esc]") {
                        cancelRecording()
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.secondary)
                    .padding(EdgeInsets(top: 12, leading: 0, bottom: 12, trailing: 12))
                }
                
                // Waveform visualization
                WaveformView(amplitudes: $state.waveformAmplitudes)
                    .frame(height: 40)
                    .padding(EdgeInsets(top: 8, leading: 12, bottom: 8, trailing: 12))
                
                Spacer()
                
                // Bottom section - controls and status
                HStack {
                    if state.isRecording {
                        Text("Stop recording: [\(shortcutString)]")
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    } else {
                        Text(state.statusMessage)
                            .font(.system(size: 12))
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    Button("Hide") {
                        OverlayWindowController.shared.hide()
                    }
                    .buttonStyle(.plain)
                    .foregroundColor(.primary)
                }
                .padding(EdgeInsets(top: 12, leading: 16, bottom: 12, trailing: 16))
                .background(Color(NSColor.controlBackgroundColor))
                .overlay(
                    Rectangle()
                        .frame(height: 1)
                        .foregroundColor(Color(NSColor.separatorColor)),
                    alignment: .top
                )
            }
        }
        .frame(width: Constants.overlayWidth, height: Constants.overlayHeight)
        .onAppear {
            // Set up keyboard shortcuts
            NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
                if event.keyCode == 53 { // Esc key
                    self.cancelRecording()
                    return nil
                }
                return event
            }
        }
    }
    
    private func cancelRecording() {
        // Stop audio recording
        if AudioEngine.shared.isRecording {
            AudioEngine.shared.stopRecording()
        }
        
        // Hide overlay
        OverlayWindowController.shared.hide()
    }
}

struct VisualEffectView: NSViewRepresentable {
    let material: NSVisualEffectView.Material
    let blendingMode: NSVisualEffectView.BlendingMode
    
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = blendingMode
        view.state = .active
        return view
    }
    
    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {
        nsView.material = material
        nsView.blendingMode = blendingMode
    }
}

struct OverlayView_Previews: PreviewProvider {
    static var previews: some View {
        OverlayView()
            .frame(width: Constants.overlayWidth, height: Constants.overlayHeight)
    }
}