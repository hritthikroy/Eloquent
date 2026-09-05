/**
 * TextSanitizer
 * Cleans speech-to-text artifacts, phonetic mishearings, and normalizes developer terms
 */

class TextSanitizer {
  static sanitize(rawText) {
    if (!rawText || typeof rawText !== "string") return "";

    let text = rawText.trim();

    // 1. Phonetic speech-to-text corrections
    text = text
      .replace(/\band you\b(?=\s+(?:check|modify|write|tell|see|look|help|code|build|refactor|take|run|fix|draft|craft|inspect|smooth))/gi, "Vision")
      .replace(/\b(?:vi\s*sion|vishon)\b/gi, "Vision")
      .replace(/\b(?:entry|enter|anti)\s*gravity\b/gi, "Antigravity")
      .replace(/\b(?:took\s*took|tok\s*tok|tuck\s*tuck)\b/gi, "Tuk Tuk")
      .replace(/\b(?:on this course)\b/gi, "on this code")
      .replace(/\b(?:ast\s*tree)\b/gi, "AST")
      .replace(/\b(?:j\s*s)\b/gi, "JavaScript")
      .replace(/\b(?:t\s*s)\b/gi, "TypeScript")
      // Bayesian Acoustic Phonetic Corrections for Banglish & Voice Feedback
      .replace(/\b(?:bang\s+naprononcio\s+siya[,\s]*tikoro)\b/gi, "Bangla pronunciation thik koro")
      .replace(/\b(?:naprononcio\s*siya|naprononcio)\b/gi, "pronunciation")
      .replace(/\b(?:unicorius)\b/gi, "unicode use")
      .replace(/\b(?:tonta\s*tiko)\b/gi, "tone-ta thik")
      .replace(/\b(?:chou\s*na\s*sound)\b/gi, "shona sound")
      .replace(/\b(?:bep\s+bang\s+lego(?:\s+thai)?)\b/gi, "babe bangla-te")
      .replace(/\b(?:komenemoto)\b/gi, "konobhabei")
      .replace(/\b(?:tummar\s*boi)\b/gi, "tomar voice")
      .replace(/\b(?:thik\s*la\s*chena)\b/gi, "thik lagche na")
      .replace(/\b(?:bablo)\b/gi, "babe")
      .replace(/\b(?:bangal\s*comunication|bangal\s*communication)\b/gi, "Bangla communication")
      .replace(/\b(?:bangal\s*fluency)\b/gi, "Bangla fluency")
      .replace(/\b(?:bangal\s*(?:kotha|bhasha))\b/gi, "Bangla bhasha")
      .replace(/\b(?:thas\s+it)\b/gi, "that's it")
      .replace(/\b(?:sarvam\s+api)\b/gi, "Sarvam API")
      .replace(/\b(?:roboter\s+mahti)\b/gi, "roboter moto")
      .replace(/\b(?:baro\s+repeat|baro\s*,\s*repeat)\b/gi, "bar bar repeat")
      .replace(/\b(?:smart\s+galer)\b/gi, "smart girl-er")
      .replace(/\b(?:reportar)\b/gi, "reporter")
      .replace(/\b(?:bangladesi|bangaldeshi)\b/gi, "Bangladeshi")
      .replace(/\b(?:vilage\s+girl)\b/gi, "village girl")
      .replace(/\b(?:henni\s+jake)\b/gi, "nijeke")
      .replace(/\b(?:anador\s*kar)\b/gi, "ana dorkar")
      .replace(/\b(?:banglai\s*fluency)\b/gi, "Bangla fluency")
      .replace(/\b(?:repet|reppet)\b/gi, "repeat")
      .replace(/\b(?:humen)\b/gi, "human")
      .replace(/\b(?:again\s+again)\b/gi, "again and again")
      .replace(/\b(?:robotik\s*gaps?|robotic\s*gap)\b/gi, "robotic gaps")
      .replace(/\b(?:both\s*working\s*languages?)\b/gi, "both working languages")
      // STT acoustic collisions for agent delegation and Banglish terms
      .replace(/\b(?:the\s+)?television(?=\s+(?:to|the|write|fix|check|run|code|look|help|listen|bro|brother|bhai|problem|error|issue|status))\b/gi, "Tell Vision")
      .replace(/\b(?:tell\s+)?television\b/gi, "Tell Vision")
      .replace(/\b(?:tell\s+)?dj\b/gi, "Tell Jenny")
      .replace(/\btabul\s+da(?:\s+chai)?\b/gi, "table-ta chai")
      .replace(/\btabul\s+da\b/gi, "table-ta")
      .replace(/\b(?:bing\s+ni\s+op|bing\s+it\s+op)\b/gi, "bring it up")
      .replace(/\b(?:mgmc|mcmc)\b/gi, "Tuk Tuk")
      .replace(/\b(?:deem[,\s]+simplici\s+by\s+putting\s+the)\b/gi, "simplify by putting the")
      // Whisper STT glued agent token un-gluing (e.g. Visionfix -> Vision fix, Visionto -> Vision to, Visionchecking -> Vision checking)
      .replace(/\bvision(?=(?:fix|check|to|run|test|code|audit|listen|see|look|help|is|can|are|ing))\b/gi, "Vision ")
      .replace(/\bvisionchecking\b/gi, "Vision checking")
      .replace(/\bvisionto\b/gi, "Vision to")
      .replace(/\bvisionfix\b/gi, "Vision fix")
      .replace(/\bjenny(?=(?:has|is|can|check|search|tell|do|think|run))\b/gi, "Jenny ")
      .replace(/\b(?:denny|danny|genny|danni)\b/gi, "Jenny")
      .replace(/\b(?:jey|jeni)\b(?=[\s,.]|$)/gi, "Jenny")
      // Phonetic speech-to-text corrections for conversational Bengali / Banglish
      .replace(/\b(?:kothe\s*bolo|kothe\s*re\s*koro)\b/gi, "kotha bolo")
      .replace(/\b(?:kothe\s*re)\b/gi, "kotha record")
      .replace(/\btaro\s*smooth\b/gi, "aro smooth")
      .replace(/\b(?:kothe)\b(?=\s*(?:type|bolo|bolte|gula|ta))/gi, "kotha")
      .replace(/\baamadher\b/gi, "amader")
      .replace(/\bbapbe\b/gi, "bhabe")
      .replace(/\bni\s*iqt\b/gi, "niye ektu")
      // Reel, music companion & human-like watching STT acoustic corrections
      .replace(/\b(?:movile\s*reel|mobail\s*reel)\b/gi, "mobile reel")
      .replace(/\bmovile\b/gi, "mobile")
      .replace(/\b(?:nt\s*lisent|nt\s*listen)\b/gi, "not listen")
      .replace(/\blisent\s*music\b/gi, "listen to music")
      .replace(/\blisent\b/gi, "listen")
      .replace(/\bwatching\s+need\s+like\s+a\s+human\b/gi, "watch like a human")
      .replace(/\bwatching\s+need\b/gi, "watch")
      .replace(/\bmy\s+gf\s+not\s+see\s+with\s+me\b/gi, "my gf does not see with me")
      // Whisper STT mishearing normalizations from live conversation audit
      .replace(/\b(?:borgla|bongla|borngla|bengala)\b/gi, "Bangla")
      .replace(/\b(?:bangla\s+puke[,\s]*koro)\b/gi, "Bangla shuru koro")
      .replace(/\b(?:buste\s+pari\s+ni|buz\s+te\s+perechova)\b/gi, "bujhte parini")
      .replace(/\b(?:kakal\s+ke\s+rat\s+rath\s+re)\b/gi, "kal ke raate")
      .replace(/\b(?:demon\s+mo\s+toh|demon\s+moto)\b/gi, "temon moto")
      .replace(/\b(?:eda\s+na|eta\s+na\s+aabharbois)\b/gi, "eta na abar voice")
      .replace(/\b(?:aabharbois)\b/gi, "abar voice")
      .replace(/\b(?:wilihan[,\s]*pete\s*koro)\b/gi, "workflow check koro")
      .replace(/\ba\s+tuk\s+sound[,\s]*smart\s+girl\b/gi, "Tuk Tuk smart girl");

    // 2. Remove speech disfluency and stutters (preserving intentional grammatical reduplication like 'bar bar', 'dhire dhire')
    text = text
      .replace(/\b(?:um|uh|er|ah)\b/gi, "")
      .replace(/\b(?!(?:bar|dhire|choto|gorom|shob|ek|bhalo|ki)\b)(\w+)\s+\1\b/gi, "$1") // De-duplicate accidental stutters while keeping Bengali reduplication
      .replace(/\s+/g, " ")
      .trim();

    // 3. Normalize punctuation and casing
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    return text;
  }
}

function sanitizeWrapper(rawText) {
  return TextSanitizer.sanitize(rawText);
}
Object.assign(sanitizeWrapper, TextSanitizer);
sanitizeWrapper.sanitize = TextSanitizer.sanitize.bind(TextSanitizer);
sanitizeWrapper.TextSanitizer = TextSanitizer;

module.exports = sanitizeWrapper;
