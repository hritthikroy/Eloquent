# Libboard Prompt Generation & Conversation Processor Developer Guide

The **Conversation Processor** is a core subsystem within the Eloquent workspace that ingests dialogue transcripts between the user and specialist agents (Tuk Tuk, Andrew, Friday, Brian), extracts actionable engineering intents, and constructs authoritative, production-ready **Libboard / Antigravity execution prompts**.

---

## 1. Architectural Overview

```
[User-Tuk Dialogue Transcript]
            │
            ▼
┌──────────────────────────────────────┐
│  ConversationProcessor               │
│  - Speaker turn extraction           │
│  - Actionable intent discovery       │
│  - Architectural domain inference    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  Libboard Prompt Formatter           │
│  - 3-Section AST Layout              │
│  - Zero conversational filler        │
│  - Pure plain-text output            │
└──────────────────┬───────────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐  ┌───────────────────────────────┐
│ Electron IPC     │  │ LibboardPromptViewer.jsx      │
│ generate-libboard│  │ - One-click clipboard copy    │
│ channel          │  │ - Graceful error surfacing    │
└──────────────────┘  └───────────────────────────────┘
```

---

## 2. Expected Input Formats

`ConversationProcessor.generatePrompt(input, options)` supports three flexible input structures:

### A. Structured Array of Turns (Preferred)
```json
[
  { "speaker": "user", "text": "We need to optimize the Go audio pipeline ring buffers." },
  { "speaker": "tuk", "text": "On it babe! Andrew and Brian are reviewing the latency equations." },
  { "speaker": "user", "text": "Ensure 16kHz PCM audio streaming holds under 20ms latency." }
]
```

### B. Serialized JSON String
Any JSON string encoding an array of turns or an object with `{ turns: [...] }` or `{ history: [...] }`.

### C. Plain-Text Line-by-Line Transcript
```text
User: We need to decouple the canvas visualizer from UI reflows.
Tuk Tuk: Right here babe! Dispatching telemetry via zero-lag IPC.
User: Verify all channel listeners are registered.
```

---

## 3. Libboard Prompt Output Schema

The generated prompt strictly adheres to the 3-section format:

1. **Clear Technical Objective**:
   Synthesizes the core developer intent, target application, and technical domain into an authoritative directive.
2. **Key Files / Architecture**:
   Maps the objective to concrete file paths within the Eloquent stack (`src/main/`, `src/renderer/`, `backend-go/`).
3. **Quality Requirements & AST Verification**:
   Enumerates actionable validation invariants, performance constraints, and static analysis commands.

---

## 4. Electron IPC Channel Reference

### `generate-libboard-prompt`
Invoked from the renderer process via `ipcRenderer.invoke('generate-libboard-prompt', payload)`.

#### Payload Schema:
```typescript
interface GenerateLibboardPromptPayload {
  conversationData?: Array<{ speaker: string; text: string }> | string;
  copyToClipboard?: boolean; // When true, copies prompt directly via pbcopy on macOS
}
```

#### Response Schema:
```typescript
interface GenerateLibboardPromptResponse {
  success: boolean;
  prompt: string | null;
  error: string | null;
  turnsCount: number;
  actionsCount?: number;
  domain?: string;
}
```

#### Edge-Case Error Handling:
If the input data is missing, empty, or malformed, the handler returns:
```json
{
  "success": false,
  "error": "Unable to generate Libboard prompt: conversation data invalid",
  "prompt": null,
  "turnsCount": 0
}
```

---

## 5. UI Integration (`LibboardPromptViewer.jsx`)

The React component can be embedded into any developer overlay or settings pane:

```jsx
import { LibboardPromptViewer } from './components/LibboardPromptViewer';

function DevPanel() {
  return (
    <div className="dev-panel">
      <LibboardPromptViewer
        onPromptCopied={(prompt) => console.log('Copied to clipboard:', prompt.length)}
      />
    </div>
  );
}
```

---

## 6. Running Unit Tests

Execute the unit test suite with:
```bash
node test/unit/conversationProcessor.test.js
```
Or run the full CI test suite:
```bash
npm test
```
