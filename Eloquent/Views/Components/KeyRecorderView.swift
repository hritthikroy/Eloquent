import SwiftUI
import HotKey

struct KeyRecorderView: NSViewRepresentable {
    @Binding var keyCombo: KeyCombo?
    
    func makeNSView(context: Context) -> KeyComboView {
        let view = KeyComboView()
        view.keyCombo = keyCombo
        view.delegate = context.coordinator
        return view
    }
    
    func updateNSView(_ nsView: KeyComboView, context: Context) {
        nsView.keyCombo = keyCombo
    }
    
    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    class Coordinator: KeyComboViewDelegate {
        let parent: KeyRecorderView
        
        init(_ parent: KeyRecorderView) {
            self.parent = parent
        }
        
        func keyComboView(_ keyComboView: KeyComboView, didChangeKeyCombo keyCombo: KeyCombo?) {
            parent.keyCombo = keyCombo
        }
    }
}

class KeyComboView: NSView {
    weak var delegate: KeyComboViewDelegate?
    
    var keyCombo: KeyCombo? {
        didSet {
            needsDisplay = true
        }
    }
    
    override var intrinsicContentSize: NSSize {
        return NSSize(width: 120, height: 30)
    }
    
    override func draw(_ dirtyRect: NSRect) {
        // Draw background
        NSColor.controlBackgroundColor.setFill()
        __NSRectFill(bounds)
        
        // Draw border
        NSColor.separatorColor.setStroke()
        let path = NSBezierPath(rect: bounds.insetBy(dx: 0.5, dy: 0.5))
        path.lineWidth = 1
        path.stroke()
        
        // Draw text
        let attributes: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13),
            .foregroundColor: NSColor.labelColor
        ]
        
        let title = keyCombo?.keyEquivalentString ?? "Press shortcut"
        let textSize = title.size(withAttributes: attributes)
        let textRect = NSRect(
            x: bounds.midX - textSize.width / 2,
            y: bounds.midY - textSize.height / 2,
            width: textSize.width,
            height: textSize.height
        )
        
        title.draw(in: textRect, withAttributes: attributes)
    }
    
    override func keyDown(with event: NSEvent) {
        // Check if it's a valid key combination
        if event.keyCode != 53 { // 53 is escape key which we handle differently
            let modifiers = event.modifierFlags
            let carbonModifiers = carbonFlags(from: modifiers)
            
            // Create new key combo if we have at least one modifier key
            if carbonModifiers != 0 {
                let newKeyCombo = KeyCombo(carbonKeyCode: event.keyCode, carbonModifiers: carbonModifiers)
                self.keyCombo = newKeyCombo
                delegate?.keyComboView(self, didChangeKeyCombo: newKeyCombo)
            }
        }
        
        // We don't call super.keyDown to prevent the default behavior
    }
    
    override func mouseDown(with event: NSEvent) {
        // Focus the view to receive key events
        window?.makeFirstResponder(self)
    }
    
    private func carbonFlags(from modifiers: NSEvent.ModifierFlags) -> UInt32 {
        var flags: UInt32 = 0
        
        if modifiers.contains(.command) {
            flags |= UInt32(cmdKey)
        }
        
        if modifiers.contains(.option) {
            flags |= UInt32(optionKey)
        }
        
        if modifiers.contains(.control) {
            flags |= UInt32(controlKey)
        }
        
        if modifiers.contains(.shift) {
            flags |= UInt32(shiftKey)
        }
        
        return flags
    }
}

protocol KeyComboViewDelegate: AnyObject {
    func keyComboView(_ keyComboView: KeyComboView, didChangeKeyCombo keyCombo: KeyCombo?)
}