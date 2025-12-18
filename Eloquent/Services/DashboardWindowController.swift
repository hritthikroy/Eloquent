import Cocoa
import SwiftUI

enum DashboardSection {
    case home
    case history
    case dictionary
    case replaceText
    case settings
}

class DashboardWindowController: NSWindowController {
    static let shared = DashboardWindowController()
    
    private var dashboardWindow: NSWindow?
    private var selectedSection: DashboardSection = .home
    
    private var state: AppState {
        return AppState.shared
    }
    
    private init() {
        super.init(window: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    func show(section: DashboardSection = .home) {
        self.selectedSection = section
        
        DispatchQueue.main.async {
            if self.dashboardWindow == nil {
                self.createDashboardWindow()
            }
            
            self.state.isDashboardVisible = true
            self.dashboardWindow?.makeKeyAndOrderFront(nil)
        }
    }
    
    func hide() {
        DispatchQueue.main.async {
            self.dashboardWindow?.orderOut(nil)
            self.state.isDashboardVisible = false
        }
    }
    
    func toggle() {
        if dashboardWindow?.isVisible == true {
            hide()
        } else {
            show()
        }
    }
    
    private func createDashboardWindow() {
        let screen = NSScreen.main?.frame ?? NSRect.zero
        let windowRect = NSRect(
            x: (screen.width - Constants.dashboardWidth) / 2,
            y: (screen.height - Constants.dashboardHeight) / 2,
            width: Constants.dashboardWidth,
            height: Constants.dashboardHeight
        )
        
        dashboardWindow = NSWindow(
            contentRect: windowRect,
            styleMask: [.titled, .closable, .resizable],
            backing: .buffered,
            defer: false
        )
        
        dashboardWindow?.title = "Eloquent Dashboard"
        dashboardWindow?.center()
        dashboardWindow?.contentView = NSHostingView(
            rootView: DashboardView(selectedSection: $selectedSection)
        )
        
        // Set min size
        dashboardWindow?.minSize = NSSize(width: 700, height: 500)
    }
}