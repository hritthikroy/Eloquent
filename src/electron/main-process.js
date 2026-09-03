/**
 * Electron Main Process Bridge (CommonJS)
 * Routes raw user input through the PromptEngineer engine.
 */

let MainProcessPromptBridge;
try {
  MainProcessPromptBridge = require('../../dist-ts/src/electron/main-process').MainProcessPromptBridge;
} catch (e) {
  MainProcessPromptBridge = class {
    static async routeUserInput(rawInput) {
      return { rawText: rawInput };
    }
    static registerIpcHandlers() {}
  };
}

module.exports = { MainProcessPromptBridge };
