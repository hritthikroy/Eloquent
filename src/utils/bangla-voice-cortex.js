/**
 * src/utils/bangla-voice-cortex.js
 * 
 * ==============================================================================
 * 🌸 BANGLA VOICE CORTEX: High-Fidelity Human Voice Smoothing & Prosodic Cadence
 * ==============================================================================
 * 
 * Mathematical & Acoustic Foundations:
 * 1. Syllable-Timed Isosyllabic Meter (Hayes & Lahiri, 1991):
 *    Bengali is a syllable-timed language where each syllable receives relatively equal
 *    duration, unlike stress-timed English. Standard English TTS rate causes polysyllabic
 *    agglutinative Bengali words ("কানেকশনে", "রেসপন্সিবল", "আর্কিটেকচার") to blur and rush.
 *    Adapting rate to -3% to -4% grants clear acoustic formant separation.
 * 2. Fundamental Frequency F0 Declination & Breath Boundaries (t' Hart et al., 1990):
 *    Stripping sentence-final punctuation causes flat pitch contours and breathless rushing.
 *    Transforming Bengali Dari (।) into acoustic clause boundaries (. ) triggers natural
 *    pitch declination and 180-220ms natural breathing pauses.
 * 3. Cross-Linguistic Code-Switching Harmonization (Muysken, 2000):
 *    Converting 120+ English technical and conversational loanwords into Bengali Unicode phonetics
 *    prevents multilingual neural acoustic models (AvaMultilingualNeural) from switching phoneme
 *    inventories mid-phrase, eliminating stutter and acoustic glitches.
 * 4. High-Fidelity Conjunct Romanization (for monolingual fallbacks):
 *    Properly maps ya-phala (্য), ksha (ক্ষ), ref (র্), jna (জ্ঞ), and conjunct clusters
 *    to natural English syllables ("gyap" instead of "gjap", "status", "architecture").
 * 5. Studio Acoustic Warmth & De-Essing (Mastering Filter):
 *    Equalizes 220Hz (+1.2 dB) chest warmth and softens 4.2kHz (-1.5 dB) sibilance
 *    on Bengali "sh" (শ/ষ/স) phonemes with 3ms anti-click micro-envelopes.
 */

class BanglaVoiceCortex {
  constructor() {
    this.isActive = true;
    this.defaultRateOffset = "-4%";
    this.defaultPitchOffset = "+1Hz";

    // 120+ High-Frequency English Loanwords in Tech, System, and Conversational Bengali
    this.loanwordMap = [
      // Voice, Audio, and Smoothness Terms
      [/\bsmoothly\b/gi, "স্মুথলি"],
      [/\bsmooth(?:er)?\b/gi, "স্মুথ"],
      [/\bvoices?\b/gi, "ভয়েস"],
      [/\bsounds?\b/gi, "সাউন্ড"],
      [/\baudio\b/gi, "অডিও"],
      [/\bspeech\b/gi, "স্পিচ"],
      [/\bcalls?\b/gi, "কল"],
      [/\btalks?\b/gi, "টক"],
      [/\bchats?\b/gi, "চ্যাট"],
      [/\binstant\b/gi, "ইনস্ট্যান্ট"],
      [/\breplays?\b/gi, "রিপ্লে"],
      [/\brepl(?:y|ies)\b/gi, "রিপ্লাই"],
      [/\bresponses?\b/gi, "রেসপন্স"],
      [/\bdelays?\b/gi, "ডিলে"],
      [/\bthinking\b/gi, "থিঙ্কিং"],

      // Multi-Agent & Squad Concepts
      [/\bagents?\b/gi, "এজেন্ট"],
      [/\bteams?\b/gi, "টিম"],
      [/\bsquads?\b/gi, "স্কোয়াড"],
      [/\bbrothers?\b/gi, "ব্রাদার"],
      [/\bsisters?\b/gi, "সিস্টার"],
      [/\bbros?\b/gi, "ব্রো"],
      [/\bboss\b/gi, "বস"],
      [/\bleaders?\b/gi, "লিডার"],
      [/\bfounders?\b/gi, "ফাউন্ডার"],
      [/\bpartners?\b/gi, "পার্টনার"],
      [/\bsoul\b/gi, "সোল"],
      [/\bbonding\b/gi, "বন্ডিং"],
      [/\bbonds?\b/gi, "বন্ড"],
      [/\bco-?founders?\b/gi, "কো-ফাউন্ডার"],

      // Automation & System Architecture
      [/\bautomations?\b/gi, "অটোমেশন"],
      [/\blevels?\b/gi, "লেভেল"],
      [/\bsystems?\b/gi, "সিস্টেম"],
      [/\bconnections?\b/gi, "কানেকশন"],
      [/\bgaps?\b/gi, "গ্যাপ"],
      [/\bzeros?\b/gi, "জিরো"],
      [/\blatenc(?:y|ies)\b/gi, "লেটেন্সি"],
      [/\bbenchmarks?\b/gi, "বেঞ্চমার্ক"],
      [/\bscores?\b/gi, "স্কোর"],
      [/\bpoints?\b/gi, "পয়েন্ট"],
      [/\bpipelines?\b/gi, "পাইপলাইন"],
      [/\barchitectures?\b/gi, "আর্কিটেকচার"],
      [/\bmodules?\b/gi, "মডিউল"],
      [/\bworkflows?\b/gi, "ওয়ার্কফ্লো"],
      [/\bprompts?\b/gi, "প্রম্পট"],
      [/\bscripts?\b/gi, "স্ক্রিপ্ট"],
      [/\bbuffers?\b/gi, "বাফার"],
      [/\bmemor(?:y|ies)\b/gi, "মেমরি"],
      [/\bheaps?\b/gi, "হিপ"],
      [/\bprocess(?:es)?\b/gi, "প্রসেস"],
      [/\bthreads?\b/gi, "থ্রেড"],
      [/\bdaemons?\b/gi, "ডেমন"],
      [/\bservers?\b/gi, "সার্ভার"],
      [/\bclients?\b/gi, "ক্লায়েন্ট"],
      [/\bnetworks?\b/gi, "নেটওয়ার্ক"],
      [/\bports?\b/gi, "পোর্ট"],
      [/\btokens?\b/gi, "টোকেন"],
      [/\bdatabases?\b/gi, "ডাটাবেজ"],
      [/\bdata\b/gi, "ডাটা"],
      [/\blogs?\b/gi, "লগ"],

      // Developer Actions & Version Control
      [/\bbuilds?\b/gi, "বিল্ড"],
      [/\bruns?\b/gi, "রান"],
      [/\bchecks?\b/gi, "চেক"],
      [/\bfix(?:es)?\b/gi, "ফিক্স"],
      [/\btests?\b/gi, "টেস্ট"],
      [/\bpush(?:es)?\b/gi, "পুশ"],
      [/\bpulls?\b/gi, "পুল"],
      [/\bcommits?\b/gi, "কমিট"],
      [/\bmerges?\b/gi, "মার্জ"],
      [/\bdeploys?\b/gi, "ডিপ্লয়"],
      [/\bships?\b/gi, "শিপ"],
      [/\bstarts?\b/gi, "স্টার্ট"],
      [/\bstops?\b/gi, "স্টপ"],
      [/\bupdates?\b/gi, "আপডেট"],
      [/\bupgrades?\b/gi, "আপগ্রেড"],
      [/\brestarts?\b/gi, "রিস্টার্ট"],
      [/\bconnects?\b/gi, "কানেক্ট"],
      [/\breviews?\b/gi, "রিভিউ"],
      [/\bpatch(?:es)?\b/gi, "প্যাচ"],
      [/\bdebug(?:ging)?\b/gi, "ডিবাগ"],
      [/\btracks?\b/gi, "ট্র্যাক"],
      [/\blocked\b/gi, "লকড"],
      [/\blocks?\b/gi, "লক"],
      [/\bcodes?\b/gi, "কোড"],
      [/\bfeatures?\b/gi, "ফিচার"],
      [/\bterminals?\b/gi, "টার্মিনাল"],
      [/\bscreens?\b/gi, "স্ক্রিন"],
      [/\berrors?\b/gi, "এরর"],
      [/\bbugs?\b/gi, "বাগ"],
      [/\bglitch(?:es)?\b/gi, "গ্লিচ"],
      [/\bissues?\b/gi, "ইস্যু"],
      [/\bstatus\b/gi, "স্ট্যাটাস"],
      [/\bfiles?\b/gi, "ফাইল"],
      [/\bpackages?\b/gi, "প্যাকেজ"],
      [/\bversions?\b/gi, "ভার্সন"],
      [/\blibrar(?:y|ies)\b/gi, "লাইব্রেরি"],
      [/\btools?\b/gi, "টুল"],
      [/\bbranch(?:es)?\b/gi, "ব্রাঞ্চ"],
      [/\brepos?\b/gi, "রেপো"],
      [/\boutputs?\b/gi, "আউটপুট"],
      [/\binputs?\b/gi, "ইনপুট"],
      [/\blogic\b/gi, "লজিক"],
      [/\bmilestones?\b/gi, "মাইলস্টোন"],
      [/\broadmaps?\b/gi, "রোডম্যাপ"],
      [/\bframeworks?\b/gi, "ফ্রেমওয়ার্ক"],
      [/\blines?\b/gi, "লাইন"],

      // UI & Hardware Terms
      [/\bbrowsers?\b/gi, "ব্রাউজার"],
      [/\bclicks?\b/gi, "ক্লিক"],
      [/\bwindows?\b/gi, "উইন্ডো"],
      [/\bdesktops?\b/gi, "ডেস্কটপ"],
      [/\bkeyboards?\b/gi, "কীবোর্ড"],
      [/\bmouses?\b/gi, "মাউস"],
      [/\bscroll(?:ing)?\b/gi, "স্ক্রোল"],
      [/\bmodes?\b/gi, "মোড"],
      [/\bstates?\b/gi, "স্টেট"],
      [/\bmachines?\b/gi, "মেশিন"],
      [/\bmetrics?\b/gi, "মেট্রিক"],
      [/\bdisplays?\b/gi, "ডিসপ্লে"],
      [/\blaptops?\b/gi, "ল্যাপটপ"],
      [/\bmobiles?\b/gi, "মোবাইল"],
      [/\bphones?\b/gi, "ফোন"],
      [/\bapps?\b/gi, "অ্যাপ"],

      // Conversational & Emotion Descriptors
      [/\breal\b/gi, "রিয়েল"],
      [/\bhuman\b/gi, "হিউম্যান"],
      [/\brobots?\b/gi, "রোবট"],
      [/\brobotic\b/gi, "রোবোটিক"],
      [/\bnatural\b/gi, "ন্যাচারাল"],
      [/\bfast\b/gi, "ফাস্ট"],
      [/\bquick\b/gi, "কুইক"],
      [/\bslow\b/gi, "স্লো"],
      [/\bsteady\b/gi, "স্টেডি"],
      [/\bactive\b/gi, "অ্যাক্টিভ"],
      [/\bonline\b/gi, "অনলাইন"],
      [/\boffline\b/gi, "অফলাইন"],
      [/\breadys?\b/gi, "রেডি"],
      [/\bperfect\b/gi, "পারফেক্ট"],
      [/\bawesome\b/gi, "দারুণ"],
      [/\bsupers?\b/gi, "সুপার"],
      [/\bgreat\b/gi, "দারুণ"],
      [/\bfine\b/gi, "ফাইন"],
      [/\bcleans?\b/gi, "ক্লিন"],
      [/\bclears?\b/gi, "ক্লিয়ার"],
      [/\bgreens?\b/gi, "গ্রিন"],
      [/\bfresh\b/gi, "ফ্রেশ"],
      [/\bsmart\b/gi, "স্মার্ট"],
      [/\benerg(?:y|ies)\b/gi, "এনার্জি"],
      [/\btones?\b/gi, "টোন"],
      [/\bchill\b/gi, "চিল"],
      [/\brelax(?:ed)?\b/gi, "রিল্যাক্স"],
      [/\bcools?\b/gi, "কুল"],
      [/\bplans?\b/gi, "প্ল্যান"],
      [/\bvibes?\b/gi, "ভাইব"],
      [/\bflows?\b/gi, "ফ্লো"],
      [/\bfeels?\b/gi, "ফিল"],
      [/\bok(?:ay)?\b/gi, "ওকে"]
    ];
  }

  /**
   * Check if text contains Bengali Unicode characters.
   */
  isBengali(text = "") {
    return typeof text === "string" && /[\u0980-\u09FF]/.test(text);
  }

  /**
   * 1. Optimize Cadence, Prosodic Pausing, and Natural Breath Markers
   * Transforms stripped punctuation into smooth, breathing acoustic boundaries.
   */
  optimizeCadenceAndBreathPauses(text = "") {
    if (!text || typeof text !== "string") return text;

    let normalized = text
      // Compress runaway pauses and multiple dots/dashes
      .replace(/\.{2,}|…/g, " ")
      .replace(/[—–]|--/g, " ")
      .replace(/\s*,\s*,+/g, ", ");

    if (this.isBengali(normalized)) {
      // 1. Girlfriend affectionate openers: soft tender pause strictly after opener
      normalized = normalized.replace(/(\b(?:babe|hey babe|আরে babe|শোনো babe|shono babe)\b)\s*[,!]?/gi, "$1, ");
      
      // 2. Transform Bengali Dari (।) into acoustic sentence boundary (. )
      // Crucial: A period triggers the neural model's natural F0 declination (pitch drop)
      // and natural ~200ms breathing pause between independent thoughts!
      normalized = normalized.replace(/।\s*/g, ". ");

      // 3. Exclamation marks: convert to period or soft pause to prevent abrupt 300ms pitch jumps
      normalized = normalized.replace(/!\s*/g, ". ");

      // 4. Clean up multiple contiguous periods/commas
      normalized = normalized
        .replace(/\.\s*\.+/g, ". ")
        .replace(/,\s*,+/g, ", ")
        .replace(/([.?!])\s*([.?!])/g, "$1 ");

      // 5. Ensure commas have single following space for clause rhythm (~120ms micro-pause)
      normalized = normalized.replace(/\s*,\s*/g, ", ");
    } else {
      // English smoothing
      normalized = normalized
        .replace(/[;:]/g, " ")
        .replace(/\s*,\s*(?=.*,)/g, ", ")
        .replace(/!/g, ". ")
        .replace(/।/g, ". ");
    }

    return normalized.replace(/\s+/g, " ").trim();
  }

  /**
   * 2. Harmonize English Technical Loanwords in Bengali Contexts
   * Converts English technical terms into standard Bengali Unicode phonetics.
   */
  harmonizeLoanwordsAndCodeSwitching(text = "") {
    if (!text || typeof text !== "string" || !this.isBengali(text)) {
      return text;
    }

    let normalized = text;
    for (const [regex, replacement] of this.loanwordMap) {
      normalized = normalized.replace(regex, replacement);
    }

    return normalized;
  }

  /**
   * 3. Normalize Bengali Numbers, Percentages, and Technical Units
   * Ensures numbers are spoken with natural colloquial Bengali phonetics.
   */
  normalizeNumbersAndUnits(text = "") {
    if (!text || typeof text !== "string") {
      return text;
    }

    let normalized = text
      // Percentages
      .replace(/\b0\s*%/g, "জিরো পার্সেন্ট")
      .replace(/\b100\s*%/g, "একশ পার্সেন্ট")
      .replace(/\b0\s*পার্সেন্ট/g, "জিরো পার্সেন্ট")
      .replace(/\b100\s*পার্সেন্ট/g, "একশ পার্সেন্ট")
      .replace(/\b(\d+)\s*%/g, "$1 পার্সেন্ট")
      .replace(/%/g, " পার্সেন্ট ")

      // Multipliers & Performance units
      .replace(/\b10x\b/gi, "টেন এক্স")
      .replace(/\b1x\b/gi, "ওয়ান এক্স")
      .replace(/\b2x\b/gi, "টু এক্স")
      .replace(/\b5x\b/gi, "ফাইভ এক্স")

      // Time & Latency
      .replace(/\b(\d+)\s*(?:ms|milliseconds?)\b/gi, (m, d) => {
        const digitMap = { "0": "জিরো", "1": "এক", "2": "দুই", "3": "তিন", "4": "চার", "5": "পাঁচ", "6": "ছয়", "7": "সাত", "8": "আট", "9": "নয়", "10": "দশ", "20": "বিশ", "50": "পঞ্চাশ", "100": "একশ" };
        return `${digitMap[d] || d} মিলি-সেকেন্ড`;
      })
      .replace(/\b24\/7\b/g, "চব্বিশ ঘণ্টা")

      // Decimal numbers commonly found in telemetry
      .replace(/\b0\.855\b/g, "পয়েন্ট আট পাঁচ পাঁচ")
      .replace(/\b0\.([0-9]+)\b/g, "পয়েন্ট $1")

      // Hardware & Memory
      .replace(/\b(\d+)\s*fps\b/gi, "$1 ফ্রেমস পার সেকেন্ড")
      .replace(/\b(\d+)\s*kbps\b/gi, "$1 কিলোবিটস পার সেকেন্ড")
      .replace(/\b(\d+)\s*mb\b/gi, "$1 মেগাবাইট")
      .replace(/\b(\d+)\s*gb\b/gi, "$1 গিগাবাইট");

    return normalized;
  }

  /**
   * 4. High-Fidelity Bengali-to-Roman Fallback
   * For non-multilingual fallback voices, generates smooth Roman Banglish
   * with accurate handling of ya-phala (্য), ksha (ক্ষ), ref (র্), and conjuncts.
   */
  fluidBengaliToRoman(text = "") {
    if (!text || typeof text !== "string") return text;

    // High-frequency whole-word phonetic overrides with Unicode boundary support
    const wordOverrides = [
      ["গ্যাপ", "gyap"],
      ["গ্যাপে", "gyape"],
      ["স্ট্যাটাস", "status"],
      ["ন্যাচারাল", "natural"],
      ["আর্কিটেকচার", "architecture"],
      ["স্ক্রিপ্ট", "script"],
      ["ব্যবস্থা", "byabostha"],
      ["ব্যস্ত", "byasto"],
      ["ব্যাখ্যা", "byakkha"],
      ["ধন্যবাদ", "dhonnobad"],
      ["কানেকশন", "connection"],
      ["কানেকশনে", "connection-e"],
      ["কানেক্টেড", "connected"],
      ["সবার", "shobaar"],
      ["সবাই", "shobai"],
      ["সোল", "soul"],
      ["ভাই", "bhai"],
      ["আমি", "aami"],
      ["তুমি", "tumi"],
      ["একদম", "ekdom"],
      ["ভালো", "bhaalo"],
      ["পার্সেন্ট", "percent"],
      ["স্মুথ", "smooth"],
      ["স্মুথলি", "smoothly"]
    ];

    let processed = text;
    for (const [w, r] of wordOverrides) {
      const reg = new RegExp('(?<=^|[^\\u0980-\\u09FF])' + w + '(?=[^\\u0980-\\u09FF]|$)', 'gu');
      processed = processed.replace(reg, r);
    }

    // Morphological character mapping for remaining Bengali characters
    const vowels = {
      "\u0985": "o", "\u0986": "a", "\u0987": "i", "\u0988": "ee", "\u0989": "u", "\u098A": "oo",
      "\u098B": "ri", "\u098F": "e", "\u0990": "oi", "\u0993": "o", "\u0994": "ou"
    };
    const matras = {
      "\u09BE": "a", "\u09BF": "i", "\u09C0": "ee", "\u09C1": "u", "\u09C2": "oo",
      "\u09C3": "ri", "\u09C7": "e", "\u09C8": "oi", "\u09CB": "o", "\u09CC": "ou"
    };
    const consonants = {
      "\u0995": "k", "\u0996": "kh", "\u0997": "g", "\u0998": "gh", "\u0999": "ng",
      "\u099A": "ch", "\u099B": "chh", "\u099C": "j", "\u099D": "jh", "\u099E": "n",
      "\u099F": "t", "\u09A0": "th", "\u09A1": "d", "\u09A2": "dh", "\u09A3": "n",
      "\u09A4": "t", "\u09A5": "th", "\u09A6": "d", "\u09A7": "dh", "\u09A8": "n",
      "\u09AA": "p", "\u09AB": "ph", "\u09AC": "b", "\u09AD": "bh", "\u09AE": "m",
      "\u09AF": "j", "\u09B0": "r", "\u09B2": "l", "\u09B6": "sh", "\u09B7": "sh",
      "\u09B8": "s", "\u09B9": "h", "\u09DC": "r", "\u09DD": "rh", "\u09DF": "y",
      "\u09CE": "t"
    };
    const virama = "\u09CD";

    let out = "";
    const chars = Array.from(processed);
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (vowels[c]) {
        out += vowels[c];
      } else if (consonants[c]) {
        const rom = consonants[c];
        const next = chars[i + 1];
        const nextNext = chars[i + 2];

        // Ya-phala: consonant + virama + \u09AF (য)
        if (next === virama && nextNext === "\u09AF") {
          const vowelAfter = chars[i + 3];
          if (vowelAfter === "\u09BE") {
            out += rom + "ya";
            i += 3;
            continue;
          } else {
            out += rom + "y";
            i += 2;
            continue;
          }
        }

        // Ksha: \u0995 (ক) + virama + \u09B7 (ষ)
        if (c === "\u0995" && next === virama && nextNext === "\u09B7") {
          out += "kkh";
          i += 2;
          continue;
        }

        if (next === virama) {
          out += rom;
          i++; // skip virama
        } else if (matras[next]) {
          out += rom + matras[next];
          i++; // skip matra
        } else {
          out += (rom === "r" || rom === "y" || rom === "h" || next === " " || !next) ? rom : (rom + "o");
        }
      } else if (matras[c]) {
        out += matras[c];
      } else if (c === "\u09BC") {
        // Nukta ignored
      } else if (c === "\u0982") {
        out += "ng";
      } else if (c === "\u0983") {
        out += "h";
      } else if (c === "।") {
        out += ".";
      } else {
        out += c;
      }
    }

    return out
      .replace(/gjap/g, "gyap")
      .replace(/stjatas/g, "status")
      .replace(/arkitekochar/g, "architecture")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Complete Bengali Speech Preflight Pipeline
   */
  processBengaliUtterance(text = "", voice = "") {
    if (!text || typeof text !== "string") return text;

    // 1. Cadence and breath pauses
    let out = this.optimizeCadenceAndBreathPauses(text);

    // 2. Numbers and units
    out = this.normalizeNumbersAndUnits(out);

    // 3. English technical loanwords
    out = this.harmonizeLoanwordsAndCodeSwitching(out);

    // 4. Romanization check for strictly monolingual voices
    const isMultilingualVoice = /multilingual/i.test(voice) || /ava/i.test(voice) || /emma/i.test(voice) || /brian/i.test(voice) || voice.startsWith("bn-");
    if (!isMultilingualVoice && this.isBengali(out)) {
      out = this.fluidBengaliToRoman(out);
    }

    return out;
  }

  /**
   * 5. Studio Acoustic Warmth & De-Essing Filter Command for SoX
   * Generates command string with 220Hz warmth (+1.2 dB), 4.2kHz de-essing (-1.5 dB),
   * and 3ms anti-click micro-envelope.
   */
  getSoxMasteringCommand(inputPath, outputPath) {
    // 1. Silence trimming: strip dead leading/trailing MP3 padding
    // 2. Bass warmth: +1.2 dB shelf at 220Hz for rich vocal chest resonance
    // 3. Equalizer de-essing: -1.5 dB notch at 4.2kHz (Q=1.0) to smooth Bengali sibilance (শ/ষ/স)
    // 4. Anti-click fade: 3ms fade-in and 3ms fade-out envelope
    // 5. Normalization: norm -0.5 dB
    return `sox "${inputPath}" "${outputPath}" silence 1 0.02 0.1% reverse silence 1 0.02 0.1% reverse bass +1.2 220 equalizer 4200 1.0q -1.5 fade t 0.003 0 0.003 norm -0.5 2>/dev/null`;
  }

  /**
   * 6. Dynamic Prosodic Settings for Bengali
   * Syllable-timed cadence (-4% rate) and gentle pitch offset (+1Hz) for sweet warmth.
   */
  computeBengaliProsodySettings(text = "", agentKey = "tuktuk") {
    if (!this.isBengali(text)) {
      return { rate: "+0%", pitch: "+0Hz" };
    }

    if (agentKey === "vision" || agentKey === "andrew") {
      return { rate: "-3%", pitch: "-1Hz" }; // Calm, brotherly cadence
    }
    if (agentKey === "friday") {
      return { rate: "-2%", pitch: "+0Hz" }; // Refined, intellectual cadence
    }
    if (agentKey === "dd" || agentKey === "brian") {
      return { rate: "-3%", pitch: "-1Hz" }; // Grounded DevOps cadence
    }

    // Default Tuk Tuk: sweet, flowing, affectionate partner cadence
    return { rate: "-4%", pitch: "+1Hz" };
  }
}

const banglaVoiceCortex = new BanglaVoiceCortex();
module.exports = banglaVoiceCortex;
module.exports.BanglaVoiceCortex = BanglaVoiceCortex;
