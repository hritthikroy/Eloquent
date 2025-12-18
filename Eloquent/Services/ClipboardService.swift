import Cocoa
import Carbon
import SwiftUI

class ClipboardService: ObservableObject {
    static let shared = ClipboardService()
    
    private init() {}
    
    func pasteText(_ text: String, preserveClipboard: Bool) async {
        // 1. Save current clipboard if needed
        let savedPasteboard = preserveClipboard ? NSPasteboard.general.string(forType: .string) : nil

        do {
            // 2. Copy new text to clipboard
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(text, forType: .string)

            // 3. Wait briefly for clipboard to settle
            try await Task.sleep(nanoseconds: 50_000_000) // 50ms

            // 4. Simulate Cmd+V to paste
            let source = CGEventSource(stateID: .hidSystemState)

            // Create key down event for 'V' with Command modifier
            let cmdVKeyDown = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: true)
            cmdVKeyDown?.flags = .maskCommand

            // Create key up event for 'V'
            let cmdVKeyUp = CGEvent(keyboardEventSource: source, virtualKey: 0x09, keyDown: false)
            cmdVKeyUp?.flags = .maskCommand

            // Post the events
            cmdVKeyDown?.post(tap: .cghidEventTap)
            cmdVKeyUp?.post(tap: .cghidEventTap)

            // 5. Restore original clipboard content if needed
            if preserveClipboard, let saved = savedPasteboard {
                try await Task.sleep(nanoseconds: 200_000_000) // 200ms to allow paste to complete
                NSPasteboard.general.clearContents()
                NSPasteboard.general.setString(saved, forType: .string)
            }
        } catch {
            // Fallback to character-by-character typing if paste fails
            print("Clipboard paste failed, using fallback method")
            typeText(text)
        }
    }
    
    func typeText(_ text: String) {
        let source = CGEventSource(stateID: .hidSystemState)
        
        for character in text {
            // Convert character to keycode
            var keyCode: UInt16 = 0
            
            // Basic mapping for common characters
            switch character.lowercased() {
            case "a": keyCode = 0x00
            case "b": keyCode = 0x0B
            case "c": keyCode = 0x08
            case "d": keyCode = 0x02
            case "e": keyCode = 0x0E
            case "f": keyCode = 0x03
            case "g": keyCode = 0x05
            case "h": keyCode = 0x04
            case "i": keyCode = 0x22
            case "j": keyCode = 0x26
            case "k": keyCode = 0x28
            case "l": keyCode = 0x25
            case "m": keyCode = 0x2E
            case "n": keyCode = 0x2D
            case "o": keyCode = 0x1F
            case "p": keyCode = 0x23
            case "q": keyCode = 0x0C
            case "r": keyCode = 0x0F
            case "s": keyCode = 0x01
            case "t": keyCode = 0x11
            case "u": keyCode = 0x20
            case "v": keyCode = 0x09
            case "w": keyCode = 0x0D
            case "x": keyCode = 0x07
            case "y": keyCode = 0x10
            case "z": keyCode = 0x06
            case "1": keyCode = 0x12
            case "2": keyCode = 0x13
            case "3": keyCode = 0x14
            case "4": keyCode = 0x15
            case "5": keyCode = 0x17
            case "6": keyCode = 0x16
            case "7": keyCode = 0x1A
            case "8": keyCode = 0x1C
            case "9": keyCode = 0x19
            case "0": keyCode = 0x1D
            case "\n": keyCode = 0x24 // Return
            case "\t": keyCode = 0x30 // Tab
            case " ": keyCode = 0x31 // Space
            case "-": keyCode = 0x1B
            case "=": keyCode = 0x18
            case "[": keyCode = 0x2F
            case "]": keyCode = 0x2D
            case "\\": keyCode = 0x2A
            case ";": keyCode = 0x29
            case "'": keyCode = 0x27
            case ",": keyCode = 0x2B
            case ".": keyCode = 0x2F
            case "/": keyCode = 0x2C
            default: continue // Skip unmapped characters
            }
            
            // Create key event
            if let keyEvent = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: true) {
                keyEvent.post(tap: .cghidEventTap)
            }
            
            // Key up event
            if let keyEvent = CGEvent(keyboardEventSource: source, virtualKey: keyCode, keyDown: false) {
                keyEvent.post(tap: .cghidEventTap)
            }
        }
    }
}