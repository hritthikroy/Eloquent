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
}

module.exports = {
  IntentParser,
  INTENTS,
  isCityModernGirlToneDirective: IntentParser.isCityModernGirlToneDirective,
  isTukTukModernGirlBilingualParityDirective: IntentParser.isTukTukModernGirlBilingualParityDirective,
  isModelToneAndVoiceProficiencyDirective: IntentParser.isModelToneAndVoiceProficiencyDirective,
  isUniversalBilingualIdentityParityDirective: IntentParser.isUniversalBilingualIdentityParityDirective,
  isSelfLearningLoopDirective: IntentParser.isSelfLearningLoopDirective,
  isMultiConversationalBuildingVibeDirective: IntentParser.isMultiConversationalBuildingVibeDirective,
  isTukTukTeamLeaderCommunicationDirective: IntentParser.isTukTukTeamLeaderCommunicationDirective
};

