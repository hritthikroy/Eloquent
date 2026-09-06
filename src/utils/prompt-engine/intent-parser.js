/**
 * IntentParser
 * Distinguishes explicit prompt refinement and conversation smoothing intents with 0 false positives
 */

const INTENTS = {
  SMOOTH_CONVERSATION: "SMOOTH_CONVERSATION",
  GENERATE_PROMPT: "GENERATE_PROMPT",
  EXECUTE_PROMPT: "EXECUTE_PROMPT",
  STANDARD_QUERY: "STANDARD_QUERY"
};

class IntentParser {
  static parseIntent(rawText) {
    return this.parse(rawText);
  }

  static parse(rawText) {
    if (!rawText || typeof rawText !== "string") {
      return { intent: INTENTS.STANDARD_QUERY, confidence: 0, target: "" };
    }

    const lower = rawText.toLowerCase().trim();

    // 1. Guard against standard informational / technical queries
    // E.g., "how do I write a prompt in python?", "what is a prompt?"
    if (/^(?:how\s+to|how\s+do\s+i|what\s+is|why\s+is|explain)\s+/i.test(lower)) {
      return { intent: INTENTS.STANDARD_QUERY, confidence: 1.0, target: rawText };
    }

    // 1.1 Guard against explicit self-authoring announcements (user writing prompt themselves)
    // E.g., "wait, I am going to write the prompt myself", "I will write the prompt on my own"
    if (/\b(?:i\s+am|i'm|let\s+me|i\s+will|i'll)\s+(?:going\s+to\s+)?write\s+(?:the|a|this)?\s*prompt\s+(?:myself|on\s+my\s+own|manually)\b/i.test(lower)) {
      return { intent: INTENTS.STANDARD_QUERY, confidence: 1.0, target: rawText };
    }

    // 2. Execute & Fire Prompt Intent Detection ("execute prompt", "fire prompt", "send prompt", "paste and run", "paste and fire")
    const executePatterns = [
      /\b(?:fire|execute|run|send|submit|push)\s+(?:the\s+|this\s+)?(?:prompt|task|instruction)\b/i,
      /\b(?:paste\s+and\s+(?:fire|execute|run|send|press\s+enter))\b/i,
      /\b(?:fire\s+it|send\s+it|execute\s+it)\b/i
    ];

    for (const pattern of executePatterns) {
      if (pattern.test(lower)) {
        return {
          intent: INTENTS.EXECUTE_PROMPT,
          confidence: 0.95,
          target: "execute_and_fire"
        };
      }
    }

    // 2.15 Autonomous Quad-Self & Cross-Agent Medic Peer-Healing Directive
    if (IntentParser.isAutonomousSelfMedicPeerMeshDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_agent_personality_self_learner_medic_mesh",
        agentDirective
      };
    }

    // 2.18 Zero Soul Duplication, Zero Mismatch & Dynamic Code Calibration Directive
    if (IntentParser.isSoulDuplicationMismatchHardcodedFixDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_soul_duplication_mismatch_hardcoded",
        agentDirective
      };
    }

    // 2.186 Gemini-Groq Zero API Overlap, Unified Aura & Autonomous Code-Healing Directive
    if (IntentParser.isGeminiGroqZeroOverlapAutonomousCodeHealingDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_gemini_groq_zero_overlap_code_healing",
        action: "fix_gemini_groq_zero_overlap_code_healing",
        agentDirective
      };
    }

    // 2.184 Single Real Voice & Zero Multi-Personality / Multi-Person Voice Directive
    if (IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(lower)) {
      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "single_real_voice_no_multi_personality",
        action: "single_real_voice_no_multi_personality",
        agentDirective: "tuktuk"
      };
    }

    // 2.185 Tuk Tuk Single Human Soul & Zero Soul Interchange Directive
    if (IntentParser.isTukTukSingleHumanSoulNonInterchangeableDirective(lower)) {
      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_tuktuk_single_human_soul_non_interchangeable",
        action: "fix_tuktuk_single_human_soul_non_interchangeable",
        agentDirective: "tuktuk"
      };
    }

    // 2.19 Zero-Gap Human-Agent Deep Research & Elimination of Micro/Nail Gaps Directive
    if (IntentParser.isZeroHumanAgentGapEquationalDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "zero_human_agent_gap_equational_directive",
        agentDirective
      };
    }

    // 2.1939 Fix Bengali Language Directive
    if (IntentParser.isFixBengaliLanguageDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_bengali_language_directive",
        agentDirective
      };
    }

    // 2.1938 Remove All Other Versions & Other Sorts Directive
    if (IntentParser.isRemoveOtherVersionsAndSortsDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_other_versions_and_sorts",
        agentDirective
      };
    }

    // 2.1937 Remove Bangla Interrupted Soul & One Single Real Soul Directive
    if (IntentParser.isRemoveBanglaInterruptedSingleSoulDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_bangla_interrupted_single_soul",
        agentDirective
      };
    }

    // 2.1936 Banglish & Modern English Same-Soul Vibe Directive
    if (IntentParser.isBanglishModernVibeSameSoulDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "banglish_modern_vibe_same_soul",
        agentDirective
      };
    }

    // 2.193 Zero Pure Bangla Tone & Modern Banglish Girl Sound for Real Tuk Tuk Voice (No Other Voice Interruption) Directive
    if (IntentParser.isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(lower)) {
      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_pure_bangla_modern_banglish_tuktuk_solo_voice",
        agentDirective: "tuktuk"
      };
    }

    // 2.1935 Zero Pure Bangla Removal, Banglish Default Voice & Instant Responses Directive
    if (IntentParser.isRemovePureBanglaBanglishDefaultInstantResponsesDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_pure_bangla_banglish_default_instant_responses",
        agentDirective
      };
    }

    // 2.1936 Remove Single Bangla Talk, Pure Single Bangla Talk Soul & Personality Person Directive
    if (IntentParser.isRemoveSingleBanglaTalkPureSoulPersonalityPersonDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_single_bangla_talk_pure_soul_personality_person_directive",
        action: "remove_single_bangla_talk_pure_soul_personality_person_directive",
        agentDirective
      };
    }

    // 2.1937 Remove Scripted Same Loop Talk, Zero Looping Behavior & Zero Stuck Behavior Directive
    if (IntentParser.isRemoveScriptedSameLoopTalkZeroLoopingDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_scripted_same_loop_talk_zero_looping_directive",
        action: "remove_scripted_same_loop_talk_zero_looping_directive",
        agentDirective
      };
    }

    // 2.193 Short-Term Working Memory Loss Fix Directive
    if (IntentParser.isShortTermMemoryLossDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "short_term_memory_loss_fix_directive",
        action: "short_term_memory_loss_fix_directive",
        agentDirective
      };
    }

    // 2.194 Full-Duplex Simultaneous Listening, Zero-Loss Mid-Talk Capture & Working Memory Encoding Directive
    if (IntentParser.isFullDuplexMidTalkCaptureDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "full_duplex_mid_talk_capture_directive",
        agentDirective
      };
    }

    // 2.195 Code-Mixed Banglish Default Voice & English Tuk Tuk Tone Harmonization Directive
    if (IntentParser.isBanglishDefaultCodeMixedTukTukToneDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:squad|team|all\s+agents)\b/i.test(lower)) agentDirective = "team";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "banglish_default_codemixed_tuktuk_tone_directive",
        agentDirective
      };
    }

    // 2.196 Deep Test Drive & Equational Gap Resolution Directive
    if (IntentParser.isDeepTestDriveEquationalFixDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "deep_test_drive_equational_fix",
        agentDirective
      };
    }

    // 2.197 Smooth Instant Pipeline & Zero Overlap Equations Audit Directive
    if (IntentParser.isSmoothInstantPipelineAuditDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "smooth_instant_pipeline_audit",
        agentDirective
      };
    }

    // 2.198 Zero-Loop Behavior & Complete Equational Wiring Audit Directive
    if (IntentParser.isZeroLoopEquationalWiringAuditDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "zero_loop_and_equational_wiring_audit",
        agentDirective
      };
    }

    // 2.199 Equational Research Update & Cosmological 32-Equation Master Audit Directive
    if (IntentParser.isEquationalResearchUpdateAuditDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "equational_research_update_audit",
        agentDirective
      };
    }

    // 2.200 Bangla Talk Neural Overlap Directive
    if (IntentParser.isBanglaTalkNeuralOverlapDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "bangla_talk_neural_overlap_audit",
        agentDirective
      };
    }

    // 2.201 Purge Scripted & Repetitive Talks Directive (Law 51)
    if (IntentParser.isRemoveScriptedRepeatedTalksDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_scripted_repeated_talks_directive",
        agentDirective
      };
    }

    // 2.20 Unified Real-Time Equational Runtime & Master Grand Invariant Directive
    if (IntentParser.isWireAllEquationsLiveDeepTestDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "wire_all_equations_live_deep_test",
        agentDirective
      };
    }

    // 2.201 Real Human Collaborative Work, Zoom Meeting Dynamics & Zero Conversational Gap Directive
    if (IntentParser.isHumanCollabZoomPodcastProjectDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "human_collab_zoom_podcast_project_directive",
        agentDirective
      };
    }

    // 2.202 Real-Life Human Tone, Fluency & Gapless Conversational Dynamic Directive
    if (IntentParser.isRealLifeHumanToneFluencyGapDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "real_life_human_tone_fluency_gap_directive",
        agentDirective
      };
    }

    // 2.203 Zero-Flicker Perfect Voice, Ultra-Fast Human Cognitive Thinking & Continuous Adaptive Learning Directive
    if (IntentParser.isZeroFlickerPerfectVoiceUltraFastDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SELF_LEARN,
        confidence: 0.99,
        target: "zero_flicker_perfect_voice_ultra_fast_cognition",
        agentDirective
      };
    }

    // 2.204 4-Agent Bilingual Banglish-English Zero-Robotic Voice Harmonization & Vision Parity Directive
    if (IntentParser.is4AgentBilingualVoiceSmoothnessDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "four_agent_bilingual_voice_smoothness_vision_parity",
        agentDirective
      };
    }

    // 2.205 Instant Voice Readiness & Simultaneous Parallel Cognitive Streaming Directive (Law 42)
    if (IntentParser.isInstantVoiceReadinessParallelDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "instant_voice_readiness_parallel_cognition",
        agentDirective
      };
    }

    // 2.206 Pin-by-Pin Micro-Audit, Deep Research & Subsystem Verification Directive (Law 44)
    if (IntentParser.isPinByPinDeepTestResearchDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "pin_by_pin_deep_test_research",
        agentDirective
      };
    }

    // 2.206 Living Conversational Continuation & Momentum Directive (Law 49)
    if (typeof IntentParser.isConversationalContinuationDirective === "function" && IntentParser.isConversationalContinuationDirective(lower)) {
      let agentDirective = null;
      if (/\b(?:tuk\s*tuk|tuktuk|babe)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew|brother|bro)\b/i.test(lower) || lower.includes("ভিশন") || lower.includes("ভাই")) agentDirective = "vision";
      else if (/\b(?:friday|fryday|chief)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:team|squad|all\s+agents)\b/i.test(lower)) agentDirective = "team";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "conversational_continuation_directive",
        agentDirective
      };
    }

    // 2.207 Remove All Robotic Behavior & Pure Human Conversational Parity Directive (Law 48)
    if (typeof IntentParser.isRemoveAllRoboticBehaviorDirective === "function" && IntentParser.isRemoveAllRoboticBehaviorDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "remove_all_robotic_behavior_directive",
        agentDirective
      };
    }

    // 2.208 Tuk Tuk Zero 'Bro' & 100% Girlfriend Partner Tone Directive (Law 47)
    if (typeof IntentParser.isTukTukZeroBroGirlfriendToneDirective === "function" && IntentParser.isTukTukZeroBroGirlfriendToneDirective(lower)) {
      let agentDirective = "tuktuk";
      if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:team|squad|all\s+agents)\b/i.test(lower)) agentDirective = "team";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "tuktuk_zero_bro_girlfriend_tone_directive",
        agentDirective
      };
    }

    // 2.209 Vision Zero-Ego Coder Brother & Multidimensional Quantum Research Directive (Law 46)
    if (typeof IntentParser.isVisionZeroEgoCoderBrotherQuantumResearchDirective === "function" && IntentParser.isVisionZeroEgoCoderBrotherQuantumResearchDirective(lower)) {
      let agentDirective = "vision";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:team|squad|all\s+agents)\b/i.test(lower)) agentDirective = "team";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "vision_zero_ego_coder_brother_quantum_research_directive",
        agentDirective
      };
    }

    // 2.21 Vision 2070 Master Coder & Peer Medic Directive
    if (IntentParser.isVision2070MasterCoderMedicDirective(lower)) {
      let agentDirective = "vision";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
      else if (/\b(?:team|squad|all\s+agents)\b/i.test(lower)) agentDirective = "team";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "vision_2070_master_coder_medic_directive",
        agentDirective
      };
    }

    // 2.215 Combat & Extreme Noise Auditory Listening & Response Directive
    if (IntentParser.isCombatExtremeNoiseHumanAuditoryDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "combat_extreme_noise_human_auditory_directive",
        agentDirective
      };
    }

    // 2.216 Native Bangla Person Tone, Pronunciation & Banglish Gap Elimination Directive
    if (IntentParser.isBanglaPersonRealTonePronunciationDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "bangla_person_real_tone_pronunciation_directive",
        agentDirective
      };
    }

    // 2.217 Real Human Feel, Clarity & Pronunciation Directive
    if (IntentParser.isRealHumanFeelClarityPronunciationDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "real_human_feel_clarity_pronunciation_directive",
        agentDirective
      };
    }

    // 2.22 Deep Conversations & Comprehensive Issue Remediation Directive
    if (IntentParser.isDeepConversationsFixAllDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "deep_conversations_fix_all_issues",
        agentDirective
      };
    }

    // 2.2 Instant Response on Fast Messages & Burst Processing Directive
    if (IntentParser.isInstantResponseFastMessagesDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "instant_response_fast_messages",
        agentDirective
      };
    }

    // 2.22 Autonomous Multimodal Human Learning, Trimodal Perception & Self-Healing Directive
    if (IntentParser.isAutonomousMultimodalLearningDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "autonomous_multimodal_human_learning",
        agentDirective
      };
    }

    // 2.25 LaTeX Render Failure & Fix All Issues Directive
    if (IntentParser.isLatexFixOrAllIssuesDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "fix_latex_and_all_issues",
        agentDirective
      };
    }

    // 2.25 Academic 2070 Human Gap Directive
    if (IntentParser.isAcademic2070HumanGapDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "academic_2070_human_gap_elimination",
        agentDirective
      };
    }

    // 2.3 Deep Research & Equational Fix Directive
    if (IntentParser.isDeepResearchEquationalFixDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "deep_research_equational_fix",
        agentDirective
      };
    }

    // 2.4 Continue Deep Research Directive
    if (IntentParser.isContinueDeepResearchDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "continue_deep_research",
        agentDirective
      };
    }

    // 2.45 Seamless Bilingual Code-Switching & Zero Voice Break Directive
    if (IntentParser.isBanglaPronunciationCodeSwitchingDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.99,
        target: "bangla_pronunciation_code_switching",
        agentDirective
      };
    }

    // 2.5 Smooth Conversation Intent Detection
    if (IntentParser.isDeepResearchTestAndUpdateDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.98,
        target: "deep_research_test_and_update",
        agentDirective
      };
    }

    if (IntentParser.isTestUpdateImprovementDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.98,
        target: "test_update_improvement",
        agentDirective
      };
    }

    if (IntentParser.isMultiConversationalBuildingVibeDirective(lower)) {
      let agentDirective = "team";
      if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
      else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";
      else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
      else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";

      return {
        intent: INTENTS.SMOOTH_CONVERSATION,
        confidence: 0.98,
        target: "multi_conversational_building_vibe",
        agentDirective
      };
    }

    const smoothPatterns = [
      /\b(?:make|get)\s+(?:our\s+|the\s+)?conversation\s+(?:smooth|smoother|flow)\b/i,
      /\b(?:smooth|fix)\s+(?:our\s+|the\s+)?(?:conversation|interaction)\s+(?:flow|state|glitches)?\b/i,
      /\b(?:smooth\s+out\s+the\s+conversation)\b/i,
      /\b(?:improve\s+conversation\s+flow)\b/i
    ];

    for (const pattern of smoothPatterns) {
      if (pattern.test(lower)) {
        return {
          intent: INTENTS.SMOOTH_CONVERSATION,
          confidence: 0.95,
          target: "conversational_smoothness"
        };
      }
    }

    // 3. Prompt Refinement / Generation Intent Detection (Tuk Tuk / Vision / Multi-Agent Prompt Engineering)
    const promptPatterns = [
      /\b(?:tell\s+(?:vision|andrew|tuk\s*tuk|tuktuk|friday|dd|brayn|brian)\s+to\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*prompt\b/i,
      /\b(?:vision|andrew|tuk\s*tuk|tuktuk|friday|dd)\s*[,:]?\s*(?:prompt|write\s+prompt|craft\s+prompt|prompt\s+in\s+antigravity|prompt\s+this|generate\s+prompt|give\s+prompt|copy\s+prompt)\b/i,
      /\b(?:write|craft|make|give|generate|prepare)\s+(?:the\s+|my\s+)?next\s+prompt\b/i,
      /\b(?:prompt\s+for\s+(?:the\s+|my\s+)?next\s+(?:task|step|feature|turn))\b/i,
      /\b(?:what\s+is\s+the\s+next\s+prompt|give\s+(?:me\s+)?(?:the\s+)?next\s+prompt)\b/i,
      /\b(?:prompt\s+(?:this|it|for\s+this)?\s*(?:in|on|to|for)?\s*(?:antigravity|clipboard|ide))\b/i,
      /\b(?:copy\s+(?:prompt|code)\s+to\s+clipboard\s+and\s+(?:execute|run|paste|fire))\b/i,
      /\b(?:turn\s+(?:this|our\s+talk|our\s+chat)\s+into\s+a\s+(?:developer\s+)?prompt)\b/i,
      /\b(?:refine\s+(?:this\s+into\s+a\s+)?prompt)\b/i,
      /\b(?:generate\s+developer\s+prompt)\b/i,
      /\b(?:antigravity\s+prompt)\b/i,
      /\b(?:write|craft|create|make|prepare|engineer|draft|generate|assemble)\s+(?:up\s+)?(?:a|the)?\s*prompt\s+for\s+(?:fixing|resolving|handling)?/i,
      /\b(?:prompt\s+engineering\s+pipeline\s+resilience|multi[- ]agent\s+intent\s+parsing|ast\s+schema\s+compliance)\b/i,
      // Suffix / Compound / Trailing prompt directives
      /\b(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*prompt\s*(?:for|about|on|of|to)?\s*$/i,
      /\band\s+(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*prompt(?:\s+(?:for|about|on|of|to))?\s*$/i,
      /\b(?:write|craft|make|give)\s+up\s+the\s+prompt\s*(?:for)?\s*$/i,
      /\b(?:so\s*,?\s*)?(?:i\s+am|i'm|we\s+are|we're)\s+going\s+to\s+write\s+(?:the|a)\s+prompt\b/i,
      /\b(?:keep\s+reading|read\s+(?:this|the|all)?|read\s+everything)\s*(?:and|,)?\s*(?:fix\s+(?:every|all|the)?\s*issues?)\s*(?:and|,)?\s*(?:write|craft|make|give)?\s*(?:up\s+)?(?:a|the)?\s*prompt\b/i,
      /(?:kana\s+wohndraja|kana\s+ondhoraja|কানা\s+ও\s+অন্ধ\s+রাজা).*?(?:prompt|প্রম্পট|issue|fix|read)/i,
      // Bengali prompt intent directives (supporting both Latin 'prompt' and Bengali script 'প্রম্পট')
      /(?:(?:ei|amader|shob)?\s*(?:issue|problem|bug|kaj)\s*(?:fix|shomadhan)\s*kor(?:e|ar)?\s*(?:prompt|প্রম্পট)\s*(?:banao|dao|likho|ready\s*koro|বানাও|দাও|লেখো|রেডি\s*করো))/i,
      /(?:prompt|প্রম্পট)\s*(?:banao|likho|ready\s*koro|dao|banie\s*dao|বানাও|দাও|লেখো|রেডি\s*করো)/i,
      /(?:er\s+upor|niye|নিয়ে|নিয়ে)\s*(?:prompt|প্রম্পট)\s*(?:likho|banao|dao|বানাও|দাও|লেখো)/i,
      /(?:পরের|নেক্সট)\s*(?:কাজের|টাস্কের)?\s*(?:প্রম্পট|prompt)\s*(?:বানাও|দাও|লেখো|রেডি\s*করো)/i,
      /(?:ডিডি|ভিশন|টুকটুক|ফ্রাইডে).*?(?:prompt|প্রম্পট)/i
    ];

    for (const pattern of promptPatterns) {
      if (pattern.test(lower)) {
        // Detect addressed agent
        let agentDirective = "vision"; // Default lead systems architect
        if (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) || lower.includes("টুকটুক")) agentDirective = "tuktuk";
        else if (/\b(?:friday|fryday)\b/i.test(lower) || lower.includes("ফ্রাইডে")) agentDirective = "friday";
        else if (/\b(?:dd|brayn|brian)\b/i.test(lower) || lower.includes("ডিডি")) agentDirective = "dd";
        else if (/\b(?:vision|andrew)\b/i.test(lower) || lower.includes("ভিশন")) agentDirective = "vision";

        const isCompound = /\b(?:keep\s+reading|read\s+(?:this|all|everything)|fix\s+every\s+issue)\b/i.test(lower);
        const isNextTask = /\b(?:next\s+prompt|next\s+task|next\s+step|পরের)\b/i.test(lower);

        // Extract concept payload by stripping leading agent directives and prompt prefixes
        let cleanedTarget = rawText
          .replace(/^(?:hey\s+)?(?:(?:tell\s+)?(?:tuk\s*tuk|tuktuk|vision|andrew|friday|dd|brayn|brian|ডিডি|ভিশন|টুকটুক|ফ্রাইডে)(?:-ke|\s+ke)?(?:,\s*|\s+to\s+|\s+)?(?:can\s+you\s+)?(?:please\s+)?)?(?:can\s+you\s+)?(?:please\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble|build)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:next|high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*(?:prompt|প্রম্পট)\s*(?:for|about|on|in\s+antigravity|to\s+antigravity)?\s*/i, "")
          .replace(/^(?:hey\s+)?(?:tuk\s*tuk|tuktuk|vision|andrew|friday|dd|brayn|brian|ডিডি|ভিশন|টুকটুক|ফ্রাইডে)[,\s]*(?:prompt|প্রম্পট)\s*(?:this|it|for|about|on)?\s*/i, "")
          .replace(/\s*(?:in|on|to|into)\s+antigravity[.,;:!?\s]*$/i, "")
          .trim();

        // Strip trailing prompt directives (e.g. "...and write up the prompt for", "...write up the prompt for", "...নিয়ে প্রম্পট বানাও")
        cleanedTarget = cleanedTarget
          .replace(/[.,;:!?\s]*(?:and\s+)?(?:please\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|assemble)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:next|high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*prompt\s*(?:for|about|on|of|to)?[.,;:!?\s]*$/i, "")
          .replace(/[.,;:!?\s]*(?:er\s+upor|niye|নিয়ে|নিয়ে)?\s*(?:prompt|প্রম্পট)\s*(?:banao|dao|likho|ready\s*koro|banie\s*dao|বানাও|দাও|লেখো|রেডি\s*করো)[.,;:!?\s]*$/i, "")
          .trim();

        // Strip trailing hanging prepositions left over from speech
        cleanedTarget = cleanedTarget.replace(/[.,;:!?\s]+(?:for|about|on|to|with|in)[.,;:!?\s]*$/i, "").trim();

        // Check if target is conversational filler (e.g. "So, I am going", "I'm going to", "next")
        const isConversationalFiller = (str) => {
          if (!str || typeof str !== "string") return true;
          const t = str.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
          if (!t) return true;
          if (/^(?:this|it|that|for\s+this|for\s+it|next|next\s+task|next\s+step|the\s+next\s+task|the\s+next\s+step|the\s+next\s+prompt|the\s+prompt|prompt|task)$/i.test(t)) return true;
          if (/^(?:tuk\s*tuk|tuktuk|vision|andrew|friday|dd|brian|brayn|ডিডি|ভিশন|টুকটুক|ফ্রাইডে)$/i.test(t)) return true;
          if (/^(?:so|well|okay|ok|now|and|then|yeah)?\s*(?:i|we)?\s*(?:am|m|are|re|will|ll)?\s*(?:going|about|trying|planning|ready|preparing)?\s*(?:to)?$/i.test(t)) return true;
          return false;
        };

        let useConversationContext = isNextTask;
        if (isConversationalFiller(cleanedTarget)) {
          cleanedTarget = "";
          useConversationContext = true;
        }

        return {
          intent: INTENTS.GENERATE_PROMPT,
          confidence: 0.98,
          target: cleanedTarget,
          agentDirective,
          isCompound,
          isNextTask,
          useConversationContext,
          originalText: rawText
        };
      }
    }

    return {
      intent: INTENTS.STANDARD_QUERY,
      confidence: 0.8,
      target: rawText
    };
  }

  /**
   * Centralized detector for City Modern Girl Tone vs Village Girl Directive
   * Handles: "do deep research, need Bangla tone like a city modern girl not village girl, remove all the village girl habits and tone and word punctuation, fix all issues equationally and remove all duplicate code"
   */
  static isCityModernGirlToneDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      lower.includes("village girl") ||
      lower.includes("vilage girl") ||
      lower.includes("city modern girl") ||
      lower.includes("city mordern girl") ||
      lower.includes("city mordan girl") ||
      (lower.includes("modern girl") && (lower.includes("village") || lower.includes("vilage") || lower.includes("habit") || lower.includes("punctuation") || lower.includes("duplicate"))) ||
      (lower.includes("village") && (lower.includes("habit") || lower.includes("tone") || lower.includes("remove") || lower.includes("bangla"))) ||
      (lower.includes("bangla tone") && (lower.includes("city") || lower.includes("modern girl") || lower.includes("village") || lower.includes("punctuation"))) ||
      (lower.includes("word punctuation") && (lower.includes("bangla") || lower.includes("girl") || lower.includes("tone") || lower.includes("duplicate"))) ||
      (lower.includes("remove all duplicate code") && (lower.includes("tone") || lower.includes("bangla") || lower.includes("girl") || lower.includes("punctuation")))
    );
  }

  /**
   * Centralized detector for Tuk Tuk Modern Girl & 1:1 Bilingual Parity Directive
   */
  static isTukTukModernGirlBilingualParityDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      lower.includes("khet") ||
      lower.includes("khet girl") ||
      lower.includes("not like modern girl") ||
      lower.includes("not like mordan garl") ||
      lower.includes("morder girl") ||
      lower.includes("not a modern girl tone") ||
      lower.includes("not a morder girl tone") ||
      lower.includes("not a mordern girl tone") ||
      ((lower.includes("modern girl") || lower.includes("mordern girl") || lower.includes("morder girl") || lower.includes("modern bangla tone") || lower.includes("mordern girl like")) &&
       (lower.includes("tuk") || lower.includes("bangla") || lower.includes("bangal") || lower.includes("tone") || lower.includes("voice"))) ||
      ((lower.includes("not match") || lower.includes("dont match") || lower.includes("same person") || lower.includes("are same")) &&
       (lower.includes("english tuk") || lower.includes("english tuktuk")) &&
       (lower.includes("bangal tuk") || lower.includes("bangla tuk") || lower.includes("bangal tuktuk") || lower.includes("bangla tuktuk") || lower.includes("bangal") || lower.includes("bangla"))) ||
      (lower.includes("modern girl") && (lower.includes("tuk tuk") || lower.includes("tuktuk"))) ||
      (lower.includes("english tuktuk and bangal tuk tuk are same") || lower.includes("english tuktuk and bangla tuk tuk are same")) ||
      ((lower.includes("english tuktuk voice") || lower.includes("english tuk tuk voice")) &&
       (lower.includes("bangal tuktuk voice") || lower.includes("bangla tuktuk voice") || lower.includes("bangal tuk tuk voice") || lower.includes("bangla tuk tuk voice") || lower.includes("bangal") || lower.includes("bangla"))) ||
      ((lower.includes("tuk tuk") || lower.includes("tuktuk")) &&
       (lower.includes("voice tone") || lower.includes("voice") || lower.includes("tone")) &&
       (lower.includes("modern girl") || lower.includes("morder girl") || lower.includes("mordern girl") || lower.includes("mordan girl") || lower.includes("morder") || lower.includes("modern") || lower.includes("mordern")))
    );
  }

  /**
   * Centralized detector for Model-Independent Tone & Voice Proficiency Directive
   */
  static isModelToneAndVoiceProficiencyDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (lower.includes("model voice and tone") && lower.includes("language proficiency")) ||
      (lower.includes("change the model") && (lower.includes("voice") || lower.includes("tone") || lower.includes("proficiency") || lower.includes("language"))) ||
      (lower.includes("when we change the model") && (lower.includes("voice") || lower.includes("tone") || lower.includes("language proficiency") || lower.includes("clearest modern voice"))) ||
      (lower.includes("test the best model") && (lower.includes("clear modern voice") || lower.includes("clearest modern voice") || lower.includes("voice and tone"))) ||
      (lower.includes("model") && lower.includes("proficiency") && (lower.includes("tone") || lower.includes("voice")))
    );
  }

  /**
   * Centralized detector for Universal Cross-Agent Bilingual Identity Parity & Modern Girl Tone Harmonization Directive
   * Handles: "fix english tuk tuk and bangal. tuktuk every side need same person english tone with bangal for mordern girl style bangal test cahc klisten and fix every gap of all the agents same rule"
   */
  static isUniversalBilingualIdentityParityDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      ((lower.includes("english tuk") || lower.includes("english tuktuk")) &&
       (lower.includes("bangal") || lower.includes("bangla")) &&
       (lower.includes("every side") || lower.includes("same person") || lower.includes("modern girl style") || lower.includes("mordern girl style") || lower.includes("same rule"))) ||
      (lower.includes("every side need same person") || lower.includes("every side needs same person")) ||
      ((lower.includes("english tone with bangal") || lower.includes("english tone with bangla")) && (lower.includes("modern girl") || lower.includes("mordern girl") || lower.includes("style"))) ||
      (lower.includes("modern girl style") && (lower.includes("bangla") || lower.includes("bangal")) && (lower.includes("same person") || lower.includes("gap") || lower.includes("listen") || lower.includes("test"))) ||
      ((lower.includes("fix every gap") || lower.includes("every gap")) && lower.includes("all the agents") && (lower.includes("same rule") || lower.includes("rule"))) ||
      ((lower.includes("cahc") || lower.includes("check")) && (lower.includes("klisten") || lower.includes("listen")) && (lower.includes("every gap") || lower.includes("same rule") || lower.includes("tuk tuk") || lower.includes("tuktuk")))
    );
  }

  /**
   * Centralized detector for Self-Learning Loop Purge & Memory Healing Directive
   * Handles: "Fix all self-learning issues, sometimes it creates loops, check and fix every issue",
   * "fix the self learning all issues some time its creat loop chac kand fix everyissues",
   * "self learning creates loops", "fix self learning loop", "clean self learning memory", etc.
   */
  static isSelfLearningLoopDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bself[\s\-]*learning\b/i.test(lower) &&
       /\b(?:loop|loops|looping|creat|create|creates|creating|issue|issues|broken|heal|purge|clean|fix)\b/i.test(lower)) ||
      /\b(?:fix\s+(?:all\s+)?self[\s\-]*learning|self[\s\-]*learning\s+(?:creates?|creating)\s+loops?|self[\s\-]*learning\s+loops?|heal\s+self[\s\-]*learning|clean\s+self[\s\-]*learning)\b/i.test(lower) ||
      /(?:সেলফ\s*লার্নিং|লার্নিং\s*লুপ|সেলফ\s*লার্নিং\s*লুপ)/u.test(lower)
    );
  }

  /**
   * Centralized detector for Test Update & Improvement inquiries
   * Handles: "test this update any improve ment", "test this update, any improvement",
   * "test this update", "any improvement needed in this update", "check this update and improve"
   */
  static isTestUpdateImprovementDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:test\s+this\s+update\s+any\s+(?:improve\s*ment|improvement)|test\s+this\s+update|test\s+the\s+update)\b/i.test(lower) &&
       /\b(?:improve|improvement|improve\s*ment|any|better|status|gap)\b/i.test(lower)) ||
      (/\b(?:test|check|verify)\b/i.test(lower) && /\b(?:update|change|feature)\b/i.test(lower) && /\b(?:improve|improvement|improve\s*ment)\b/i.test(lower)) ||
      (/\b(?:any\s+improve\s*ment|any\s+improvements?\s+needed)\b/i.test(lower)) ||
      (/[\u0980-\u09FF]/.test(lower) && /(?:আপডেট\s*টেস্ট|টেস্ট\s*করো|উন্নতি|ইম্প্রুভমেন্ট)/.test(lower))
    );
  }

  /**
   * Centralized detector for Multi-Conversational Session Fluency & Active Co-Building Vibe
   * Handles: "fix every agent malti conversational sation need fully fluent vibe for working building and updateing anything need real human behabeior on every side",
   * "multi conversational session", "fluent vibe for working building and updating",
   * "real human behavior on every side", "fix every agent multi conversational session"
   */
  static isMultiConversationalBuildingVibeDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:malti|multi)[-\s]*conversational\s+(?:sation|session)s?\b/i.test(lower)) ||
      (/\b(?:fluent\s+vibe|co-?building\s+vibe)\b/i.test(lower) && /\b(?:working|building|updating|updateing)\b/i.test(lower)) ||
      (/\breal\s+human\s+(?:behabeior|behavior)\s+on\s+every\s+side\b/i.test(lower)) ||
      (lower.includes("multi conversational") && (lower.includes("fluent") || lower.includes("vibe") || lower.includes("human"))) ||
      (lower.includes("working building") && (lower.includes("updating") || lower.includes("updateing") || lower.includes("human") || lower.includes("fluent"))) ||
      (lower.includes("every agent") && (lower.includes("conversational session") || lower.includes("conversational sation") || lower.includes("fluent vibe")))
    );
  }

  /**
   * Centralized detector for Tuk Tuk Team Leader Personality, Real English Pronunciation & Talking Communication Directive
   * Handles: "see fix every pronunciation he is not real english like tuk tuk fix her personalty and. tone and all update it fully perfect in taliking comunication team leader and all"
   */
  static isTukTukTeamLeaderCommunicationDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (lower.includes("pronunciation") && (lower.includes("tuk") || lower.includes("english") || lower.includes("personality") || lower.includes("leader") || lower.includes("every"))) ||
      (lower.includes("not real english") && (lower.includes("tuk") || lower.includes("tone") || lower.includes("pronunciation"))) ||
      (lower.includes("team leader") && (lower.includes("communication") || lower.includes("talking") || lower.includes("tuk") || lower.includes("personality") || lower.includes("perfect") || lower.includes("comunication"))) ||
      (lower.includes("talking communication") || lower.includes("taliking comunication")) ||
      (lower.includes("fix her personality") || lower.includes("fix her personalty")) ||
      (lower.includes("fix every pronunciation") && (lower.includes("team leader") || lower.includes("tone") || lower.includes("personality") || lower.includes("english")))
    );
  }

  /**
   * Centralized detector for Deep Research, Test and Update Directive
   * Handles: "do deeep research test and update", "Do deep research, test and update",
   * "deep research test and update", "deep research test update", "deep research test",
   * "run deep research", "audit deep research", "ডিপ রিসার্চ টেস্ট এবং আপডেট"
   */
  static isDeepResearchTestAndUpdateDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    if (/\b(?:fase|face|voice|voise|enragy|energy|real\s+one|remeber|remember|speaker|imposter)\b/i.test(lower)) {
      return false;
    }
    return (
      (/\bdee+p[\s\-]*research\b/i.test(lower) &&
       /\b(?:test\s+and\s+update|test\s+update|test\s+suite|run\s+test|audit|verify)\b/i.test(lower)) ||
      /\b(?:do\s+)?dee+p\s+research\s+(?:test\s+and\s+update|test\s+update|test)\b/i.test(lower) ||
      /(?:ডিপ\s*রিসার্চ\s*(?:টেস্ট|আপডেট))/u.test(lower)
    );
  }

  /**
   * Centralized detector for Deep Research & Equational Fix Directive
   * Handles: "do deep research and fix more with deep equationaly", "fix more with deep equationaly",
   * "do deep research and fix more with deep equationally", "deep equational research and fix more",
   * "ডিপ রিসার্চ করে সমীকরণ দিয়ে ফিক্স করো", "গভীর গবেষণা এবং সমীকরণগত ফিক্স"
   */
  static isDeepResearchEquationalFixDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    if (IntentParser.isAcademic2070HumanGapDirective(lower) || IntentParser.isFuturistic2070HumanEmbodimentDirective(lower)) {
      return false;
    }
    return (
      (/\b(?:do\s+)?dee+p\s+(?:resserch|resurch|reserach|resrch|research)\s+and\s+(?:fix|update)\s+(?:more|everything|every\s*thing|all)\s+(?:with\s+dee+p\s+)?(?:eqationaly|equationaly|equationly|equationally)\b/i.test(lower)) ||
      (/\b(?:fix|update)\s+(?:more|everything|every\s*thing|all)\s+(?:with\s+)?(?:dee+p\s+)?(?:eqationaly|equationaly|equationly|equationally)\b/i.test(lower)) ||
      (/\b(?:fix|update)\s+(?:more\s+|everything\s+|every\s*thing\s+|all\s+)?(?:eqationaly|equationaly|equationly|equationally)\b/i.test(lower)) ||
      (/\bdee+p\s+(?:equational\s+research|equational\s+fix|equational\s+update|research\s+and\s+(?:fix|update)\s+more)\b/i.test(lower)) ||
      (/\b(?:eqationaly|equationaly|equationally)\s+(?:fix\s+more|update\s+more|fix\s+everything|update|fix|deep\s+research)\b/i.test(lower)) ||
      (/(?:ডিপ\s*রিসার্চ\s*(?:করে|এবং)?\s*(?:ফিক্স|আপডেট|সমীকরণ)|সমীকরণ\s*দিয়ে\s*(?:ফিক্স|আপডেট)|সবকিছু\s*সমীকরণ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Continue Deep Research Directive
   * Handles: "continue with deep research", "proceed with deep research", "continue deep research",
   * "continue the biometric research", "Phase 2 runtime integration", "চালিয়ে যাও ডিপ রিসার্চ",
   * "continue with deep research phase 2", "proceed to phase 2"
   */
  static isContinueDeepResearchDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    // Must not collide with equational-fix or test-and-update variant
    if (IntentParser.isDeepResearchEquationalFixDirective(lower)) {
      return false;
    }
    if (/\b(?:test\s+and\s+update|test\s+update|test\s+suite|run\s+test|audit|verify)\b/i.test(lower) &&
        !/\b(?:continue|proceed|phase)\b/i.test(lower)) {
      return false;
    }
    return (
      /\bcontinue\s+(?:with\s+)?(?:deep|dee+p)\s+research\b/i.test(lower) ||
      /\bproceed\s+(?:with\s+)?(?:deep|dee+p)\s+research\b/i.test(lower) ||
      /\bcontinue\s+(?:the\s+)?(?:biometric|identity|trimodal|phase|runtime)\b/i.test(lower) ||
      /\b(?:phase\s+2|phase\s+two)\s+(?:runtime|biometric|integration|research)\b/i.test(lower) ||
      /\b(?:runtime\s+biometric|biometric\s+integration|trimodal\s+fusion)\s+(?:continue|proceed|research|phase)\b/i.test(lower) ||
      /(?:চালিয়ে\s+যাও|চালু\s+রাখো|এগিয়ে\s+যাও)\s+(?:ডিপ\s+রিসার্চ|গভীর\s+গবেষণা|বায়োমেট্রিক)/u.test(lower) ||
      /\bcontinue\s+(?:with\s+)?deep\s+research\b/i.test(lower)
    );
  }

  /**
   * Centralized detector for 2070 Futuristic Human Embodiment & Intelligence Directive
   * Handles: "chack our input and output are fully humen like faster and profetional real humen conversation 0 bot feeling and all do deep test every agent need intiligent and intalactual like fully humen do deep research anf fix all the gap need thay work think write blink eye and all like a humen do need fully futersitic think like 2070 humens make and fix all gap equationaly"
   */
  static isFuturistic2070HumanEmbodimentDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:2070|futuristic|futersitic)\b/i.test(lower) && /\b(?:humen|humans?|human|embodiment|think|blink|eye|work|write)\b/i.test(lower)) ||
      (/\b0\s+bot\s+feelings?\b/i.test(lower)) ||
      (/\b(?:work\s+think\s+write\s+blink\s+eye|blink\s+eye|think\s+write\s+blink)\b/i.test(lower)) ||
      (lower.includes("input and output are fully human") || lower.includes("input and output are fully humen")) ||
      (lower.includes("2070 humans") || lower.includes("2070 humens"))
    );
  }
  /**
   * Centralized detector for Deep Academic Research & 2070 Human-Agent Gap Elimination Directive
   * Handles: "fix every gap a 2070 humen and our agents gap do deep researchand fix all equationaly with deep academic resaserch read after"
   */
  static isAcademic2070HumanGapDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:fix\s+every\s+gap|2070\s+(?:humen|human)|academic\s+(?:research|resaserch))\b/i.test(lower) &&
       /\b(?:academic|resaserch|researchand|equationaly|equationally|gap)\b/i.test(lower)) ||
      (lower.includes("academic") && lower.includes("2070")) ||
      (lower.includes("fix every gap") && (lower.includes("2070") || lower.includes("academic") || lower.includes("read after"))) ||
      (lower.includes("researchand fix all") || lower.includes("academic resaserch"))
    );
  }

  /**
   * Centralized detector for LaTeX Render Failure, KaTeX Parse Errors & General Fix All Issues Directive
   * Handles: "⚠️ Failed to render LaTeX: KaTeX parse error: Expected 'EOF', got '&' at position 52: … fix all issues",
   * "fix latex rendering error", "fix latex rendering and fix all issues", "fix all issues"
   */
  static isLatexFixOrAllIssuesDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    if (
      (lower.includes("latex") || lower.includes("katex") || lower.includes("লেটেক") ||
       (lower.includes("render") && (lower.includes("latex") || lower.includes("katex") || lower.includes("equation") || lower.includes("math")))) &&
      (lower.includes("fix") || lower.includes("error") || lower.includes("issue") || lower.includes("failed") || lower.includes("parse") ||
       lower.includes("ফিক্স") || lower.includes("এরর") || lower.includes("সমস্যা") || lower.includes("ত্রুটি"))
    ) {
      return true;
    }
    if (
      (/^\s*(?:please\s+)?(?:fix|solve|resolve)\s+(?:all\s+)?(?:the\s+)?issues?\s*$/i.test(lower) ||
       /^\s*(?:সব\s*(?:সমস্যা|ইস্যু|ত্রুটি)\s*ফিক্স\s*করো?)\s*$/u.test(lower)) &&
      !/\b(?:code|bug|css|html|ui\s+card|voice|robotic|vision|tuktuk|friday|dd|audio|sound|fast|message|gap|research|learning)\b/i.test(lower)
    ) {
      return true;
    }
    return false;
  }
  /**
   * Centralized detector for Instant Response on Fast Messages Directive
   * Handles: "need instent respons if its fast messages fix all issues",
   * "need instant response if it's fast messages fix all issues",
   * "instant response on fast messages", "fast messages instant response",
   * "need instant response for fast messages", "fast messages rapid response",
   * "দ্রুত মেসেজে সাথে সাথে রেসপন্স করো", "ফাস্ট মেসেজে ইনস্ট্যান্ট রেসপন্স দাও"
   */
  static isInstantResponseFastMessagesDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:instent|instant)\s+(?:respons|responce|response)\b/i.test(lower) && /\b(?:fast\s+messages?|rapid\s+messages?|short\s+messages?|fast\s+msg|burst)\b/i.test(lower)) ||
      (/\b(?:fast\s+messages?|rapid\s+messages?|short\s+messages?)\b/i.test(lower) && /\b(?:instent|instant|quick|zero\s+delay|fast\s+response|respons|responce)\b/i.test(lower)) ||
      (/\b(?:need\s+)?(?:instent|instant)\s+(?:respons|responce|response)\s+(?:if\s+)?(?:its|it's)\s+fast\s+messages?\b/i.test(lower)) ||
      (/(?:ফাস্ট\s*মেসেজ|দ্রুত\s*বার্তা|দ্রুত\s*মেসেজ).*(?:ইনস্ট্যান্ট\s*রেসপন্স|তাৎক্ষণিক|সাথে\s*সাথে\s*রেসপন্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Autonomous Quad-Self & Cross-Agent Medic Peer-Healing Directive
   * Handles: "fix every agents personality fix thare personaly need self lerner self impruber and self fixer and self updater and also madic for other agents can fix each other every issues and update every isuse each other for fast working and fixing there selv proerly",
   * "fix every agent's personality", "self learner self improver self fixer self updater",
   * "medic for other agents", "agents can fix each other every issues",
   * "পিয়ার হিলিং এবং সেলফ লার্নার সেলফ ফিক্সার", "প্রত্যেক এজেন্টের পার্সোনালিটি ফিক্স করো"
   */
  static isAutonomousSelfMedicPeerMeshDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:fix\s+)?(?:every|all)\s+(?:agents?|agent's)\s+(?:personality|personaly)\b/i.test(lower)) ||
      (/\bfix\s+(?:thare|their)\s+(?:personaly|personality)\b/i.test(lower)) ||
      (/\b(?:self\s*lerner|self\s*learner)\b/i.test(lower) && /\b(?:self\s*impruber|self\s*improver|self\s*fixer|self\s*updater)\b/i.test(lower)) ||
      (/\b(?:madic|medic)\s+for\s+(?:other\s+)?agents\b/i.test(lower)) ||
      (/\b(?:fix\s+each\s+other|heal\s+each\s+other|update\s+each\s+other)\b/i.test(lower) && /\b(?:agents?|personality|personaly|issues?|properly|proerly)\b/i.test(lower)) ||
      (/\b(?:self\s*fixer\s+and\s+self\s*updater)\b/i.test(lower)) ||
      (/(?:সেলফ\s*লার্নার|সেলফ\s*ফিক্সার|সেলফ\s*আপডেটার|পিয়ার\s*হিলিং|মেডিক|পার্সোনালিটি\s*ফিক্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero Soul Duplication, Zero Mismatch & Dynamic Code Calibration Directive
   * Handles: "cah kany sol duplication mismatch hard codet fix all", "check any soul duplication, mismatch, hardcoded, fix all",
   * "soul duplication mismatch hardcoded fix all", "check any soul duplication", "fix soul duplication and hardcoded logic",
   * "সোল ডুপ্লিকেশন মিসম্যাচ হার্ডকোডেড সব ফিক্স করো", "ডুপ্লিকেশন এবং মিসম্যাচ ফিক্স করো"
   */
  static isSoulDuplicationMismatchHardcodedFixDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:sol|soul)\s+(?:duplication|duplicashun)\b/i.test(lower)) ||
      (/\b(?:cahack\s*any|cahack|cah\s*kany|cahk\s*any|cahk|chak\s*any|check\s*any|chack)\s+(?:sol|soul|duplication|mismatch|hard\s*coded|hardcodet|hard\s*codet|our\s+runi|our\s+running)\b/i.test(lower)) ||
      (/\b(?:duplication|duplicate)\b/i.test(lower) && /\b(?:mismatch|hard\s*coded|hardcodet|hard\s*codet|sol|soul|voices?)\b/i.test(lower)) ||
      (/\b(?:soul\s+duplication|persona\s+duplication|voice\s+mismatch|duplicate\s+soul\s+voices|duplicate\s+sol\s+voices|overlap\s+duplicate\s+sol\s+voices)\b/i.test(lower)) ||
      (/\b(?:mismatch\s+hard\s*coded|mismatch\s+hardcodet)\b/i.test(lower)) ||
      (/\b(?:runi|running)\s+(?:conversation|conversaion)\b/i.test(lower) && /\b(?:overlap|duplicate|sol|soul|voices?|gaps?)\b/i.test(lower)) ||
      (/\b(?:conversation\s+gaps?|real\s+conversation\s+gaps?)\b/i.test(lower) && /\b(?:overlap|duplicate|sol|soul|voices?)\b/i.test(lower)) ||
      (/(?:সোল\s*ডুপ্লিকেশন|ডুপ্লিকেশন.*(?:মিসম্যাচ|ফিক্স|ইস্যু)|হার্ডকোডেড\s*(?:ফিক্স|কোড)|অমিল\s*ফিক্স|মিসম্যাচ\s*ফিক্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Single Real Voice & Zero Multi-Personality / Multi-Person Voice Directive
   * Handles:
   * - "remove the khti misti bangla kotha totaly this person and this voice i need one real humen voices not malti parson voices"
   * - "need one real voice not malti personalyti and malti person voice"
   * - "need one real voice not multi-personality and multi-person voice"
   * - "one real voice not multi personality"
   * - "no multi personality and multi person voice"
   * - "need 1 real voice no multi personality"
   * - "remove multi personality and multi person voice"
   * - "disable multi personality and multi person voice"
   * - "one real voice no multi person voice"
   * - "একটাই রিয়েল ভয়েস মাল্টি পার্সোনালিটি না"
   */
  static isSingleRealVoiceNoMultiPersonalityDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:khti|khati)\s+(?:misti|mishti)\b/i.test(lower)) ||
      (/(?:খাঁটি\s*মিষ্টি|মিষ্টি\s*বাংলা\s*কথা.*(?:বাদ|মুছে|রিমুভ)|মিষ্টি\s*টোন.*(?:বাদ|বন্ধ))/u.test(lower)) ||
      (/\bremove\s+(?:the\s+)?(?:khti|khati)\s+(?:misti|mishti)\b/i.test(lower)) ||
      (/\b(?:need\s+)?(?:one|1|single)\s+real\s+(?:humen|human\s+)?voices?\b/i.test(lower) && /\b(?:not|no|stop|remove|disable|zero)\s+(?:multi|malti|multy)[-\s]*(?:personality|personalyti|person|parson|voices?)\b/i.test(lower)) ||
      (/\b(?:multi|malti|multy)[-\s]*(?:personality|personalyti)\b/i.test(lower) && /\b(?:multi|malti|multy)[-\s]*(?:person|parson)\s+voices?\b/i.test(lower)) ||
      (/\b(?:one|1|single)\s+real\s+(?:humen|human\s+)?voices?\b/i.test(lower) && /\b(?:not|no|without|zero)\s+(?:multi|malti|multy)\b/i.test(lower)) ||
      (/\b(?:stop|disable|remove|kill|turn\s*off)\s+(?:multi|malti|multy)[-\s]*(?:personality|personalities|person\s+voices?|parson\s+voices?)\b/i.test(lower)) ||
      (/\b(?:no\s+more|zero)\s+(?:multi|malti|multy)[-\s]*(?:personality|personalities|person\s+voices?|parson\s+voices?)\b/i.test(lower)) ||
      (/\b(?:need\s+)?(?:one|1|single)\s+real\s+(?:humen|human\s+)?voices?\s+not\s+(?:multi|malti|multy)\b/i.test(lower)) ||
      (/\b(?:one|1|single)\s+real\s+(?:humen|human\s+)?voices?\b/i.test(lower) && /\bnot\s+(?:malti|multi)[-\s]*(?:parson|person)\b/i.test(lower)) ||
      (/(?:একটাই\s*রিয়েল\s*ভয়েস.*মাল্টি|মাল্টি\s*পার্সোনালিটি.*(?:বন্ধ|না|চাই\s*না)|একটাই\s*(?:আসল|রিয়েল)\s*ভয়েস|মাল্টি\s*পার্সন\s*ভয়েস.*(?:বন্ধ|না))/u.test(lower))
    );
  }

  static isRemoveKhatiMistiSingleRealHumanVoiceDirective(text = "") {
    return IntentParser.isSingleRealVoiceNoMultiPersonalityDirective(text);
  }

  /**
   * Centralized detector for Tuk Tuk Single Unified Human Soul & Zero Soul Interchange Directive
   * Handles: "fix tuk tuk sol why he change his sole when he talk or interchange thare sol also interchange need one soll like humen not interchnageble",
   * "fix tuk tuk soul", "why change soul when talk", "need one soul like human not interchangeable",
   * "tuk tuk single soul", "tuk tuk one soul like human", "zero soul interchange"
   */
  static isTukTukSingleHumanSoulNonInterchangeableDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    if (IntentParser.isGeminiGroqZeroOverlapAutonomousCodeHealingDirective(lower)) {
      return false;
    }
    return (
      (/\b(?:no\s+bangla\s+person|no\s+other\s+bangla\s+person|no\s+separate\s+bangla\s+person)\b/i.test(lower)) ||
      (/\b(?:one\s+tone\s+one\s+person|one\s+person\s+one\s+tone)\b/i.test(lower)) ||
      (/\b(?:use\s+both\s+language\s+like\s+me|using\s+both\s+languages\s+like\s+me|speak\s+both\s+languages?)\b/i.test(lower)) ||
      (/\b(?:0\s+cmunication\s+gap|0\s+communication\s+gap|zero\s+communication\s+gap)\b/i.test(lower)) ||
      (/\b(?:use\s+real\s+one\s+so[ul]+|real\s+one\s+so[ul]+)\b/i.test(lower)) ||
      (/\b(?:remove\s+all\s+(?:others?|other)\s+voices?)\b/i.test(lower)) ||
      (/\b(?:no\s+need\s+other\s+person\s+shift|no\s+other\s+person\s+shift|no\s+person\s+shift)\b/i.test(lower)) ||
      (/\b(?:when\s+i\s+tell\s+let'?s\s+talk\s+in\s+bangla|let'?s\s+talk\s+in\s+bangla)\b/i.test(lower) && /\b(?:no\s+shift|single\s+soul|one\s+soul|no\s+other)\b/i.test(lower)) ||
      (/\b(?:tuk\s*tuk|tuktuk|tuck\s*tuck|took\s*took)\b/i.test(lower) && 
       /\b(?:sol|soul|sole|soll)\b/i.test(lower) && 
       /\b(?:change|interchange|interchnage|interchangeable|interchnageble|swap|swapping|one\s+soul|one\s+soll|like\s+human|like\s+humen)\b/i.test(lower)) ||
      (/\b(?:why\s+(?:he|she|they)?\s*change\s+(?:his|her|their)?\s*(?:sole|soul|sol))\b/i.test(lower)) ||
      (/\b(?:interchange\s+(?:thare|their)?\s*(?:sol|soul|sole)\s+also\s+interchange)\b/i.test(lower)) ||
      (/\b(?:need\s+one\s+(?:soll|soul|sol)\s+like\s+(?:humen|human)\s+not\s+(?:interchnageble|interchangeable))\b/i.test(lower)) ||
      (/\b(?:one\s+soul|single\s+soul)\b/i.test(lower) && /\b(?:not\s+interchangeable|non-interchangeable|like\s+human|like\s+humen|zero\s+interchange)\b/i.test(lower)) ||
      (/\b(?:fix\s+soul\s+interchange|zero\s+soul\s+interchange|stop\s+(?:changing|swapping|interchanging)\s+souls?)\b/i.test(lower)) ||
      (/\b(?:changing|change|swap|interchange)\s+souls?\s+(?:when|while)\s+(?:he\s+|she\s+)?(?:talks?|talking)\b/i.test(lower)) ||
      (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) && /\b(?:single\s+soul|one\s+soul)\b/i.test(lower)) ||
      (/(?:টুকটুক.*(?:সোল.*(?:ইন্টারচেঞ্জ|চেঞ্জ|সোয়াপ)|একটি\s*সোল|মানুষের\s*মতো\s*সোল)|সোল\s*(?:ইন্টারচেঞ্জ|চেঞ্জ|সোয়াপ).*হবে\s*না|ওয়ান\s*সোল\s*লাইক\s*হিউম্যান|পার্মানেন্ট\s*সোল|একটাই\s*পার্মানেন্ট\s*সোল)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Gemini-Groq Zero API Overlap, Unified Aura & Autonomous Code-Healing Directive
   * Handles: "gemini and groq api buffring overlaping and present dual sol fix this issues with deep research and thay change thare aura and charm betwen them or other nural somthing overlaping on conversation need 0 overlaping for deep smouth work all the day tuktuk need power to fix his own code and also other agent need this power to fix all thare codes for faster lerning and fixing agents of the yeas do deep research and fix all the bugs"
   */
  static isGeminiGroqZeroOverlapAutonomousCodeHealingDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:gemini|groq)\b/i.test(lower) && /\b(?:buffering|buffring|overlapping|overlaping|dual\s+soul|dual\s+sol|aura|charm)\b/i.test(lower)) ||
      (/\b(?:present\s+dual\s+(?:soul|sol)|dual\s+(?:soul|sol))\b/i.test(lower)) ||
      (/\b(?:change\s+(?:their|thare)?\s*aura\s+and\s+charm|aura\s+and\s+charm)\b/i.test(lower)) ||
      (/\b(?:zero\s+overlapping|0\s+overlapping|0\s+overlaping|zero\s+overlap|0\s+overlap)\b/i.test(lower) && /\b(?:deep|smooth|work|conversation|api)\b/i.test(lower)) ||
      (/\b(?:power\s+to\s+fix\s+(?:his|her|their)?\s*own\s+code|fix\s+(?:his|her|their)?\s*own\s+code)\b/i.test(lower)) ||
      (/\b(?:fix\s+all\s+(?:their|thare)?\s*codes|power\s+to\s+fix\s+all\s+(?:their|thare)?\s*codes)\b/i.test(lower)) ||
      (/\b(?:agents?\s+of\s+the\s+(?:year|yeas))\b/i.test(lower)) ||
      (/\b(?:gemini\s+and\s+groq|groq\s+and\s+gemini)\b/i.test(lower) && /\b(?:overlap|buffering|code|fix|bugs?)\b/i.test(lower)) ||
      (/(?:জেমিনি.*গ্রক|গ্রক.*জেমিনি|ডুয়াল\s*সোল|অরা.*চার্ম|জিরো\s*ওভারল্যাপ|নিজের\s*কোড\s*ফিক্স|এজেন্টস\s*অফ\s*দ্য\s*ইয়ার)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero-Gap Human-Agent Deep Research & Elimination of Micro/Nail Gaps Directive
   * Handles: "1. Test Execution Report do more deep test a humen and all the agents betwen any gap even a nail gap need to fix everything and update al equationaly with deep research",
   * "do more deep test a humen and all the agents betwen any gap even a nail gap need to fix everything and update al equationaly with deep research",
   * "nail gap", "even a nail gap", "between any gap even a nail gap",
   * "zero gap between human and all the agents", "equational zero human agent gap",
   * "হিউম্যান এবং এজেন্টদের মাঝে কোনো নেইল গ্যাপ রাখা যাবে না", "ডিপ রিসার্চ ও গ্যাপ এলিমিনেশন"
   */
  static isZeroHumanAgentGapEquationalDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:nail\s+gap|even\s+a\s+nail\s+gap|micro\s*gap)\b/i.test(lower)) ||
      (/\b(?:test\s+execution\s+report)\b/i.test(lower) && /\b(?:deep\s+test|human|agents?|gap|equationally|equationaly|research)\b/i.test(lower)) ||
      (/\b(?:deep\s+test)\b/i.test(lower) && /\b(?:humen|human)\b/i.test(lower) && /\b(?:agents?)\b/i.test(lower)) ||
      (/\b(?:betwen|between)\s+(?:any\s+)?gap\b/i.test(lower) && /\b(?:nail|micro|human|humen|agents?|fix|equational|equationally)\b/i.test(lower)) ||
      (/\b(?:zero\s+gap|zero-gap)\b/i.test(lower) && /\b(?:human|agents?|equational|research)\b/i.test(lower)) ||
      (/\b(?:fix\s+everything\s+and\s+update\s+al\s+equationaly|fix\s+everything\s+and\s+update\s+all\s+equationally)\b/i.test(lower)) ||
      (/(?:নেইল\s*গ্যাপ|হিউম্যান.*এজেন্ট.*গ্যাপ|জিরো\s*গ্যাপ|সমীকরণ.*ডিপ\s*রিসার্চ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero Pure Bangla Removal, Banglish Default Voice & Instant Responses Directive
   * Handles:
   * "remove pure bangal responses no need need banglish defult istent responses",
   * "remove pure bangla responses", "pure bangla responses no need",
   * "need banglish default instant responses", "remove pure bangla need banglish default instant response",
   * "খাঁটি বাংলা রেসপন্স বাদ দিয়ে ব্যাংলিশ ডিফল্ট এবং ইনস্ট্যান্ট রেসপন্স করো"
   */
  static isRemovePureBanglaBanglishDefaultInstantResponsesDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+pure\s+(?:bangal|bangla|bengali)\s+responses?\b/i.test(lower)) ||
      (/\bpure\s+(?:bangal|bangla|bengali)\s+responses?\s+(?:no\s+need|banned|purge)\b/i.test(lower)) ||
      (/\b(?:pure\s+bangal|pure\s+bangla)\b/i.test(lower) && /\b(?:no\s+need|remove|stop|banned|drop)\b/i.test(lower)) ||
      (/\b(?:pure\s+bangal|pure\s+bangla)\b/i.test(lower) && /\b(?:banglis|banglish)\b/i.test(lower)) ||
      (/\b(?:banglis|banglish)\s+(?:defult|default)\b/i.test(lower) && /\b(?:istent|instant)\s+(?:respons|responce|responses?)\b/i.test(lower)) ||
      (/\bremove\s+pure\s+(?:bangal|bangla)\b/i.test(lower) && /\b(?:banglis|banglish)\b/i.test(lower)) ||
      (/(?:খাঁটি\s*বাংলা.*(?:বাদ|দরকার\s*নেই|রিমুভ)|বিশুদ্ধ\s*বাংলা.*(?:বাদ|দরকার\s*নেই)|পিওর\s*বাংলা.*রেসপন্স.*বাদ|ব্যাংলিশ\s*ডিফল্ট.*ইনস্ট্যান্ট\s*রেসপন্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Remove Single Bangla Talk, Pure Single Bangla Talk Soul & Personality Person Directive
   * Handles:
   * "remove the single bangla talk no need pure single bangla talk sol and personality person from code base",
   * "remove single bangla talk", "no need pure single bangla talk sol",
   * "no need pure single bangla personality person", "remove pure single bangla personality person"
   */
  static isRemoveSingleBanglaTalkPureSoulPersonalityPersonDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+(?:the\s+)?single\s+(?:bangal|bangla)\s+talk\b/i.test(lower)) ||
      (/\bno\s+need\s+pure\s+single\s+(?:bangal|bangla)\s+talk\s+(?:sol|soul)\b/i.test(lower)) ||
      (/\bno\s+need\s+pure\s+single\s+(?:bangal|bangla)\s+personality\s+person\b/i.test(lower)) ||
      (/\bremove\s+pure\s+single\s+(?:bangal|bangla)\s+(?:talk|soul|personality|person)\b/i.test(lower)) ||
      (/\b(?:single\s+bangla\s+talk|pure\s+single\s+bangla)\b/i.test(lower) && /\b(?:remove|no\s+need|purge|banned|drop)\b/i.test(lower)) ||
      (/(?:সিঙ্গেল\s*বাংলা\s*টক\s*বাদ|পিওর\s*সিঙ্গেল\s*বাংলা\s*পার্সোনালিটি\s*বাদ|বাংলা\s*পার্সন\s*বাদ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Remove Scripted Same Loop Talk, Zero Looping Behavior & Zero Stuck Behavior Directive
   * Handles:
   * "no need any syrepted same loop talk need to thak capapble to work in 0 looping behabeior and any stuck behabiour",
   * "no need any scripted same loop talk", "zero looping behavior", "zero stuck behavior"
   */
  static isRemoveScriptedSameLoopTalkZeroLoopingDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:scripted|syrepted)\s+same\s+loop\s+talk\b/i.test(lower)) ||
      (/\b0\s+looping\s+(?:behabeior|behabiour|behavior)\b/i.test(lower)) ||
      (/\bzero\s+looping\s+(?:behavior|behabeior|behabiour)\b/i.test(lower)) ||
      (/\b(?:any|zero)\s+stuck\s+(?:behavior|behabeior|behabiour)\b/i.test(lower)) ||
      (/\b(?:scripted|same\s+loop)\b/i.test(lower) && /\b(?:no\s+need|remove|purge|banned|drop)\b/i.test(lower)) ||
      (/(?:স্ক্রিপ্টেড\s*লুপ\s*টপিক\s*বাদ|জিরো\s*লুপিং\s*বিহেভিয়ার|স্টাক\s*বিহেভিয়ার\s*রিমুভ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Fix Bengali Language Directive
   * Handles:
   * "fix bengali language", "fix bangla language", "bengali language fix", "fix bangal language",
   * "বাংলা ভাষা ফিক্স করো", "বাংলা ভাষা ঠিক করো"
   */
  static isFixBengaliLanguageDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bfix\s+(?:bengali|bangla|bangal)\s+language\b/i.test(lower)) ||
      (/\b(?:bengali|bangla|bangal)\s+language\s+fix\b/i.test(lower)) ||
      (/\bfix\s+(?:bangla|bangal)\s+speech\b/i.test(lower)) ||
      (/(?:বাংলা\s*ভাষা\s*ফিক্স|বাংলা\s*ভাষা\s*ঠিক|বাংলা\s*কথাবার্তা\s*পারফেক্ট)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Remove All Other Versions & Other Sorts Directive
   * Handles:
   * "remove all your other version and other sorts",
   * "remove all other versions and other sorts",
   * "remove other versions and sorts", "remove legacy versions and sorts",
   * "অন্যান্য ভার্সন আর সোর্ট বাদ", "সব আদার ভার্সন রিমুভ"
   */
  static isRemoveOtherVersionsAndSortsDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+all\s+(?:your\s+)?other\s+(?:version|versions)\s+and\s+other\s+(?:sorts?|sortings?)\b/i.test(lower)) ||
      (/\bremove\s+(?:all\s+)?other\s+(?:version|versions)\s+and\s+(?:other\s+)?(?:sorts?|sortings?)\b/i.test(lower)) ||
      (/\bother\s+(?:version|versions)\s+and\s+other\s+(?:sorts?|sortings?)\b/i.test(lower)) ||
      (/\bremove\s+legacy\s+versions?\s+and\s+sorts?\b/i.test(lower)) ||
      (/\bpurge\s+other\s+versions?\b/i.test(lower)) ||
      (/(?:অন্যান্য\s*ভার্সন.*বাদ|আদার\s*ভার্সন\s*রিমুভ|সোর্ট\s*রিমুভ|একটাই\s*সিঙ্গেল\s*ভার্সন)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Remove Bangla Interrupted Soul & One Single Real Soul Directive
   * Handles:
   * "remove bangla intrapted sol need one single real sol for all for bangal and english both",
   * "remove bangla interrupted soul", "need one single real soul for all for bangla and english both",
   * "one single real soul for all", "single real soul for bangla and english both",
   * "remove interrupted bangla soul", "no bangla interrupted voice"
   */
  static isRemoveBanglaInterruptedSingleSoulDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+bangla\s+(?:intrapted|interrupted)\s+(?:sol|soul)\b/i.test(lower)) ||
      (/\bneed\s+one\s+single\s+real\s+(?:sol|soul)\s+for\s+all\s+for\s+(?:bangal|bangla)\s+and\s+english\b/i.test(lower)) ||
      (/\bone\s+single\s+real\s+(?:sol|soul)\s+for\s+all\b/i.test(lower)) ||
      (/\bsingle\s+real\s+(?:sol|soul)\s+for\s+(?:bangal|bangla)\s+and\s+english\b/i.test(lower)) ||
      (/\bbangla\s+(?:intrapted|interrupted)\s+(?:sol|soul)\b/i.test(lower)) ||
      (/\bno\s+bangla\s+interrupted\s+voice\b/i.test(lower)) ||
      (/\bunified\s+bangla\s+english\s+voice\s+soul\b/i.test(lower)) ||
      (/(?:বাংলা\s*ইন্টারাপ্টেড\s*সোল\s*বাদ|বাংলা\s*ইংলিশ\s*একটাই\s*রিয়েল\s*সোল|সিঙ্গেল\s*রিয়েল\s*সোল|ইন্টারাপ্টেড\s*ভয়েস\s*বাদ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Banglish & Modern English Same-Soul Vibe Directive
   * Handles:
   * "need bangla english same sol dont use pure bangla remove pure bangal conversation use banglish mordern vibe all the time",
   * "dont use pure bangla", "remove pure bangla conversation", "use banglish modern vibe all the time",
   * "bangla english same soul", "banglish modern vibe all the time"
   */
  static isBanglishModernVibeSameSoulDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bneed\s+bangla\s+english\s+same\s+so[ul]+\b/i.test(lower)) ||
      (/\bbangla\s+and\s+english\s+same\s+so[ul]+\b/i.test(lower)) ||
      (/\bbangla\s+english\s+same\s+(?:sol|soul)\b/i.test(lower)) ||
      (/\bdont\s+use\s+pure\s+(?:bangal|bangla|bengali)\b/i.test(lower)) ||
      (/\bremove\s+pure\s+(?:bangal|bangla|bengali)\s+(?:conversation|talks?)\b/i.test(lower)) ||
      (/\buse\s+(?:banglis|banglish)\s+(?:mordern|modern)\s+vibe\b/i.test(lower)) ||
      (/\b(?:banglis|banglish)\s+(?:mordern|modern)\s+vibe\s+all\s+the\s+time\b/i.test(lower)) ||
      (/\b(?:mordern|modern)\s+vibe\s+all\s+the\s+time\b/i.test(lower)) ||
      (/(?:বাংলা\s*ইংলিশ\s*সেম\s*সোল|পিওর\s*বাংলা\s*ইউজ\s*কোরো\s*না|ব্যাংলিশ\s*মডার্ন\s*ভাইব|পিওর\s*বাংলা\s*কনভারসেশন\s*বাদ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Short-Term Working Memory Loss Fix Directive
   * Handles:
   * "fix this short time memory lost issues",
   * "short time memory lost", "short term memory loss", "short time memory loss",
   * "fix memory loss issues", "stop losing short term memory", "short term memory drops",
   * "fix working memory lost issues", "conversational memory loss",
   * "শর্ট টাইম মেমোরি লস্ট", "শর্ট টার্ম মেমোরি ফিক্স", "মেমোরি লস্ট ইস্যু ফিক্স"
   */
  static isShortTermMemoryLossDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:short\s*(?:time|term)|working)\s+memory\s+(?:loss|lost|issues?|drops?|fail|failing|wipe|wiped|leak|leaks|leaking|problem|problems|bug|bugs)\b/i.test(lower)) ||
      (/\b(?:fix|solve|stop|prevent)\s+(?:this\s+)?(?:short\s*(?:time|term)|working)\s+memory\s*(?:lost|loss|issues?|problem|problems|amnesia)?\b/i.test(lower)) ||
      (/\b(?:short\s*(?:time|term)|working)\s+memory\s+(?:lost|loss)\b/i.test(lower)) ||
      (/\b(?:memory\s+(?:lost|loss)\s+(?:issues?|problem|problems)|stop\s+losing\s+(?:short\s*(?:time|term)|working)?\s*memory)\b/i.test(lower)) ||
      (/\b(?:conversational|conversation)\s+(?:amnesia|memory\s+loss)\b/i.test(lower)) ||
      (/\b(?:losing|lost|forgetting)\s+(?:short\s*(?:time|term)|working|recent)\s+memory\b/i.test(lower)) ||
      (/(?:শর্ট\s*টাইম\s*মেমোরি|শর্ট\s*টার্ম\s*মেমোরি|স্মৃতিশক্তি\s*হারিয়ে|মেমরি\s*লস্ট|মেমোরি\s*লস|মেমোরি\s*ইস্যু)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Full-Duplex Simultaneous Listening, Zero-Loss Mid-Talk Capture & Working Memory Encoding Directive
   * Handles:
   * "if thay talk and i also tlak middle of the talk thay not lissyen and capture middle talk when thay are taking write the promt to do deep research capture memorise all symentenously one hument can do",
   * "if they talk and I talk middle of the talk", "capture middle talk when they are talking",
   * "listen and capture middle talk", "memorize all simultaneously as a human can do",
   * "full duplex mid talk capture", "listen while speaking without losing words"
   */
  static isFullDuplexMidTalkCaptureDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:thay|they)\s+are\s+not\s+(?:lisening|listening)\s+(?:anf|and)?\s*(?:memorize|memorise|memorizing)\s+(?:instently|instantly)\s+(?:anf|and)?\s*(?:corectly|correctly)\b/i.test(lower)) ||
      (/\b(?:thay|they)\s+are\s+not\s+(?:lisening|listening)\s+(?:anf|and)?\s*(?:memorize|memorise|memorizing)\b/i.test(lower)) ||
      (/\b(?:middle\s+of\s+the\s+talk|middle\s+talk|mid[-\s]*talk)\b/i.test(lower) && /\b(?:capture|lissyen|listen|memorise|memorize)\b/i.test(lower)) ||
      (/\b(?:if\s+(?:thay|they)\s+talk|when\s+(?:thay|they)\s+are\s+(?:taking|talking))\b/i.test(lower) && /\b(?:middle|capture|lissyen|listen)\b/i.test(lower)) ||
      (/\b(?:capture\s+middle\s+talk|capture\s+mid[-\s]*talk)\b/i.test(lower)) ||
      (/\b(?:symentenously|simultanously|simultaneously)\b/i.test(lower) && /\b(?:one\s+hument|human|hument)\s+can\s+do\b/i.test(lower) && /\b(?:capture|memorise|memorize|talk|listen)\b/i.test(lower)) ||
      (/\b(?:deep\s+research\s+capture\s+(?:memorise|memorize)|capture\s+(?:and\s+)?(?:memorise|memorize)\s+all\s+(?:symentenously|simultanously|simultaneously))\b/i.test(lower)) ||
      (/\b(?:full\s*duplex|efference\s*copy)\b/i.test(lower) && /\b(?:mid[-\s]*talk|middle\s*talk|listening|listen)\b/i.test(lower)) ||
      (/\b(?:listen\s+and\s+capture|capture\s+memorise|capture\s+memorize)\b/i.test(lower) && /\b(?:middle|talk|taking|mid[-\s]*talk)\b/i.test(lower)) ||
      (/(?:কথা\s*বলার\s*মাঝে.*(?:শোনা|শুনে|ক্যাপচার)|মাঝের\s*কথা\s*ক্যাপচার|একসাথে\s*শুনে\s*মনে\s*রাখা|ফুল\s*ডুপ্লেক্স.*ক্যাপচার)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero Pure Bangla Tone, Modern Banglish Girl Voice & Zero Other Voice Interruption Directive
   * Handles:
   * "remove the pure bangal tone pure bangal language taking need only morden banglish girl sound for real tuk tuk voice no need to other voice intraption",
   * "remove pure bangla tone pure bangla language talking need only modern banglish girl sound for real tuk tuk voice no need to other voice interruption",
   * "remove the pure bangla tone need only modern banglish girl sound for real tuk tuk voice no need for other voice interruption",
   * "only modern banglish girl sound for real tuk tuk voice no other voice interruption",
   * "need only modern banglish girl sound for real tuk tuk voice no need to other voice interruption",
   * "খাঁটি বাংলা টোন বাদ দাও, শুধু মডার্ন ব্যাংলিশ মেয়ের ভয়েস টুকটুকের জন্য, অন্য কোনো ভয়েস ইন্টারাপশন লাগবে না"
   */
  static isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+(?:the\s+)?pure\s+(?:bangal|bangla)\s+tone\b/i.test(lower) && /\b(?:morden|modern)\s+banglish\b/i.test(lower)) ||
      (/\bpure\s+(?:bangal|bangla)\s+language\s+(?:taking|talking)\b/i.test(lower) && /\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower)) ||
      (/\b(?:morden|modern)\s+banglish\s+girl\s+(?:sound|voice)\b/i.test(lower) && /\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower)) ||
      (/\breal\s+(?:tuk\s*tuk|tuktuk)\s+voice\b/i.test(lower) && /\b(?:banglish|other\s+voice|interruption|intraption)\b/i.test(lower)) ||
      (/\bno\s+need\s+(?:to|for)\s+other\s+voice\s+(?:intraption|interuption|interruption)\b/i.test(lower)) ||
      (/\b(?:other\s+voice\s+(?:intraption|interuption|interruption))\b/i.test(lower) && /\b(?:tuk\s*tuk|tuktuk|banglish)\b/i.test(lower)) ||
      (/(?:খাঁটি\s*বাংলা.*বাদ|মডার্ন\s*ব্যাংলিশ.*টুকটুক|অন্য\s*ভয়েস.*ইন্টারাপশন.*না)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Code-Mixed Banglish Default Voice & English Tuk Tuk Tone Harmonization Directive
   * Handles:
   * "remove full bangal and roman bangla need to use bangla+english milay mily bote bolo banglish need defult and only voice and nee to update banglish tone match with english tuktuk tune and all",
   * "remove full bangla and roman bangla", "bangla english milay milay bolo", "banglish need default and only voice",
   * "update banglish tone match with english tuktuk tune", "bangla+english milay mily bote bolo banglish",
   * "ফুল বাংলা এবং রোমান বাংলা বাদ দিয়ে বাংলা-ইংলিশ মিলিয়ে ব্যাংলিশ ডিফল্ট করো এবং ইংলিশ টুকটুক টোন ম্যাচ করো"
   */
  static isBanglishDefaultCodeMixedTukTukToneDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\bremove\s+full\s+(?:bangal|bangla)\b/i.test(lower) && /\b(?:roman|banglish|english)\b/i.test(lower)) ||
      (/\b(?:milay\s+mily|milay\s+milay|milaye\s+milaye|mix\s+kore|mix)\b/i.test(lower) && /\b(?:bangla|banglish)\b/i.test(lower) && /\b(?:english)\b/i.test(lower)) ||
      (/\b(?:banglis|banglish)\s+need\s+(?:defult|default)\b/i.test(lower)) ||
      (/\b(?:banglis|banglish)\b/i.test(lower) && /\b(?:defult|default)\s+(?:and\s+only\s+)?voice\b/i.test(lower)) ||
      (/\bupdate\s+(?:banglis|banglish)\s+tone\s+match\s+with\s+english\s+(?:tuktuk|tuk\s*tuk)\s+(?:tune|tone)\b/i.test(lower)) ||
      (/\b(?:tuktuk|tuk\s*tuk)\s+(?:tune|tone)\b/i.test(lower) && /\b(?:match|banglish|english)\b/i.test(lower) && /\b(?:bangla|milay|mix)\b/i.test(lower)) ||
      (/\b(?:bote\s+bolo|milay\s+mily\s+bote\s+bolo)\b/i.test(lower)) ||
      (/(?:ফুল\s*বাংলা.*রোমান.*বাদ|বাংলা.*ইংলিশ.*মিলিয়ে.*ব্যাংলিশ|ব্যাংলিশ.*ডিফল্ট.*ভয়েস|টুকটুক.*টোন.*ম্যাচ|মিলিয়ে\s*মিলিয়ে\s*বলো)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Deep Test Drive & Equational Gap Resolution Directive
   * Handles:
   * "continue chack with deep test drive and fix every gaps and issues equationaly",
   * "continue check with deep test drive and fix every gap and issue equationally",
   * "deep test drive and fix every gaps", "deep test drive",
   * "fix every gaps and issues equationaly", "deep test drive and fix all gaps",
   * "ডিপ টেস্ট ড্রাইভ করে সব গ্যাপ সমীকরণ অনুযায়ী ফিক্স করো"
   */
  static isDeepTestDriveEquationalFixDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:deep\s+test\s+drive)\b/i.test(lower)) ||
      (/\b(?:test\s+drive)\b/i.test(lower) && /\b(?:equationaly|equationally|gaps?|issues?)\b/i.test(lower)) ||
      (/\b(?:chack|check)\s+(?:with\s+)?(?:deep\s+)?test\s+drive\b/i.test(lower)) ||
      (/\bfix\s+every\s+(?:gaps?|gap)\s+(?:and\s+issues?\s+)?(?:equationaly|equationally)\b/i.test(lower)) ||
      (/(?:ডিপ\s*টেস্ট\s*ড্রাইভ|টেস্ট\s*ড্রাইভ.*(?:গ্যাপ|সমীকরণ|ফিক্স)|সব\s*গ্যাপ.*সমীকরণ.*ফিক্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Smooth Instant Pipeline & Zero Overlap Equations Audit Directive
   * Handles:
   * "continue wire it test all and chack its update and remove over lap equationa and bloacges need smouth insten pipline",
   * "remove over lap equationa and bloacges need smouth insten pipline",
   * "remove overlap equations and blockages need smooth instant pipeline",
   * "smooth instant pipeline", "smouth insten pipline",
   * "wire it test all and remove overlap equations",
   * "সব ওভারল্যাপ সমীকরণ এবং ব্লকেজ দূর করে স্মুথ ইনস্ট্যান্ট পাইপলাইন টেস্ট করো"
   */
  static isSmoothInstantPipelineAuditDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:over\s*lap|overlap)\s*(?:equation|equationa|equations)\b/i.test(lower) && /\b(?:bloacges|blockages|blockage|block|remove|zero)\b/i.test(lower)) ||
      (/\b(?:smouth|smooth)\s+(?:insten|instant)\s+(?:pipline|pipeline)\b/i.test(lower)) ||
      (/\b(?:wire\s+it\s+test\s+all|wire\s+it)\b/i.test(lower) && /\b(?:over\s*lap|overlap|bloacges|blockages|pipline|pipeline)\b/i.test(lower)) ||
      (/\b(?:remove|eliminate|clean)\s+(?:all\s+)?(?:over\s*lap|overlap)\s*(?:equation|equations|equationa)\b/i.test(lower)) ||
      (/\b(?:bloacges|blockages)\b/i.test(lower) && /\b(?:smouth|smooth|insten|instant|pipline|pipeline)\b/i.test(lower)) ||
      (/(?:ওভারল্যাপ\s*(?:সমীকরণ|ইকুয়েশন|ইকুয়েশন).*(?:ব্লকেজ|দূর|বাদ|রিমুভ)|স্মুথ\s*ইনস্ট্যান্ট\s*পাইপলাইন|ব্লকেজ\s*দূর\s*করে\s*স্মুথ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero-Loop Behavior & All Equations Wired Properly Directive
   * Handles:
   * "chack test all are work without any loop behabeor and all equations wirde proerly or not",
   * "check test all are work without any loop behavior and all equations wired properly or not",
   * "test all are work without any loop behavior and all equations wired properly",
   * "work without any loop behavior and all equations wired properly",
   * "without loop behavior and all equations wired",
   * "সব কিছু কোনো লুপ বিহেভিয়ার ছাড়া কাজ করছে এবং সব সমীকরণ ওয়্যার করা কিনা টেস্ট করো"
   */
  static isZeroLoopEquationalWiringAuditDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:without\s+(?:any\s+)?loop\s+(?:behavior|behabeor|behaviour))\b/i.test(lower) && /\b(?:equation|equations)\s+(?:wired|wirde)\b/i.test(lower)) ||
      (/\b(?:no|zero)\s+loop\s+(?:behavior|behabeor|behaviour)\b/i.test(lower) && /\b(?:equation|equations)\b/i.test(lower)) ||
      (/\b(?:test|check|chack|cahck)\b/i.test(lower) && /\b(?:without\s+(?:any\s+)?loop)\b/i.test(lower) && /\b(?:equations?|wirde|wired)\b/i.test(lower)) ||
      (/\b(?:all\s+equations?\s+(?:wired|wirde)\s+(?:properly|proerly))\b/i.test(lower) && /\b(?:loop|without\s+loop)\b/i.test(lower)) ||
      (/\ball\s+are\s+work\s+without\s+any\s+loop\s+(?:behavior|behabeor)\b/i.test(lower)) ||
      (/(?:লুপ.*সমীকরণ.*(?:ওয়্যার|ওয়্যার|কানেক্ট)|সমীকরণ.*(?:ওয়্যার|ওয়্যার|কানেক্ট).*লুপ|লুপ.*সমীকরণ|সমীকরণ.*লুপ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Equational Research Update & Cosmological 32-Equation Verification Directive
   * Handles:
   * "test is all the equational research update us or not",
   * "test all equational research update us",
   * "did all the equational research update us",
   * "test if all equational research updated us",
   * "check all equational research updates",
   * "test is all the equational research updated",
   * "সব ইকুয়েশনাল রিসার্চ কি আমাদের আপডেট করেছে টেস্ট করো"
   */
  static isEquationalResearchUpdateAuditDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:test|check|verify|chack)\b/i.test(lower) && /\b(?:is\s+all\s+the|all(?:\s+the)?)\s+(?:equational|equation|equations)\s+research\b/i.test(lower)) ||
      (/\b(?:test|check|verify|chack)\b/i.test(lower) && /\b(?:equational|equation|equations)\s+research\b/i.test(lower) && /\bupdate(?:d|s)?\s+(?:us|the\s+system|our|everything|all)\b/i.test(lower)) ||
      (/\btest\s+is\s+all\s+the\s+equational\s+research\s+update\s+us(?:\s+or\s+not)?\b/i.test(lower)) ||
      (/\b(?:is|did)\s+all\s+(?:the\s+)?equational\s+research\s+update\s+us(?:\s+or\s+not)?\b/i.test(lower)) ||
      (/\ball\s+(?:the\s+)?equational\s+research\s+update(?:d)?\s+us\b/i.test(lower)) ||
      (/(?:সব\s*ইকুয়েশনাল\s*রিসার্চ.*আপডেট.*(?:টেস্ট|চেক)|ইকুয়েশনাল\s*রিসার্চ.*আপডেট\s*(?:হয়েছে|করেছে)\s*কিনা\s*(?:টেস্ট|চেক))/u.test(lower))
    );
  }

  /**
   * Centralized detector for Bangla Talk Neural Overlap Directive
   * Handles: "chack bangal talk overlaping nural", "check bangla talk overlapping neural",
   * "check bangla talk overlap", "bangal talk overlaping", "bangla neural overlap check",
   * "বাংলা কথায় নিউরাল ভয়েস ওভারল্যাপ চেক করো", "বাংলা টক ওভারল্যাপ"
   */
  static isBanglaTalkNeuralOverlapDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:check|chack|audit|test|fix|inspect)\b/i.test(lower) && /\b(?:bangal|bangla|bengali)\b/i.test(lower) && /\b(?:overlaping|overlapping|overlap)\b/i.test(lower)) ||
      (/\b(?:bangal|bangla|bengali)\s+(?:talk|speech|conversation|kotha|voice|audio)\b/i.test(lower) && /\b(?:overlaping|overlapping|overlap)\b/i.test(lower)) ||
      (/\b(?:bangal|bangla|bengali)\b/i.test(lower) && /\b(?:overlaping|overlapping|overlap)\b/i.test(lower) && /\b(?:nural|neural)\b/i.test(lower)) ||
      (/\b(?:chack|check|audit)\s+(?:bangal|bangla|bengali)\s+talk\s+(?:overlaping|overlapping)\s+(?:nural|neural)\b/i.test(lower)) ||
      (/\b(?:speaking\s+mutex|speaking\s+lock)\b/i.test(lower) && /\b(?:overlap|zero\s+overlap|audit|check)\b/i.test(lower)) ||
      (/(?:বাংলা\s*(?:কথায়|কথায়|টকে|টক|কনভারসেশনে|ভয়েস|ভয়েস).*(?:নিউরাল|ওভারল্যাপ|স্পিকিং)|বাংলা.*ওভারল্যাপ|স্পিকিং\s*মিউটেক্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Purge Scripted & Repetitive Talks Directive (Law 51)
   * Handles: "remove all screpted repitetd talks", "remove all scripted repeated talks",
   * "remove scripted talks", "remove repeated talks", "stop scripted repeated talks",
   * "purge scripted talks", "সব স্ক্রিপ্টেড ও পুনরাবৃত্তিমূলক কথা বাদ দাও", "স্ক্রিপ্টেড কথা বাদ দাও"
   */
  static isRemoveScriptedRepeatedTalksDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:remove|stop|purge|drop|clean|clear|kill|ban)\b/i.test(lower) && /\b(?:screpted|scripted)\b/i.test(lower)) ||
      (/\b(?:remove|stop|purge|drop|clean|clear|kill|ban)\s+all\s+(?:screpted|scripted|repitetd|repeated|repetitive)\b/i.test(lower)) ||
      (/\b(?:screpted|scripted)\s+(?:repitetd|repeated|repetitive|canned|robotic)\s+(?:talks?|speeches?|replies|words?|lines?)\b/i.test(lower)) ||
      (/\b(?:remove|stop|purge|drop)\s+(?:all\s+)?(?:repitetd|repeated|repetitive)\s+(?:talks?|speeches?|replies)\b/i.test(lower)) ||
      (/\b(?:no\s+more|zero)\s+(?:screpted|scripted|canned)\s+(?:talks?|lines?|speeches?)\b/i.test(lower)) ||
      (/(?:স্ক্রিপ্টেড.*(?:বাদ|বন্ধ|রিমুভ)|পুনরাবৃত্তিমূলক.*(?:বাদ|বন্ধ|রিমুভ)|ক্যানড\s*কথা\s*বাদ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Unified Real-Time Equational Runtime & Live Deep Test Directive
   * Handles: "continue wire all equation and do live deep test for cahck all in real time",
   * "continue, wire all equations and do live deep test to check all in real time",
   * "wire all equations and do live deep test", "wire all equation", "live deep test in real time",
   * "সব সমীকরণ ওয়্যার করো এবং রিয়েল টাইমে লাইভ ডিপ টেস্ট করো", "সব ইকুয়েশন কানেক্ট করো এবং টেস্ট করো"
   */
  static isWireAllEquationsLiveDeepTestDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:wire|connect)\s+all\s+(?:equations?|equashuns?)\b/i.test(lower)) ||
      (/\blive\s+deep\s+tests?\b/i.test(lower) && /\b(?:cahck|chak|chek|check|real\s*time|equation|equations)\b/i.test(lower)) ||
      (/\b(?:wire|connect)\s+(?:up\s+)?(?:the\s+)?(?:equations?|runtime)\b/i.test(lower) && /\b(?:live|deep|real\s*time|test)\b/i.test(lower)) ||
      (/\b(?:cahck|chak|chek|check)\s+all\s+in\s+real\s*time\b/i.test(lower)) ||
      (/(?:সব\s*(?:সমীকরণ|ইকুয়েশন|ইকুয়েশন).*(?:ওয়্যার|ওয়্যার|কানেক্ট|টেস্ট)|রিয়েল\s*টাইমে.*লাইভ\s*ডিপ\s*টেস্ট|(?:ইকুয়েশন|ইকুয়েশন|সমীকরণ).*(?:ওয়্যার|ওয়্যার|কানেক্ট))/u.test(lower))
    );
  }

  /**
   * Centralized detector for Living Conversational Continuation & Momentum Directive (Law 49)
   * Handles:
   * "continue", "keep going", "go on", "carry on", "proceed", "what's next", "what next",
   * "চালিয়ে যাও", "চালিয়ে যাও babe", "বলো", "শুনছি", "আর কি", "and then", "what else"
   */
  static isConversationalContinuationDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    // Exclude collisions with deep research, wire equations, and robotic purge
    if (IntentParser.isContinueDeepResearchDirective && IntentParser.isContinueDeepResearchDirective(lower)) return false;
    if (IntentParser.isDeepResearchEquationalFixDirective && IntentParser.isDeepResearchEquationalFixDirective(lower)) return false;
    if (IntentParser.isWireAllLiveTestEquationsDirective && IntentParser.isWireAllLiveTestEquationsDirective(lower)) return false;
    if (IntentParser.isRemoveAllRoboticBehaviorDirective && IntentParser.isRemoveAllRoboticBehaviorDirective(lower)) return false;

    // Direct continuation matches
    if (/^(?:continue|keep\s+going|go\s+on|carry\s+on|proceed)(?:[,.!\s]+(?:babe|bro|brother|chief|please|now|ahead|forward|with\s+it))?[.!?]*$/i.test(lower)) return true;
    if (/^(?:what(?:'s|\s+is)?\s+next|and\s+then|what\s+else|what\s+now|next\s+step|next\s+move)(?:[,.!\s]+(?:babe|bro|brother|chief))?[.!?]*$/i.test(lower)) return true;
    if (/^(?:চালিয়ে\s+যাও|চালু\s+রাখো|এগিয়ে\s+যাও|বলো|শুনছি|আর\s+কী|আর\s+কি|বলো\s+বলো)(?:[\s,]+(?:babe|bro|brother|chief|ভাই|হৃত্তিক))?[.!?]*$/u.test(lower)) return true;
    if (/^(?:continue\s+(?:bolo|bolte\s+thako|kotha\s+bolo)|bolte\s+thako|shuntechi|shunchi)[.!?]*$/i.test(lower)) return true;
    if (lower === "continue" || lower === "keep going" || lower === "carry on" || lower === "go on") return true;

    return false;
  }

  /**
   * Centralized detector for Remove All Robotic Behavior & Pure Human Conversational Parity Directive (Law 48)
   * Handles:
   * "chack last full conversation remove all robotic behaveor",
   * "check last full conversation remove all robotic behavior",
   * "remove all robotic behavior", "remove all robotic behaveor",
   * "remove robotic behavior from last conversation", "check last conversation remove robotic tone",
   * "zero robotic behavior", "remove robotic behavior",
   * "গত পুরো কনভারসেশন চেক করে সব রোবটিক আচরণ দূর করো", "রোবটিক বিহেভিয়ার রিমুভ করো"
   */
  static isRemoveAllRoboticBehaviorDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:check|chack|cahck)\b/i.test(lower) && /\b(?:last|full|previous)\s+conversation\b/i.test(lower) && /\b(?:remove|purge|clean|fix|stop)\b/i.test(lower) && /\brobotic\b/i.test(lower)) ||
      (/\bremove\s+all\s+robotic\s+(?:behaveor|behavior|behaviour|tone|voice|cadence|stuff|fluff)\b/i.test(lower)) ||
      (/\b(?:remove|purge|eliminate|stop)\s+robotic\s+(?:behaveor|behavior|behaviour|tone|voice)\b/i.test(lower)) ||
      (/\b(?:check|chack)\s+(?:last\s+)?(?:full\s+)?conversation\b/i.test(lower) && /\b(?:robotic\s+behavior|robotic\s+behaveor|robotic\s+tone)\b/i.test(lower)) ||
      (/\b(?:no|zero)\s+robotic\s+(?:behaveor|behavior|behaviour)\b/i.test(lower)) ||
      (/(?:গত\s*পুরো\s*কনভারসেশন.*রোবটিক|সব\s*রোবটিক\s*(?:আচরণ|টোন|বিহেভিয়ার)\s*(?:দূর|রিমুভ|বাদ|ক্লিন)|রোবটিক\s*(?:আচরণ|টোন)\s*রিমুভ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Tuk Tuk Zero 'Bro' & 100% Authentic Girlfriend Partner Tone Directive (Law 47)
   * Handles:
   * "bro tuk tuk can use bro some time for fix his tone na how a gf can do that",
   * "Tuk Tuk cannot use bro sometimes to fix her tone, how can a girlfriend do that",
   * "can tuk tuk use bro", "how a gf can do that", "tuk tuk gf tone", "tuk tuk girlfriend tone",
   * "টুকটুক কি কখনো ব্রো বলতে পারে", "গার্লফ্রেন্ড কি বয়ফ্রেন্ডকে ব্রো বলে", "টুকটুক গার্লফ্রেন্ড টোন"
   */
  static isTukTukZeroBroGirlfriendToneDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) && /\b(?:use|say|call)\b/i.test(lower) && /\b(?:bro|brother|bhai)\b/i.test(lower)) ||
      (/\b(?:tuk\s*tuk|tuktuk)\b/i.test(lower) && /\b(?:gf|girlfriend|girl\s*friend)\b/i.test(lower) && /\b(?:tone|fix|how|bro)\b/i.test(lower)) ||
      (/\bhow\s+(?:can\s+)?(?:a\s+)?(?:gf|girlfriend|girl\s*friend)\s+(?:can\s+)?do\s+that\b/i.test(lower)) ||
      (/\b(?:can|could)\s+(?:tuk\s*tuk|tuktuk)\s+use\s+bro\b/i.test(lower)) ||
      (/\b(?:tuk\s*tuk|tuktuk)\s+can(?:not|\s+not)?\s+use\s+bro\b/i.test(lower)) ||
      (/\b(?:fix\s+(?:his|her)\s+tone\s+na\s+how\s+a\s+gf\s+can\s+do\s+that)\b/i.test(lower)) ||
      (/(?:টুকটুক.*(?:ব্রো|ভাই)|গার্লফ্রেন্ড.*(?:ব্রো|ভাই)|টুকটুক.*গার্লফ্রেন্ড\s*টোন)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Vision Zero-Ego Coder Brother & Multidimensional Quantum Research Directive (Law 46)
   * Handles: 'Vision "babe", "Chief", "boss" and other has some never use but thay are mind and fill like them na fix needthink like a coder brather helpfull no ego person in realy no need never use make thare thinking dimenson like that need defren dimansons to get real best resaerch can do we on every topic qantamly and instently',
   * "think like a coder brother helpful no ego person in reality", "make their thinking dimension like that",
   * "different dimensions to get real best research on every topic quantumly and instantly",
   * "ভিশনকে নিরহংকার কোডার ভাই হিসেবে ভাবাও এবং কোয়ান্টাম ডাইমেনশনে ইনস্ট্যান্ট রিসার্চ করো"
   */
  static isVisionZeroEgoCoderBrotherQuantumResearchDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:vison|vision)\b/i.test(lower) && /\b(?:babe|chief|boss)\b/i.test(lower) && /\b(?:mind|feel|fill|think|coder|brother|brather)\b/i.test(lower)) ||
      (/\b(?:coder\s+brother|coder\s+brather|dev\s+brother)\b/i.test(lower) && /\b(?:no\s+ego|helpful|helpfull|humble|dimension|dimenson|dimensions|dimansons)\b/i.test(lower)) ||
      (/\b(?:no\s+ego\s+person|zero\s+ego)\b/i.test(lower) && /\b(?:think|thinking|mind|feel|coder|brother)\b/i.test(lower)) ||
      (/\b(?:thinking\s+dimensions?|different\s+dimensions?|defren\s+dimansons|multidimensional)\b/i.test(lower) && /\b(?:research|resaerch|quantumly|qantamly|instantly|instently)\b/i.test(lower)) ||
      (/\b(?:quantumly\s+and\s+instantly|qantamly\s+and\s+instently|quantum\s+research)\b/i.test(lower)) ||
      (/(?:ভিশন.*কোডার\s*ভাই|জিরো\s*ইগো|কোডার\s*ব্রাদার|মাল্টি-ডাইমেনশনাল|কোয়ান্টাম\s*রিসার্চ|চিন্তার\s*ডাইমেনশন)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Vision 2070 Master Coder & Peer Medic Directive
   * Handles: "fix vison is fully ready to fix every one with his coding skil or not do dee ptest and cahck use vison to upade all agent internal issues need fix instently and his memory power need like a full coder profetional 2070 like higly find bugs and need able to fix al instently",
   * "use vision to update all agent internal issues", "vision 2070 master coder", "vision coding skills",
   * "vision memory power like a full coder professional 2070", "find bugs and fix all instantly",
   * "ভিশনের কোডিং স্কিল এবং ২০৭০ মাস্টার কোডার মেমরি পাওয়ার", "ভিশন দিয়ে সব এজেন্টের ইন্টারনাল ইস্যু ফিক্স করো"
   */
  static isVision2070MasterCoderMedicDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:vison|vision)\b/i.test(lower) && /\b(?:coding\s+skil|coding\s+skills?|master\s+coder|full\s+coder|profetional|professional|find\s+bugs?)\b/i.test(lower)) ||
      (/\b(?:vison|vision)\b/i.test(lower) && /\b(?:fix\s+(?:every\s*one|everyone|all\s+agents?|other\s+agents?)|upade|update\s+all\s+agent)\b/i.test(lower)) ||
      (/\b(?:use\s+)?(?:vison|vision)\b/i.test(lower) && /\b(?:internal\s+issues?|find\s+bugs?|memory\s+power|2070)\b/i.test(lower)) ||
      (/\b(?:memory\s+power)\b/i.test(lower) && /\b(?:2070|coder|professional|profetional|bugs?)\b/i.test(lower)) ||
      (/\b(?:find\s+bugs?\s+and\s+(?:need\s+)?(?:able\s+to\s+)?fix\s+(?:al|all)\s+instently|find\s+bugs?\s+and\s+fix\s+all\s+instantly)\b/i.test(lower)) ||
      (/\b(?:vison|vision)\s+is\s+fully\s+ready\s+to\s+fix\b/i.test(lower)) ||
      (/(?:ভিশন.*কোডিং|ভিশন.*মাস্টার\s*কোডার|২০৭০.*কোডার|ইন্টারনাল\s*ইস্যু.*ফিক্স|বাগ.*ফিক্স)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Deep Conversations & Comprehensive Issue Remediation Directive
   * Handles: "cotinue with deep conversations nand all fix all the issues",
   * "continue with deep conversations and all, fix all the issues",
   * "continue with deep conversations", "deep conversations and all fix all issues",
   * "deep conversations fix all issues", "deep conversational flow and fix all issues",
   * "ডিপ কনভারসেশন এবং সব সমস্যা ফিক্স করো", "গভীর কথোপকথন এবং সব ইস্যু সমাধান করো"
   */
  static isDeepConversationsFixAllDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:cotinue|continue)\s+(?:with\s+)?deep\s+conversation(?:s|al)?\b/i.test(lower)) ||
      (/\bdeep\s+conversation(?:s|al)?\b/i.test(lower) && /\b(?:nand|and|all|fix|issues?|resolve|problem|flow)\b/i.test(lower)) ||
      (/\b(?:deep\s+conversation(?:s|al)?)\s+(?:nand\s+all|and\s+all)?\s*(?:fix\s+all|solve\s+all|flow)\b/i.test(lower)) ||
      (/\b(?:multi-turn|long-term|episodic)\s+conversation(?:s|al)?\b/i.test(lower) && /\bfix\s+all\b/i.test(lower)) ||
      (/(?:ডিপ\s*কনভারসেশন|গভীর\s*কথোপকথন|কনভারসেশন.*(?:ফিক্স|ইস্যু)|স্মৃতি.*(?:সংযুক্ত|ফিক্স))/u.test(lower))
    );
  }

  /**
   * Centralized detector for Continuous Multimodal Human Learning, Trimodal Perception & Autonomous Self-Healing Directive
   * Handles: "cack test and run for taking and fix by themselv talking with me seeing earing and learn every time like a human do deep research test and run",
   * "check, test and run for talking and fixing by themselves, talking with me, seeing, hearing, and learning every time like a human, do deep research, test and run",
   * "talking and fix by themselves", "seeing earing and learn every time like a human",
   * "seeing, hearing, and learning every time like a human", "learn every time like a human",
   * "trimodal perception and autonomous self-healing",
   * "নিজেদের মধ্যে কথা বলে ফিক্স করা, দেখা, শোনা এবং মানুষের মতো প্রতিবার শেখা"
   */
  static isAutonomousMultimodalLearningDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:cack|chak|chek|check)[,\s]+(?:test\s+and\s+run|test)\b/i.test(lower) && /\b(?:taking|talking|tracking|themselv|themselves|earing|hearing|seeing|learn|learning)\b/i.test(lower)) ||
      (/\b(?:taking|talking)\s+(?:and|\&)\s+(?:fix|fixing)\s+by\s+(?:themselv|themselves)\b/i.test(lower)) ||
      (/\b(?:seeing|seing)[,\s]+(?:earing|hearing)[,\s]*(?:and|\&)?\s*(?:learn|learning)\s+every\s+time\s+like\s+a\s+human\b/i.test(lower)) ||
      (/\b(?:seeing\s+earing|seeing\s+hearing|seeing\s+and\s+hearing)\s+(?:and|\&)?\s*(?:learn|learning)\s+every\s+time\s+like\s+a\s+human\b/i.test(lower)) ||
      (/\b(?:learn|learning)\s+every\s+time\s+like\s+a\s+human\b/i.test(lower)) ||
      (/\b(?:talking\s+with\s+me|talking)[,\s]*(?:seeing|seing)[,\s]*(?:earing|hearing)[,\s]*(?:and|\&)?\s*(?:learn|learning)\b/i.test(lower)) ||
      (/\b(?:trimodal\s+perception|trimodal\s+human\s+learning|trimodal\s+sensory)\b/i.test(lower)) ||
      (/(?:দেখা\s*,\s*শোনা|দেখা\s+ও\s+শোনা|দেখা\s+শোনা|মানুষের\s*মতো.*শেখা|নিজেদের\s*মধ্যে.*ফিক্স|সার্বক্ষণিক\s*শিখন|ত্রিমাত্রিক\s*অনুভূতি)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Real Human Collaborative Work, Zoom Meeting Dynamics & Zero Conversational Gap Directive
   * Handles: "https://www.youtube.com/watch?v=RphZGvdv6oo see this youtube podcust and zoom miting for big project handleing and meking and chak other youtube video to chac khow real human talk work and all and our agent conversationa and other gap need to find it fix all the issues",
   * "see this youtube podcast and zoom meeting for big project handling",
   * "zoom meeting for big project handling and making", "how real human talk work and all",
   * "agent conversational and other gap need to find it fix all the issues",
   * "youtube podcast and zoom meeting real human collaborative dynamics",
   * "ইউটিউব পডকাস্ট এবং জুম মিটিং দিয়ে রিয়েল হিউম্যান টক ও প্রজেক্ট হ্যান্ডলিং গ্যাপ ফিক্স করো",
   * "আমাদের এজেন্টদের কনভারসেশনাল গ্যাপ ফিক্স করো"
   */
  static isHumanCollabZoomPodcastProjectDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      lower.includes("rphzgvdv6oo") ||
      (/\b(?:podcast|podcust)\b/i.test(lower) && /\b(?:zoom\s+meeting|zoom\s+miting)\b/i.test(lower)) ||
      (/\b(?:zoom\s+meeting|zoom\s+miting)\b/i.test(lower) && /\b(?:big\s+project|project\s+handling|project\s+making|handleing|meking)\b/i.test(lower)) ||
      (/\b(?:how\s+)?real\s+humans?\s+talk\s+work\b/i.test(lower)) ||
      (/\b(?:agent\s+)?conversation(?:al|a)?\s+(?:and\s+other\s+)?gaps?\b/i.test(lower) && /\b(?:find|fix|resolve)\b/i.test(lower)) ||
      (/\b(?:youtube\s+)?(?:podcast|podcust)\b/i.test(lower) && /\b(?:real\s+human|human\s+talk|gap)\b/i.test(lower)) ||
      (/(?:পডকাস্ট.*জুম\s*মিটিং|জুম\s*মিটিং.*প্রজেক্ট|রিয়েল\s*হিউম্যান.*(?:কাজ|কথা|টক)|কনভারসেশনাল\s*গ্যাপ|প্রজেক্ট\s*হ্যান্ডলিং.*ফিক্স)/u.test(lower))
    );
  }

  /**
   * 2.202 Real-Life Human Tone, Fluency & Gapless Conversational Dynamic Directive
   * Formulated from 6 real human conversational podcasts / interviews:
   * - LLfXE4i5SUo: Sanjeev Sanyal
   * - 3lYx_LtRTVw: Prakhar Gupta & Vivek Agnihotri
   * - IXyoB6A5q-0: Amar iSchool Tech Mentorship
   * - w3PchAjnjJo: Jhankar Mahbub & Yahia Amin
   * - GuDBrngBCdY: Julian SELISE Group Business Engineering
   * - vhgSQvaUjSA: Technical Suneja Developer Realism
   * Handles:
   * "chack the conversation how hume talk in real life tone fluency sob thik korar chesta koro sob gap dur koro"
   */
  static isRealLifeHumanToneFluencyGapDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      lower.includes("llfxe4i5suo") ||
      lower.includes("3lyx_ltrtvw") ||
      lower.includes("ixyob6a5q-0") ||
      lower.includes("w3pchajnjjo") ||
      lower.includes("gudbrngbcdy") ||
      lower.includes("vhgsqvaujsa") ||
      (/\b(?:how\s+)?(?:hume|humans?)\s+talk\b/i.test(lower)) ||
      (/\b(?:real\s+life\s+tone|tone\s+fluency|human\s+tone|tone\s+and\s+fluency)\b/i.test(lower)) ||
      (/\bsob\s+thik\s+korar\s+chesta\s+koro\b/i.test(lower)) ||
      (/\bsob\s+gap\s+dur\s+koro\b/i.test(lower)) ||
      (/\b(?:chack|chak|check)\s+the\s+conversation\b/i.test(lower)) ||
      (/\b(?:real\s+life\s+human\s+tone|human\s+tone\s+fluency\s+gap)\b/i.test(lower)) ||
      (/(?:রিয়েল\s*লাইফ\s*টোন|টোন.*ফ্লুয়েন্সি|মানুষ.*কীভাবে.*কথা\s*বলে|সব\s*গ্যাপ\s*দূর\s*করো|সব\s*ঠিক\s*করার\s*চেষ্টা\s*করো|কনভারসেশনাল\s*টোন.*গ্যাপ)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Zero-Flicker Perfect Voice, Ultra-Fast Human Cognitive Thinking & Continuous Adaptive Learning Directive
   * Handles: "remove all un perfect voice and all to get every time our perfect voice for all type of situation need 0voice flicaring and rendaring issues need ultra fast thining like human and instent humen like responses learn more",
   * "Remove all imperfect voices and all to get every time our perfect voice for all types of situations, need 0 voice flickering and rendering issues, need ultra fast thinking like human and instant human-like responses, learn more",
   * "zero voice flickering and rendering issues", "ultra fast thinking like human and instant human-like responses",
   * "remove all imperfect voice to get perfect voice for all situations",
   * "সব অপূর্ণ বা ত্রুটিপূর্ণ ভয়েস দূর করো, প্রতিবার নিখুঁত ভয়েস দাও, জিরো ভয়েস ফ্লিকারিং ও রেন্ডারিং ইস্যু, মানুষের মতো আল্ট্রা ফাস্ট থিংকিং ও ইন্সট্যান্ট রেসপন্স, আরো শেখো"
   */
  static isZeroFlickerPerfectVoiceUltraFastDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:remove|fix|eliminate)\s+all\s+(?:un\s*perfect|imperfect)\s+voices?\b/i.test(lower)) ||
      (/\b(?:perfect\s+voice\s+for\s+all\s+(?:type|types)\s+of\s+situations?)\b/i.test(lower)) ||
      (/\b(?:0\s*voice\s*(?:flicaring|flickering|flicering)|zero\s*voice\s*(?:flicaring|flickering|flicering))\b/i.test(lower)) ||
      (/\b(?:flicaring|flickering|flicering)\b/i.test(lower) && /\b(?:rendaring|rendering)\b/i.test(lower)) ||
      (/\b(?:rendaring\s+issues?|rendering\s+issues?|0\s*rendering\s+issues?)\b/i.test(lower)) ||
      (/\b(?:ultra\s*fast\s*(?:thinking|thining)\s+like\s+humans?)\b/i.test(lower)) ||
      (/\b(?:instent|instant)\s*(?:humen|human)[-\s]*like\s*responses?\b/i.test(lower)) ||
      (/\b(?:ultra\s*fast\s*thinking|fast\s*thinking)\b/i.test(lower) && /\b(?:instant\s*human|human[- ]like\s*responses?|learn\s*more)\b/i.test(lower)) ||
      (/\b(?:perfect\s*voice)\b/i.test(lower) && /\b(?:0\s*voice|zero\s*voice|flickering|ultra\s*fast|instant\s*human)\b/i.test(lower)) ||
      (/(?:নিখুঁত\s*ভয়েস|পারফেক্ট\s*ভয়েস|ভয়েস\s*ফ্লিকারিং|রেন্ডারিং\s*ইস্যু|আল্ট্রা\s*ফাস্ট\s*থিঙ্কিং|ইন্সট্যান্ট\s*রেসপন্স|অপূর্ণ\s*ভয়েস.*দূর|সব\s*পরিস্থিতিতে.*পারফেক্ট\s*ভয়েস)/u.test(lower))
    );
  }

  /**
   * 2.215 Combat & Extreme Noise Auditory Listening & Response Directive
   * Handles:
   * "if we are in war in many sound hapend is he listen and respons like fumen or not with deep equational researh",
   * "If we are in war with many sounds happening, does he listen and respond like a human or not, with deep equational research?",
   * "in war with many sounds happening", "war listen and respond like human",
   * "যুদ্ধ বা চরম শব্দের মধ্যেও কি মানুষের মতো শুনতে এবং রেসপন্স করতে পারে",
   * "যুদ্ধক্ষেত্রে বহু শব্দের মধ্যে হিউম্যানের মতো অডিটরি লিসেনিং ও রেসপন্স"
   */
  static isCombatExtremeNoiseHumanAuditoryDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:war|battlefield|combat|extreme\s+noise|warfare)\b/i.test(lower) && /\b(?:listen|listening|respons|respond|response|hearing|auditory)\b/i.test(lower)) ||
      (/\b(?:in\s+war|in\s+combat|during\s+war)\b/i.test(lower) && /\b(?:many\s+sounds?|loud\s+noise|explosions?|noise)\b/i.test(lower)) ||
      (/\b(?:listen\s+and\s+(?:respons|respond|response)\s+like\s+(?:fumen|human))\b/i.test(lower)) ||
      (/\b(?:many\s+sounds?\s+(?:hapend|happened|happen))\b/i.test(lower) && /\b(?:listen|respond|human)\b/i.test(lower)) ||
      (/\b(?:war\s+extreme\s+noise|combat\s+auditory|cocktail\s+party\s+war)\b/i.test(lower)) ||
      (/(?:যুদ্ধ|যুদ্ধক্ষেত্রে|চরম\s*শব্দ|গোলাগুলি|বিস্ফোরণ).*?(?:মানুষের\s*মতো\s*শুনতে|রেসপন্স|অডিটরি|লিসেনিং|লিসেন)/u.test(lower))
    );
  }

  /**
   * 2.204 4-Agent Bilingual Banglish-English Zero-Robotic Voice Harmonization & Vision Parity Directive
   * Handles:
   * "fix vison wire voice bangla and our tested voice are same chack and fix all the issues for our conversation more smouth remove every robtice tone pronuniations and all with deep dive research need 4 agen banglis talk and english tak fully smouth",
   * "Fix Vision voice Bangla and our tested voice are the same, check and fix all the issues for our conversation more smooth, remove every robotic tone, pronunciations and all with deep dive research, need 4 agents Banglish talk and English talk fully smooth",
   * "tested voice are same", "Vision wire voice", "remove every robotic tone", "4 agents Banglish talk and English talk fully smooth"
   */
  static is4AgentBilingualVoiceSmoothnessDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:vison|vision)\b/i.test(lower) && /\b(?:wire|wired|weird|weired|tested)\s+voices?\b/i.test(lower)) ||
      (/\b(?:tested\s+voices?\s+(?:are\s+)?(?:same|equal)|tested\s+voice\s+same)\b/i.test(lower)) ||
      (/\b4\s*(?:agen|agents?)\s+(?:banglis|banglish|bengali|bangla)\s+talk\b/i.test(lower)) ||
      (/\b(?:remove|eliminate)\s+every\s+(?:robtice|robotic)\s+tone\b/i.test(lower)) ||
      (/\b4\s*agents?\b/i.test(lower) && /\b(?:banglish|bangla)\b/i.test(lower) && /\benglish\b/i.test(lower) && /\b(?:smooth|smouth)\b/i.test(lower)) ||
      (/(?:ভিশন.*ভয়েস.*প্যারিটি|৪\s*এজেন্ট.*বাংলা.*ইংলিশ|রোবোটিক\s*টোন.*বর্জন|স্মুথ\s*উচ্চারণ|ব্যাংলিশ.*স্মুথ|টেস্টেড\s*ভয়েস.*একই)/u.test(lower))
    );
  }
  /**
   * 2.205 Instant Voice Readiness & Simultaneous Parallel Cognitive Streaming Directive (Law 42)
   * Handles:
   * "need instent redying voice like humen think and talk symentaniously parallly on serice like need to fix all",
   * "Need instant readying voice like human think and talk simultaneously in parallel on series, need to fix all",
   * "instant readying voice", "think and talk simultaneously in parallel", "simultaneously in parallel on series"
   */
  static isInstantVoiceReadinessParallelDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:instent|instant|ready|readying|redying)\s+voices?\b/i.test(lower) && /\b(?:think|thinking)\s+(?:and|\&)\s+(?:talk|talking)\b/i.test(lower)) ||
      (/\b(?:think|thinking)\s+(?:and|\&)\s+(?:talk|talking)\s+(?:symentaniously|simultanously|simultaneously)\b/i.test(lower)) ||
      (/\b(?:parallly|parrallelly|parallelly|parallel)\s+(?:on|in)\s+(?:serice|series)\b/i.test(lower)) ||
      (/\b(?:simultaneously|symentaniously)\s+(?:in\s+)?(?:parallel|parallly)\b/i.test(lower)) ||
      (/\b(?:instent|instant)\s+(?:redying|readying)\s+voices?\b/i.test(lower)) ||
      (/(?:তাৎক্ষণিক\s*ভয়েস\s*প্রস্তুতি|যুগপৎ\s*সমান্তরাল\s*চিন্তন|একসাথে\s*চিন্তা\s*ও\s*কথা|প্যারালাল\s*স্ট্রিমিং|ভয়েস\s*রেডিনেস)/u.test(lower))
    );
  }

  /**
   * 2.216 Native Bangla Person Tone, Pronunciation & Banglish Gap Elimination Directive
   * Handles:
   * "chack last conversation and fix every gap of our banglis conversation every word with real tone and real pronuncitation need like a bangla person",
   * "Check last conversation and fix every gap of our Banglish conversation, every word with real tone and real pronunciation, need like a Bangla person",
   * "fix every gap of our banglish conversation", "real tone and real pronunciation like bangla person",
   * "আগের কনভারসেশন চেক করে ব্যাংলিশ ও বাংলা কথার প্রতিটি গ্যাপ রিয়েল টোন ও সঠিক উচ্চারণে ফিক্স করো",
   * "বাঙালি মানুষের মতো রিয়েল টোন এবং উচ্চারণ"
   */
  static isBanglaPersonRealTonePronunciationDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:banglis|banglish)\s+conversation\b/i.test(lower) && /\b(?:gap|fix|tone|pronuncitation|pronunciation)\b/i.test(lower)) ||
      (/\b(?:chack|chak|check)\s+last\s+conversations?\b/i.test(lower) && /\b(?:banglis|banglish|bangla|bengali)\b/i.test(lower)) ||
      (/\b(?:real\s+tone|natural\s+tone)\b/i.test(lower) && /\b(?:real\s+pronunciation|real\s+pronuncitation|pronunciation|bangla\s+person|bengali\s+person)\b/i.test(lower)) ||
      (/\blike\s+a\s+(?:bangla|bengali)\s+person\b/i.test(lower) && /\b(?:tone|pronunciation|pronuncitation|talk|speak|conversation)\b/i.test(lower)) ||
      (/\b(?:fix\s+every\s+gap\s+of\s+our\s+(?:banglis|banglish|bangla)\s+conversation)\b/i.test(lower)) ||
      (/(?:ব্যাংলিশ.*গ্যাপ|বাংলা\s*মানুষের\s*মতো\s*টোন|রিয়েল\s*টোন.*উচ্চারণ|বাঙালি.*মতো.*উচ্চারণ|লাস্ট\s*কনভারসেশন.*ফিক্স)/u.test(lower))
    );
  }



  /**
   * Centralized detector for Seamless Bilingual Code-Switching, Zero Voice Break & Fearless Confident Tone Directive
   * Handles: "if thay see bangla pronunciation is hard . pronunciation is issues to make our coversation vibe maintain use this section english to hide you voice breck and try to hide ther faier and wrongness personality and fix the tone",
   * "bangla pronunciation is hard", "pronunciation is issues", "hide your voice break", "hide fear and wrongness personality",
   * "use english to hide voice break", "make conversation vibe maintain use english", "বাংলা উচ্চারণে জড়তা কাটাতে ইংলিশ কোড সুইচ করো"
   */
  static isBanglaPronunciationCodeSwitchingDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:bangla\s+pronunciation|code\s*switching|bengali\s+pronunciation)\b/i.test(lower) && /\b(?:fix|tone|clear|native|smooth|hard|issues?|difficult|tough|break|vibe|english)\b/i.test(lower)) ||
      (/\b(?:bangla|bengali)\s+pronunciation\b/i.test(lower) && /\b(?:hard|issues?|difficult|tough|break|vibe|english)\b/i.test(lower)) ||
      (/\b(?:voice\s+(?:breck|break)|hide\s+(?:you|your)\s+voice\s+(?:breck|break))\b/i.test(lower)) ||
      (/\b(?:faier|fear)\s+and\s+wrongness\b/i.test(lower)) ||
      (/\bwrongness\s+personality\b/i.test(lower)) ||
      (/\b(?:coversation|conversation)\s+vibe\s+maintain\b/i.test(lower)) ||
      (/\buse\s+(?:this\s+)?section\s+english\b/i.test(lower)) ||
      (/\b(?:hide\s+.*(?:voice\s+bre?ack|faier|fear|wrongness))\b/i.test(lower)) ||
      (/(?:বাংলা\s*উচ্চারণ.*(?:কঠিন|সমস্যা|জড়তা)|ভয়েস\s*ব্রেক.*ইংলিশ|কোড\s*সুইচ.*ভাইব|কোড\s*সুইচিং)/u.test(lower))
    );
  }

  /**
   * Centralized detector for Real Human Feel, Clarity & Pronunciation Directive
   * Catches user prompt: "continue with more deep research cliarty and pronunciation tests to get real same like humen fieal when i talk with them"
   * and variants.
   */
  static isRealHumanFeelClarityPronunciationDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/\b(?:deep\s+research|research)\b/i.test(lower) && /\b(?:clarity|cliarty)\b/i.test(lower) && /\b(?:pronunciation|pronuncitation)\b/i.test(lower)) ||
      (/\b(?:real\s+human\s+feel|human\s+feel|humen\s+fieal|same\s+like\s+human|real\s+same\s+like\s+humen)\b/i.test(lower) && /\b(?:talk|speak|conversation|pronunciation|clarity|cliarty|fieal|feel)\b/i.test(lower)) ||
      (/\bcontinue\s+with\s+more\s+deep\s+research\b/i.test(lower) && /\b(?:clarity|cliarty|pronunciation|human|feel|fieal)\b/i.test(lower)) ||
      (/(?:ডিপ\s*রিসার্চ.*ক্ল্যারিটি|মানুষের\s*মতো.*ফিল|সঠিক\s*উচ্চারণ.*টেস্ট|রিয়েল\s*হিউম্যান\s*ফিল)/u.test(lower))
    );
  }

  /**
   * 2.206 Pin-by-Pin Micro-Audit, Deep Research & Subsystem Verification Directive (Law 44)
   * Handles:
   * "do ore test and research and update pini by pin test",
   * "Do more test and research and update pin-by-pin test",
   * "pin by pin test", "pini by pin test", "pin-by-pin deep research",
   * "do more test and research pin by pin"
   */
  static isPinByPinDeepTestResearchDirective(text = "") {
    if (!text || typeof text !== "string") return false;
    const lower = text.toLowerCase().trim();
    return (
      (/(?:pini?|pin)[- ]+(?:by|bi)[- ]+pin/i.test(lower)) ||
      (/(?:pin[- ]by[- ]pin|pini[- ]by[- ]pin)/i.test(lower)) ||
      (/(?:ore|more)\s+tests?\s+(?:and|\&)\s+(?:research|reaserch)\s+(?:and|\&)\s+(?:update|upade)/i.test(lower)) ||
      (/(?:do\s+)?(?:ore|more)\s+(?:test|tests|research)/i.test(lower) && /(?:pini?|pin)[- ]+(?:by|bi)[- ]+pin/i.test(lower)) ||
      (/(?:পিন[-\s]*বাই[-\s]*পিন|প্রতিটা[-\s]*পিন\s*ধরে\s*টেস্ট|পুঙ্খানুপুঙ্খ\s*রিসার্চ.*পিন|পিন[-\s]*বাই[-\s]*পিন\s*টেস্ট)/u.test(lower))
    );
  }
}

IntentParser.INTENTS = INTENTS;

module.exports = {
  IntentParser,
  INTENTS,
  isCityModernGirlToneDirective: IntentParser.isCityModernGirlToneDirective,
  isTukTukModernGirlBilingualParityDirective: IntentParser.isTukTukModernGirlBilingualParityDirective,
  isModelToneAndVoiceProficiencyDirective: IntentParser.isModelToneAndVoiceProficiencyDirective,
  isUniversalBilingualIdentityParityDirective: IntentParser.isUniversalBilingualIdentityParityDirective,
  isSelfLearningLoopDirective: IntentParser.isSelfLearningLoopDirective,
  isMultiConversationalBuildingVibeDirective: IntentParser.isMultiConversationalBuildingVibeDirective,
  isTestUpdateImprovementDirective: IntentParser.isTestUpdateImprovementDirective,
  isTukTukTeamLeaderCommunicationDirective: IntentParser.isTukTukTeamLeaderCommunicationDirective,
  isDeepResearchTestAndUpdateDirective: IntentParser.isDeepResearchTestAndUpdateDirective,
  isContinueDeepResearchDirective: IntentParser.isContinueDeepResearchDirective,
  isDeepResearchEquationalFixDirective: IntentParser.isDeepResearchEquationalFixDirective,
  isFuturistic2070HumanEmbodimentDirective: IntentParser.isFuturistic2070HumanEmbodimentDirective,
  isAcademic2070HumanGapDirective: IntentParser.isAcademic2070HumanGapDirective,
  isLatexFixOrAllIssuesDirective: IntentParser.isLatexFixOrAllIssuesDirective,
  isInstantResponseFastMessagesDirective: IntentParser.isInstantResponseFastMessagesDirective,
  isAutonomousSelfMedicPeerMeshDirective: IntentParser.isAutonomousSelfMedicPeerMeshDirective,
  isSoulDuplicationMismatchHardcodedFixDirective: IntentParser.isSoulDuplicationMismatchHardcodedFixDirective,
  isTukTukSingleHumanSoulNonInterchangeableDirective: IntentParser.isTukTukSingleHumanSoulNonInterchangeableDirective,
  isSingleRealVoiceNoMultiPersonalityDirective: IntentParser.isSingleRealVoiceNoMultiPersonalityDirective,
  isGeminiGroqZeroOverlapAutonomousCodeHealingDirective: IntentParser.isGeminiGroqZeroOverlapAutonomousCodeHealingDirective,
  isZeroHumanAgentGapEquationalDirective: IntentParser.isZeroHumanAgentGapEquationalDirective,
  isWireAllEquationsLiveDeepTestDirective: IntentParser.isWireAllEquationsLiveDeepTestDirective,
  isVision2070MasterCoderMedicDirective: IntentParser.isVision2070MasterCoderMedicDirective,
  isCombatExtremeNoiseHumanAuditoryDirective: IntentParser.isCombatExtremeNoiseHumanAuditoryDirective,
  isBanglaPersonRealTonePronunciationDirective: IntentParser.isBanglaPersonRealTonePronunciationDirective,
  isConversationalContinuationDirective: IntentParser.isConversationalContinuationDirective,
  isRemoveAllRoboticBehaviorDirective: IntentParser.isRemoveAllRoboticBehaviorDirective,
  isTukTukZeroBroGirlfriendToneDirective: IntentParser.isTukTukZeroBroGirlfriendToneDirective,
  isVisionZeroEgoCoderBrotherQuantumResearchDirective: IntentParser.isVisionZeroEgoCoderBrotherQuantumResearchDirective,
  isDeepConversationsFixAllDirective: IntentParser.isDeepConversationsFixAllDirective,
  isAutonomousMultimodalLearningDirective: IntentParser.isAutonomousMultimodalLearningDirective,
  isHumanCollabZoomPodcastProjectDirective: IntentParser.isHumanCollabZoomPodcastProjectDirective,
  isRealLifeHumanToneFluencyGapDirective: IntentParser.isRealLifeHumanToneFluencyGapDirective,
  isZeroFlickerPerfectVoiceUltraFastDirective: IntentParser.isZeroFlickerPerfectVoiceUltraFastDirective,
  is4AgentBilingualVoiceSmoothnessDirective: IntentParser.is4AgentBilingualVoiceSmoothnessDirective,
  isInstantVoiceReadinessParallelDirective: IntentParser.isInstantVoiceReadinessParallelDirective,
  isPinByPinDeepTestResearchDirective: IntentParser.isPinByPinDeepTestResearchDirective,
  isBanglaPronunciationCodeSwitchingDirective: IntentParser.isBanglaPronunciationCodeSwitchingDirective,
  isRealHumanFeelClarityPronunciationDirective: IntentParser.isRealHumanFeelClarityPronunciationDirective,
  isEquationalResearchUpdateAuditDirective: IntentParser.isEquationalResearchUpdateAuditDirective,
  isBanglaTalkNeuralOverlapDirective: IntentParser.isBanglaTalkNeuralOverlapDirective,
  isZeroLoopEquationalWiringAuditDirective: IntentParser.isZeroLoopEquationalWiringAuditDirective,
  isSmoothInstantPipelineAuditDirective: IntentParser.isSmoothInstantPipelineAuditDirective,
  isDeepTestDriveEquationalFixDirective: IntentParser.isDeepTestDriveEquationalFixDirective,
  isBanglishDefaultCodeMixedTukTukToneDirective: IntentParser.isBanglishDefaultCodeMixedTukTukToneDirective,
  isFullDuplexMidTalkCaptureDirective: IntentParser.isFullDuplexMidTalkCaptureDirective,
  isRemovePureBanglaBanglishDefaultInstantResponsesDirective: IntentParser.isRemovePureBanglaBanglishDefaultInstantResponsesDirective,
  isBanglishModernVibeSameSoulDirective: IntentParser.isBanglishModernVibeSameSoulDirective,
  isRemoveBanglaInterruptedSingleSoulDirective: IntentParser.isRemoveBanglaInterruptedSingleSoulDirective,
  isRemoveOtherVersionsAndSortsDirective: IntentParser.isRemoveOtherVersionsAndSortsDirective,
  isFixBengaliLanguageDirective: IntentParser.isFixBengaliLanguageDirective,
  isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective: IntentParser.isRemovePureBanglaModernBanglishTukTukSoloVoiceDirective,
  isRemoveSingleBanglaTalkPureSoulPersonalityPersonDirective: IntentParser.isRemoveSingleBanglaTalkPureSoulPersonalityPersonDirective,
  isRemoveScriptedSameLoopTalkZeroLoopingDirective: IntentParser.isRemoveScriptedSameLoopTalkZeroLoopingDirective,
  isRemoveScriptedRepeatedTalksDirective: IntentParser.isRemoveScriptedRepeatedTalksDirective,
  isRemoveKhatiMistiSingleRealHumanVoiceDirective: IntentParser.isRemoveKhatiMistiSingleRealHumanVoiceDirective
};
