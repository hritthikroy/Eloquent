import Cocoa
import SwiftUI

class OverlayWindowController: NSWindowController {
    static let shared = OverlayWindowController()
    
    private var overlayWindow: OverlayWindow?
    
    private var state: AppState {
        return AppState.shared
    }
    
    private init() {
        super.init(window: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func show(mode: RecordingMode) {
        DispatchQueue.main.async {
            if self.overlayWindow == nil {
                self.createOverlayWindow()
            }
            
            self.state.recordingMode = mode
            self.overlayWindow?.contentView = NSHostingView(rootView: OverlayView())
            self.overlayWindow?.makeKeyAndOrderFront(nil)
            self.state.isOverlayVisible = true
        }
    }
    
    func hide() {
        DispatchQueue.main.async {
            self.overlayWindow?.orderOut(nil)
            self.state.isOverlayVisible = false
        }
    }
    
    func toggle() {
        if overlayWindow?.isVisible == true {
            hide()
        } else {
            show(mode: state.recordingMode)
        }
    }
    
    private func createOverlayWindow() {
        let screen = NSScreen.main?.frame ?? NSRect.zero
        let windowRect = NSRect(
            x: (screen.width - Constants.overlayWidth) / 2,
            y: (screen.height - Constants.overlayHeight) / 2,
            width: Constants.overlayWidth,
            height: Constants.overlayHeight
        )
        
        overlayWindow = OverlayWindow(contentRect: windowRect, 
                                     styleMask: [.borderless], 
                                     backing: .buffered, 
                                     defer: false)
        
        overlayWindow?.contentView = NSHostingView(rootView: OverlayView())
        overlayWindow?.center()
        overlayWindow?.level = .floating
        overlayWindow?.isOpaque = false
        overlayWindow?.backgroundColor = NSColor.clear
        overlayWindow?.hasShadow = true
    }
}

class OverlayWindow: NSPanel {
    override init(contentRect: NSRect, styleMask: NSWindow.StyleMask, backing: NSWindow.BackingStoreType, defer flag: Bool) {
        super.init(contentRect: contentRect, styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)

        // Performance optimizations as per spec
        self.level = .floating
        self.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenNone]
        self.isOpaque = false
        self.hasShadow = true
        self.backgroundColor = .clear

        // Critical: Don't steal focus from active application
        self.hidesOnDeactivate = false
        self.becomesKeyOnlyIfNeeded = true

        // Smooth animations
        self.animationBehavior = .utilityWindow
        
        // Allow clicks to pass through when not directly on interactive elements
        self.acceptsMouseMovedEvents = true
        self.ignoresMouseEvents = false
    }
    
    override var canBecomeKey: Bool {
        return true
    }
    
    override var canBecomeMain: Bool {
        return false
    }
    
    override func mouseDown(with event: NSEvent) {
        // Allow dragging the window
        self.performDrag(with: event)
    }
}