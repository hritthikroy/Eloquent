import XCTest
@testable import Eloquent

final class EloquentTests: XCTestCase {
    func testAppStateInitialization() {
        let state = AppState.shared
        XCTAssertFalse(state.isRecording)
        XCTAssertFalse(state.isProcessing)
        XCTAssertEqual(state.recordingMode, .standard)
        XCTAssertEqual(state.waveformAmplitudes.count, 40)
    }
    
    func testConstants() {
        XCTAssertNotNil(Constants.appName)
        XCTAssertEqual(Constants.overlayWidth, 480)
        XCTAssertEqual(Constants.overlayHeight, 120)
        XCTAssertEqual(Constants.defaultStandardShortcut?.keyCode, 2) // Alt+D
    }
    
    func testTranscriptionItemCreation() {
        let item = TranscriptionItem(text: "Test transcription", duration: 5.0)
        XCTAssertNotNil(item.id)
        XCTAssertEqual(item.text, "Test transcription")
        XCTAssertEqual(item.duration, 5.0)
        XCTAssertFalse(item.wasRewritten)
    }
    
    func testReplaceRuleCreation() {
        let rule = ReplaceRule(find: "um", replace: "")
        XCTAssertEqual(rule.find, "um")
        XCTAssertEqual(rule.replace, "")
    }
}