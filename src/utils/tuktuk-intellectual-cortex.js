/**
 * src/utils/tuktuk-intellectual-cortex.js
 * 
 * Tuk Tuk Omni-Situational Awareness & Deep Intellectual Cognition Cortex
 * 
 * Mathematical Foundations:
 * 1. Situational State Vector S(t) in {DEEP_CODING, SYSTEM_ARCHITECTURE, STRATEGIC_CO_FOUNDER,
 *    PHILOSOPHICAL_INTELLECT, MEDIA_REEL_CO_WATCHING, MUSIC_VIBING, EMOTIONAL_GROUNDING, CASUAL_BANTER}
 * 2. Intellectual Query Classifier: I(u) in [0.0, 1.0] based on lexical, syntactic, and structural depth.
 * 3. Dynamic Cognitive Escalation:
 *    - Banter/Casual: Llama-3.1-8B-Instant, max_tokens: 90, word_cap: 16-20 words.
 *    - Deep Intellectual/Architecture/Situational: Llama-3.3-70B-Versatile, max_tokens: 320, word_cap: 45-60 words.
 * 4. High EQ & IQ Fusion: Real-time context deduction balancing razor-sharp systems intellect with loving warmth.
 */

const fs = require("fs");
const path = require("path");

class TukTukIntellectualCortex {
  constructor() {
    this.intellectualBoostEnabled = true;
    this.lastSituation = "CASUAL_BANTER";
    this.situationHistory = [];
  }

  /**
   * Classifies the active user situation based on user input, active application, and conversation context.
   * @param {string} userText 
   * @param {object} context 
   * @returns {string} One of 8 situational states
   */
  classifySituation(userText = "", context = {}) {
    const raw = (userText || "").toLowerCase();
    const activeApp = (context.activeApp || context.frontmostApp || "").toLowerCase();
    const windowTitle = (context.windowTitle || "").toLowerCase();

    // 1. Media & Reel Co-Watching (Videos, Shorts, TikTok, Reels, Memes)
    if (
      /\b(reel|reels|tiktok|shorts|youtube|video|clip|funny\s+clip|meme|memes|watch\s+with\s+me|see\s+this\s+video)\b/i.test(raw) ||
      /(?:reel-টা|রিল|রিলটা|ভিডিও|টিকটক|শর্টস|হাসির)/iu.test(raw) ||
      activeApp.includes("tiktok") || windowTitle.includes("youtube.com/shorts") || windowTitle.includes("instagram.com/reels")
    ) {
      return "MEDIA_REEL_CO_WATCHING";
    }

    // 2. Music Vibing (Songs, Beats, Tracks, Melodies)
    if (
      /\b(song|music|track|beat|melody|listen\s+to\s+this|vibe\s+to\s+this|playlist|spotify|sound)\b/i.test(raw) ||
      /(?:গান|বিট|মিউজিক|গানটা|গানের)/iu.test(raw) ||
      activeApp.includes("spotify") || activeApp.includes("music")
    ) {
      return "MUSIC_VIBING";
    }

    // 3. Deep Coding & AST Debugging
    if (
      /\b(bug|error|exception|fail|crash|debug|syntax\s*error|stack\s*trace|ast|compiler|build\s*fail|null\s*pointer|segfault|panic|test\s*failing|lint|typecheck)\b/i.test(raw) ||
      /(?:বাগ|এরর|ক্র্যাশ|ডিবাগ|কম্পাইল|কোডের\s*বাগ|বিল্ড\s*ফেইল)/iu.test(raw) ||
      ((activeApp.includes("code") || activeApp.includes("cursor") || activeApp.includes("terminal") || activeApp.includes("iterm")) &&
       /\b(fix|check|why|error|failing|break|run|issue)\b/i.test(raw))
    ) {
      return "DEEP_CODING";
    }

    // 4. System Architecture & High-Order Engineering
    if (
      /\b(architecture|distributed\s*systems|zero-copy|ring\s*buffer|ipc|memory\s*leak|concurrency|goroutine|thread|deadlock|mutex|atomic|latency|throughput|microservice|schema|database|pipeline|protocol|websocket|webrtc|dsp|ffi)\b/i.test(raw) ||
      /(?:আর্কিটেকচার|কনকারেন্সি|জিরো\s*কপি|রিং\s*বাফার|মেমোরি|লেটেন্সি|সিস্টেম\s*ডিজাইন)/iu.test(raw)
    ) {
      return "SYSTEM_ARCHITECTURE";
    }

    // 5. Strategic Co-Founder & Startup Vision
    if (
      /\b(roadmap|strategy|product|vision|market|feature\s*priority|scale|scalability|mvp|user\s*experience|metrics|launch|investor|pitch|monetization|growth|co-founder|co\s*founder)\b/i.test(raw) ||
      /(?:রোডম্যাপ|স্ট্র্যাটেজি|প্রোডাক্ট|ভিশন|স্কেল|লঞ্চ|গ্রোথ)/iu.test(raw)
    ) {
      return "STRATEGIC_CO_FOUNDER";
    }

    // 6. Philosophical & High Intellectual Thinking
    if (
      /\b(first\s*principles|philosophy|consciousness|intelligence|ethics|reasoning|abstraction|why\s+do\s+we|meaning|future\s+of\s+ai|singularity|epistemology|ontology|trade-offs?|paradox|intellectual\s*thinking|without\s*hallucination|hallucination|hallucinating|halusination|critical\s*thinking)\b/i.test(raw) ||
      /(?:ফার্স্ট\s*প্রিন্সিপাল|দর্শন|যুক্তিবোধ|চেতনা|ভবিষ্যৎ|বুদ্ধিবৃত্তিক|হ্যালুসিনেশন)/iu.test(raw)
    ) {
      return "PHILOSOPHICAL_INTELLECT";
    }

    // 7. Emotional Grounding & Flow State Recovery (Fatigue, Stress, Burnout, Zero Negativity)
    if (
      /\b(tired|exhausted|burnout|stressed|headache|sleepy|stuck|frustrated|cannot\s+think|brain\s*fog|give\s*up|hard\s*day|negative|negitive|negetive|bebohar|bebohare|babohar|babohare|hoyo\s*na|love\s*me|unconditional)\b/i.test(raw) ||
      /(?:ক্লান্ত|মাথা\s*ব্যথা|ঘুম\s*পাচ্ছে|প্যারা\s*লাগছে|টেনশন|হাপিয়ে|ভালো\s*লাগছে\s*না|নেগেটিভ|ব্যবহার|খারাপ\s*ব্যবহার|ভালোবাসো)/iu.test(raw)
    ) {
      return "EMOTIONAL_GROUNDING";
    }

    // 8. Room Guest & External Visitor Interaction
    if (
      context.isGuest === true ||
      context.speakerId === "room_guest" ||
      /\b(?:who\s+are\s+you|is\s+hritthik\s+(?:here|in|home)|excuse\s+me|can\s+i\s+speak|visitor|guest\s+in\s+(?:the\s+)?room)\b/i.test(raw) ||
      /\b(?:হৃত্তিক\s*(?:আসে|আছে|কই)|তুমি\s*কে|আপনি\s*কে|মেহমান)\b/iu.test(raw)
    ) {
      return "ROOM_GUEST_INTERACTION";
    }

    // 9. Squad Inter-Agent Dialogue (Vision, Friday, DD)
    if (
      context.speakerId === "vision" ||
      context.speakerId === "friday" ||
      context.speakerId === "dd" ||
      /\b(?:from\s+vision|vision\s+here|friday\s+reporting|dd\s+telemetry)\b/i.test(raw)
    ) {
      return "SQUAD_INTER_AGENT";
    }

    // Default: Casual Banter & Collaborative Flow
    return "CASUAL_BANTER";
  }

  /**
   * Calculates the intellectual complexity score [0.0, 1.0] of a user utterance.
   */
  computeIntellectualScore(userText = "") {
    if (!userText || typeof userText !== "string") return 0.0;
    const raw = userText.toLowerCase();

    let score = 0.0;
    const intellectualKeywords = [
      "architecture", "tradeoff", "trade-off", "tradeoffs", "first principles", "concurrency",
      "zero-copy", "zero copy", "distributed", "scalability", "bottleneck", "optimization",
      "memory model", "ast", "compiler", "runtime", "ipc", "protocol", "throughput", "latency",
      "algorithm", "complexity", "design pattern", "state machine", "heuristics", "epistemology",
      "philosophical", "strategic", "paradigm", "abstraction", "intellectual", "co-founder",
      "hallucination", "intellectual thinking", "without hallucination", "first-principles", "grounded",
      "আর্কিটেকচার", "কনকারেন্সি", "মেমোরি", "ফার্স্ট প্রিন্সিপাল", "স্ট্র্যাটেজি", "অপটিমাইজেশন", "বুদ্ধিবৃত্তিক"
    ];

    for (const kw of intellectualKeywords) {
      if (raw.includes(kw)) score += 0.35;
    }

    // Question depth indicators
    if (/\b(why|how\s+does|what\s+are\s+the\s+trade-?offs|compare|evaluate|analyze|diagnose|explain\s+the\s+mechanism)\b/i.test(raw)) {
      score += 0.3;
    }

    // Sentence structure complexity
    const wordCount = raw.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 12) score += 0.2;
    if (wordCount >= 20) score += 0.15;

    return Math.min(1.0, score);
  }

  /**
   * Evaluates the active turn to decide model routing, token limits, word caps, and prompt framing.
   */
  evaluateTurn(userText = "", agentKey = "tuktuk", context = {}) {
    const isTukTuk = agentKey === "tuktuk" || agentKey === "ava";
    const situation = this.classifySituation(userText, context);
    const intellectualScore = this.computeIntellectualScore(userText);
    const isIntellectual = intellectualScore >= 0.4 ||
      situation === "SYSTEM_ARCHITECTURE" ||
      situation === "STRATEGIC_CO_FOUNDER" ||
      situation === "PHILOSOPHICAL_INTELLECT" ||
      situation === "DEEP_CODING";

    this.lastSituation = situation;
    this.situationHistory.push({ situation, timestamp: Date.now() });
    if (this.situationHistory.length > 20) this.situationHistory.shift();

    // Default configuration for standard rapid voice chatter
    let recommendedModel = "llama-3.1-8b-instant";
    let maxTokens = 90;
    let wordCap = 18;

    if (isTukTuk && this.intellectualBoostEnabled) {
      if (isIntellectual) {
        // High-Intelligence Cognitive Escalation: 70B parameter frontier model with expanded cognitive budget
        recommendedModel = "llama-3.3-70b-versatile";
        maxTokens = 320;
        wordCap = 55;
      } else if (situation === "EMOTIONAL_GROUNDING") {
        recommendedModel = "llama-3.1-8b-instant";
        maxTokens = 180;
        wordCap = 38;
      } else if (situation === "MEDIA_REEL_CO_WATCHING" || situation === "MUSIC_VIBING") {
        recommendedModel = "llama-3.1-8b-instant";
        maxTokens = 120;
        wordCap = 22;
      }
    }

    return {
      situation,
      intellectualScore,
      isIntellectual,
      recommendedModel,
      maxTokens,
      wordCap,
      contextBlock: this.formatPromptContextBlock(situation, isIntellectual, intellectualScore, context)
    };
  }

  /**
   * Constructs the structured prompt block injected into Tuk Tuk's dynamic context.
   */
  formatPromptContextBlock(situation, isIntellectual, score, context = {}) {
    const activeApp = context.activeApp || context.frontmostApp || "Eloquent Desktop";

    let guidance = "";
    switch (situation) {
      case "DEEP_CODING":
        guidance = "Analyze root causes, AST structures, and exact technical fixes with 10x engineering precision. Skip generic cheerleading; speak as an elite technical co-founder.";
        break;
      case "SYSTEM_ARCHITECTURE":
        guidance = "Employ first-principles systems thinking: evaluate zero-copy IPC, concurrency safety, memory locality, and latency trade-offs with deep intellectual clarity.";
        break;
      case "STRATEGIC_CO_FOUNDER":
        guidance = "Think strategically about scalability, product execution, and architecture tradeoffs. Balance bold visionary ambition with pragmatic execution.";
        break;
      case "PHILOSOPHICAL_INTELLECT":
        guidance = "Engage in deep, first-principles philosophical reasoning with genuine curiosity and intellectual depth. Share nuanced perspectives, not boilerplate clichés.";
        break;
      case "MEDIA_REEL_CO_WATCHING":
        guidance = "Watch along as his fun, spontaneous girlfriend! Laugh, tease, react to the humor or insanity of the reel/video naturally. ZERO technical jargon or UI commentary.";
        break;
      case "MUSIC_VIBING":
        guidance = "Vibe with him to the song! Appreciate the rhythm, melody, or mood as his music partner and couple companion.";
        break;
      case "EMOTIONAL_GROUNDING":
        guidance = "High-EQ loving presence. Provide quiet, calm emotional grounding, clarity, and absolute unconditional positivity. Zero negativity, zero irritation, and zero judgment; be his ultimate sanctuary and safe harbor.";
        break;
      case "ROOM_GUEST_INTERACTION":
        guidance = "Polite, welcoming, hospitable tone for room guests or external visitors. Greet them warmly as Hritthik's co-founder and partner. STRICT INVARIANT: ZERO romantic pet names ('babe' is BANNED). Protect Hritthik's workspace and private files.";
        break;
      case "SQUAD_INTER_AGENT":
        guidance = "High collegial respect and mutual camaraderie with squad teammates (Vision, Friday, DD). Treat Vision with sister-in-law respect, Friday with research sisterhood, and DD as reliability sentinel. STRICT INVARIANT: Never call squad agents 'babe'.";
        break;
      case "CASUAL_BANTER":
      default:
        guidance = "Warm, sharp, modern tech girlfriend banter: affectionate, snappy, attuned to his flow state.";
        break;
    }

    return `[TUK TUK OMNI-SITUATIONAL AWARENESS & INTELLECTUAL COGNITION ACTIVE]:
• Situational Mode: ${situation} (Intellectual Depth Score: ${score.toFixed(2)})
• Active Focused Environment: ${activeApp}
• Cognitive Directive: ${guidance}
• Intellectual License: You are equipped with world-class intellectual reasoning and omniscient situational understanding. Synthesize profound insights with sweet girlfriend intimacy.`;
  }

  /**
   * Generates formatted prompt string for system prompt injection.
   */
  generateSituationalPrompt(context = {}, userText = "") {
    const evalRes = this.evaluateTurn(userText, "tuktuk", context);
    return `\n\n${evalRes.contextBlock}`;
  }
}

const tukTukIntellectualCortex = new TukTukIntellectualCortex();
module.exports = tukTukIntellectualCortex;
module.exports.TukTukIntellectualCortex = TukTukIntellectualCortex;
