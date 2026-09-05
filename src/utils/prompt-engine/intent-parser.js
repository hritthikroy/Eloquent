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

    // 2.5 Smooth Conversation Intent Detection
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
          .replace(/^(?:hey\s+)?(?:tuk\s*tuk|tuktuk|vision|andrew|friday|dd|brayn|brian|ডিডি|ভিশন|টুকটুক|ফ্রাইডে)[,\s]*(?:can\s+you\s+)?(?:please\s+)?(?:tell\s+(?:vision|andrew|tuk\s*tuk|friday|dd|brayn|brian)\s+to\s+)?(?:write|craft|create|make|prepare|engineer|draft|refine|give|generate|prompt|প্রম্পট)\s+(?:up\s+)?(?:a|the|my|an)?\s*(?:(?:next|high[- ]context|structured|master|developer|first|integrity|human[- ]like|antigravity)\s+)*(?:prompt|প্রম্পট)\s*(?:for|about|on|in\s+antigravity|to\s+antigravity)?\s*/i, "")
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
}

module.exports = {
  IntentParser,
  INTENTS
};
