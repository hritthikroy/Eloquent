import Foundation
import SwiftUI
import HotKey
import Carbon

// MARK: - KeyCombo Extensions for HotKey
extension KeyCombo {
    var keyEquivalentString: String {
        var modifiers = ""
        
        if carbonModifiers & UInt32(controlKey) != 0 {
            modifiers += "⌃"
        }
        if carbonModifiers & UInt32(optionKey) != 0 {
            modifiers += "⌥"
        }
        if carbonModifiers & UInt32(shiftKey) != 0 {
            modifiers += "⇧"
        }
        if carbonModifiers & UInt32(cmdKey) != 0 {
            modifiers += "⌘"
        }
        
        let keyString = getKeyString(from: keyCode)
        return modifiers + keyString
    }
    
    private func getKeyString(from keyCode: UInt16) -> String {
        switch keyCode {
        case 0: return "A"
        case 1: return "S"
        case 2: return "D"
        case 6: return "Z"
        case 7: return "X"
        case 8: return "C"
        case 9: return "V"
        case 11: return "B"
        case 12: return "Q"
        case 13: return "W"
        case 14: return "E"
        case 15: return "R"
        case 16: return "Y"
        case 17: return "T"
        case 27: return "1"
        case 28: return "2"
        case 29: return "3"
        case 30: return "4"
        case 31: return "5"
        case 32: return "6"
        case 33: return "7"
        case 34: return "8"
        case 35: return "9"
        case 36: return "0"
        default: return String(UnicodeScalar(keyCode) ?? "?")
        }
    }
}

// MARK: - String Extensions
extension String {
    func localized() -> String {
        return NSLocalizedString(self, comment: "")
    }
}

// MARK: - Date Extensions
extension Date {
    func timeAgoDisplay() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.dateTimeStyle = .named
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

// MARK: - View Extensions
extension View {
    func navigationSplitViewSidebar() -> some View {
        self
            .toolbar {
                ToolbarItem(placement: .sidebar) {
                    Spacer()
                }
            }
    }
}