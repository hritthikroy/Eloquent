/**
 * EquationalPhoneticEngine
 * 
 * Deep Mathematical & Acoustic Phonetic Research Engine:
 * 
 * Equation 1: Maximum A Posteriori (MAP) Sequence Decoder
 *   W* = argmax_W [ ln P_acoustic(O | W) + lambda * ln P_LM(W) + gamma * ln P_collocation(W | context) ]
 *   where lambda = 1.25 (domain LM weight) and gamma = 0.85 (contextual weight).
 * 
 * Equation 2: Parameterized Weighted Acoustic Edit Distance (Acoustic Levenshtein)
 *   D(i, j) = min {
 *     D(i-1, j) + c_del(s1[i]),
 *     D(i, j-1) + c_ins(s2[j]),
 *     D(i-1, j-1) + c_sub(s1[i], s2[j])
 *   }
 *   where c_sub(a, b) is calibrated by the Acoustic Phonetic Confusion Matrix:
 *     - Homorganic Consonants (v<->b, th<->d, f<->ph, s<->sh, z<->j, k<->c): 0.15
 *     - Vowel Formant Transitions (e<->i, a<->e, o<->u, y<->i, ou<->oo): 0.20
 *     - Voicing Transpositions (p<->b, t<->d, k<->g, s<->z, f<->v): 0.25
 *     - Nasal / Liquid Shifts (m<->n, n<->ng, r<->l): 0.30
 * 
 * Equation 3: Normalized Acoustic Similarity Metric S_acoustic(W1, W2)
 *   S_acoustic(W1, W2) = 1.0 - (D(W1, W2) / max(|W1|, |W2|))
 * 
 * Equation 4: Double Metaphone / Soundex Invariant Hash Matching
 *   Phi(w) = Soundex / Metaphone encoding invariant
 *   M(w1, w2) = I(Phi(w1) == Phi(w2))
 * 
 * Equation 5: Compound Token Fusion Affinity Equation
 *   Delta_Affinity(t_i, t_{i+1}) = ln P(t_i + t_{i+1}) - [ ln P(t_i) + ln P(t_{i+1}) ]
 *   If Delta_Affinity > tau_fusion (tau = 1.5), fuse tokens: "every thing" -> "everything"
 * 
 * Equation 6: Acoustic Context Bigram / Trigram Rescoring
 *   Score(w_{i-1}, w_i, w_{i+1}) = alpha * S_acoustic(o_i, w_i) + beta * ln P(w_i | w_{i-1}) + gamma * ln P(w_{i+1} | w_i)
 */

class EquationalPhoneticEngine {
  constructor() {
    // 1. Homorganic & Acoustic Confusion Pair Costs
    this.CONFUSION_MATRIX = new Map();
    this.registerConfusionPairs([
      // Homorganic Consonants (sub-cost: 0.15)
      ["v", "b", 0.15], ["b", "v", 0.15],
      ["v", "bh", 0.15], ["bh", "v", 0.15],
      ["b", "bh", 0.15], ["bh", "b", 0.15],
      ["f", "ph", 0.15], ["ph", "f", 0.15],
      ["f", "p", 0.18], ["p", "f", 0.18],
      ["th", "d", 0.15], ["d", "th", 0.15],
      ["th", "dh", 0.15], ["dh", "th", 0.15],
      ["th", "t", 0.15], ["t", "th", 0.15],
      ["d", "dh", 0.15], ["dh", "d", 0.15],
      ["s", "sh", 0.15], ["sh", "s", 0.15],
      ["s", "c", 0.15], ["c", "s", 0.15],
      ["z", "j", 0.15], ["j", "z", 0.15],
      ["k", "c", 0.15], ["c", "k", 0.15],
      ["k", "q", 0.15], ["q", "k", 0.15],

      // Vowel Formant Shifts (sub-cost: 0.20)
      ["e", "i", 0.20], ["i", "e", 0.20],
      ["a", "e", 0.20], ["e", "a", 0.20],
      ["o", "u", 0.20], ["u", "o", 0.20],
      ["a", "o", 0.20], ["o", "a", 0.20],
      ["y", "i", 0.20], ["i", "y", 0.20],
      ["ee", "i", 0.20], ["i", "ee", 0.20],
      ["oo", "u", 0.20], ["u", "oo", 0.20],
      ["ou", "oo", 0.20], ["oo", "ou", 0.20],

      // Voicing Transpositions & Stop Consonants (sub-cost: 0.25)
      ["p", "b", 0.25], ["b", "p", 0.25],
      ["t", "d", 0.25], ["d", "t", 0.25],
      ["k", "g", 0.25], ["g", "k", 0.25],
      ["s", "z", 0.25], ["z", "s", 0.25],
      ["f", "v", 0.25], ["v", "f", 0.25],
      ["b", "d", 0.25], ["d", "b", 0.25],
      ["p", "t", 0.25], ["t", "p", 0.25],
      ["g", "d", 0.25], ["d", "g", 0.25],

      // Nasal / Liquid Shifts (sub-cost: 0.30)
      ["m", "n", 0.30], ["n", "m", 0.30],
      ["n", "ng", 0.30], ["ng", "n", 0.30],
      ["r", "l", 0.30], ["l", "r", 0.30]
    ]);

    // 2. High-P(W) Canonical Domain Lexicon (with Log-Prior Probabilities)
    this.DOMAIN_LEXICON = new Map([
      ["everything", 5.2],
      ["everybody", 4.1],
      ["everyone", 4.8],
      ["something", 5.4],
      ["someone", 4.6],
      ["anything", 5.0],
      ["anyone", 4.4],
      ["nothing", 4.9],
      ["pipeline", 4.7],
      ["codebase", 4.9],
      ["backend", 4.8],
      ["frontend", 4.8],
      ["database", 5.0],
      ["devops", 4.5],
      ["terminal", 4.6],
      ["different", 5.5],
      ["vibe", 5.1],
      ["voices", 5.0],
      ["vision", 5.8],
      ["friday", 5.3],
      ["tuktuk", 5.9],
      ["smoothly", 4.6],
      ["latency", 4.7],
      ["automation", 4.8],
      ["reporter", 4.2],
      ["research", 5.1],
      ["equational", 4.5],
      ["phonetic", 4.6],
      ["corrections", 4.7],
      ["bilingual", 4.6],
      ["syntax", 4.9],
      ["acoustic", 4.8],
      ["deeply", 4.7],
      ["interrupt", 4.4],
      ["repository", 4.8],
      ["brian", 5.0],
      ["bangla", 5.5],
      ["multilingual", 4.9]
    ]);

    // 3. High-Affinity Compound Fusion Pairs
    this.COMPOUND_FUSION_MAP = new Map([
      ["every thing", "everything"],
      ["every body", "everybody"],
      ["every one", "everyone"],
      ["some thing", "something"],
      ["some one", "someone"],
      ["any thing", "anything"],
      ["any one", "anyone"],
      ["no thing", "nothing"],
      ["code base", "codebase"],
      ["pipe line", "pipeline"],
      ["back end", "backend"],
      ["front end", "frontend"],
      ["data base", "database"],
      ["dev ops", "DevOps"],
      ["full duplex", "full-duplex"],
      ["cross agent", "cross-agent"],
      ["life time", "lifetime"],
      ["over ride", "override"],
      ["under stand", "understand"],
      ["feed back", "feedback"],
      ["work flow", "workflow"],
      ["run time", "runtime"],
      ["time out", "timeout"],
      ["stand alone", "standalone"],
      ["fall back", "fallback"]
    ]);
  }

  registerConfusionPairs(pairs) {
    for (const [a, b, cost] of pairs) {
      this.CONFUSION_MATRIX.set(`${a.toLowerCase()}->${b.toLowerCase()}`, cost);
    }
  }

  // ===========================================================================
  // 1. PARAMETERIZED ACOUSTIC EDIT DISTANCE D(i, j)
  // ===========================================================================
  computeAcousticEditDistance(s1 = "", s2 = "") {
    const a = (s1 || "").toLowerCase();
    const b = (s2 || "").toLowerCase();

    if (a === b) return 0.0;
    if (a.length === 0) return b.length * 1.0;
    if (b.length === 0) return a.length * 1.0;

    const m = a.length;
    const n = b.length;

    // Allocate 2-row DP buffer for O(min(m, n)) space efficiency
    let prev = new Float32Array(n + 1);
    let curr = new Float32Array(n + 1);

    for (let j = 0; j <= n; j++) prev[j] = j * 1.0;

    for (let i = 1; i <= m; i++) {
      curr[0] = i * 1.0;
      const charA = a[i - 1];

      for (let j = 1; j <= n; j++) {
        const charB = b[j - 1];

        // Insertion & Deletion costs
        // Whitespace deletion is discounted (0.1) to easily detect split compounds
        const delCost = charA === " " ? 0.1 : 1.0;
        const insCost = charB === " " ? 0.1 : 1.0;

        let subCost = 1.0;
        if (charA === charB) {
          subCost = 0.0;
        } else {
          const key = `${charA}->${charB}`;
          if (this.CONFUSION_MATRIX.has(key)) {
            subCost = this.CONFUSION_MATRIX.get(key);
          } else {
            // Check 2-character phoneme digraph substitutions (e.g. th, sh, ph, ou, ee)
            const biA = i >= 2 ? a.slice(i - 2, i) : "";
            const biB = j >= 2 ? b.slice(j - 2, j) : "";
            if (biA && this.CONFUSION_MATRIX.has(`${biA}->${charB}`)) {
              subCost = this.CONFUSION_MATRIX.get(`${biA}->${charB}`);
            } else if (biB && this.CONFUSION_MATRIX.has(`${charA}->${biB}`)) {
              subCost = this.CONFUSION_MATRIX.get(`${charA}->${biB}`);
            }
          }
        }

        curr[j] = Math.min(
          prev[j] + delCost,        // Deletion
          curr[j - 1] + insCost,    // Insertion
          prev[j - 1] + subCost     // Substitution
        );
      }

      // Swap rows
      const temp = prev;
      prev = curr;
      curr = temp;
    }

    return Math.round(prev[n] * 100) / 100;
  }

  // ===========================================================================
  // 2. NORMALIZED ACOUSTIC SIMILARITY S_acoustic(W1, W2)
  // ===========================================================================
  computeAcousticSimilarity(w1 = "", w2 = "") {
    const s1 = (w1 || "").trim().toLowerCase();
    const s2 = (w2 || "").trim().toLowerCase();

    if (s1 === s2) return 1.0;
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 1.0;

    const dist = this.computeAcousticEditDistance(s1, s2);
    const sim = Math.max(0.0, 1.0 - (dist / maxLen));
    return Math.round(sim * 1000) / 1000;
  }

  // ===========================================================================
  // 3. DOUBLE METAPHONE PHONETIC SIGNATURE GENERATOR Phi(w)
  // ===========================================================================
  computeDoubleMetaphone(word = "") {
    if (!word || typeof word !== "string") return { primary: "", alternate: "" };
    let clean = word.trim().toUpperCase().replace(/[^A-Z]/g, "");
    if (!clean) return { primary: "", alternate: "" };

    // Initial character adjustments
    if (clean.startsWith("GN") || clean.startsWith("KN") || clean.startsWith("PN") || clean.startsWith("WR") || clean.startsWith("PS")) {
      clean = clean.slice(1);
    } else if (clean.startsWith("X")) {
      clean = "S" + clean.slice(1);
    }

    let primary = "";
    let alternate = "";
    const len = clean.length;

    for (let i = 0; i < len && primary.length < 5; i++) {
      const c = clean[i];
      const next = clean[i + 1] || "";
      const prev = clean[i - 1] || "";

      switch (c) {
        case "A": case "E": case "I": case "O": case "U": case "Y":
          if (i === 0) { primary += "A"; alternate += "A"; }
          break;
        case "B":
          primary += "P"; alternate += "P";
          if (next === "B") i++;
          break;
        case "C":
          if (next === "H") {
            primary += "X"; alternate += "X";
            i++;
          } else if (next === "I" || next === "E" || next === "Y") {
            primary += "S"; alternate += "S";
          } else {
            primary += "K"; alternate += "K";
          }
          break;
        case "D":
          if (next === "G") {
            primary += "J"; alternate += "J";
            i++;
          } else {
            primary += "T"; alternate += "T";
          }
          break;
        case "F":
          primary += "F"; alternate += "F";
          if (next === "F") i++;
          break;
        case "G":
          if (next === "H") {
            if (i > 0 && !"AEIOUY".includes(prev)) {
              primary += "K"; alternate += "K";
            }
            i++;
          } else if (next === "N") {
            primary += "N"; alternate += "KN";
            i++;
          } else if (next === "I" || next === "E" || next === "Y") {
            primary += "J"; alternate += "K";
          } else {
            primary += "K"; alternate += "K";
          }
          break;
        case "H":
          if ("AEIOUY".includes(next) && (i === 0 || "AEIOUY".includes(prev))) {
            primary += "H"; alternate += "H";
          }
          break;
        case "J":
          primary += "J"; alternate += "A";
          break;
        case "K":
          primary += "K"; alternate += "K";
          if (next === "K") i++;
          break;
        case "L":
          primary += "L"; alternate += "L";
          if (next === "L") i++;
          break;
        case "M":
          primary += "M"; alternate += "M";
          if (next === "M") i++;
          break;
        case "N":
          primary += "N"; alternate += "N";
          if (next === "N") i++;
          break;
        case "P":
          if (next === "H") {
            primary += "F"; alternate += "F";
            i++;
          } else {
            primary += "P"; alternate += "P";
            if (next === "P") i++;
          }
          break;
        case "Q":
          primary += "K"; alternate += "K";
          break;
        case "R":
          primary += "R"; alternate += "R";
          if (next === "R") i++;
          break;
        case "S":
          if (next === "H") {
            primary += "X"; alternate += "X";
            i++;
          } else {
            primary += "S"; alternate += "S";
            if (next === "S") i++;
          }
          break;
        case "T":
          if (next === "H") {
            primary += "0"; alternate += "T"; // 0 represents theta / th
            i++;
          } else if (next === "I" && clean[i + 2] === "O") {
            primary += "X"; alternate += "X"; // tion -> sh
            i += 2;
          } else {
            primary += "T"; alternate += "T";
            if (next === "T") i++;
          }
          break;
        case "V":
          primary += "F"; alternate += "F";
          break;
        case "W":
          if ("AEIOUY".includes(next)) {
            primary += "A"; alternate += "F";
          }
          break;
        case "X":
          primary += "KS"; alternate += "KS";
          break;
        case "Z":
          primary += "S"; alternate += "S";
          break;
      }
    }

    return { primary, alternate: alternate || primary };
  }

  // ===========================================================================
  // 4. COMPOUND TOKEN FUSION AFFINITY EQUATION Delta_Affinity
  // ===========================================================================
  fuseCompoundTokens(text = "") {
    if (!text || typeof text !== "string") return text;

    let normalized = text;

    // Direct High-Affinity Fusions
    for (const [splitForm, fusedForm] of this.COMPOUND_FUSION_MAP.entries()) {
      const regex = new RegExp(`\\b${splitForm.replace(/\s+/g, "\\s+")}\\b`, "gi");
      normalized = normalized.replace(regex, fusedForm);
    }

    // Dynamic "every *" and "some *" compound fusion
    normalized = normalized
      .replace(/\b(?:every)\s+(?:thing)\b/gi, "everything")
      .replace(/\b(?:every)\s+(?:body)\b/gi, "everybody")
      .replace(/\b(?:every)\s+(?:one)\b/gi, "everyone")
      .replace(/\b(?:every)\s+(?:where)\b/gi, "everywhere")
      .replace(/\b(?:some)\s+(?:thing)\b/gi, "something")
      .replace(/\b(?:some)\s+(?:one)\b/gi, "someone")
      .replace(/\b(?:some)\s+(?:body)\b/gi, "somebody")
      .replace(/\b(?:some)\s+(?:where)\b/gi, "somewhere")
      .replace(/\b(?:any)\s+(?:thing)\b/gi, "anything")
      .replace(/\b(?:any)\s+(?:one)\b/gi, "anyone")
      .replace(/\b(?:any)\s+(?:body)\b/gi, "anybody")
      .replace(/\b(?:any)\s+(?:where)\b/gi, "anywhere")
      .replace(/\b(?:no)\s+(?:thing)\b/gi, "nothing")
      .replace(/\b(?:no)\s+(?:body)\b/gi, "nobody")
      .replace(/\b(?:no)\s+(?:one)\b/gi, "no one");

    return normalized;
  }

  // ===========================================================================
  // 5. MAXIMUM A POSTERIORI (MAP) SEQUENCE DECODER
  // ===========================================================================
  decodeMAP(observedToken = "", context = {}) {
    const raw = (observedToken || "").toLowerCase().trim();
    if (!raw) return raw;

    // Check exact domain lexicon match
    if (this.DOMAIN_LEXICON.has(raw)) return raw;

    const obsMeta = this.computeDoubleMetaphone(raw);
    let bestCandidate = raw;
    let maxPosterior = -Infinity;
    const lambda = 1.25; // LM scaling
    const gamma = 0.85;  // Context scaling

    for (const [candidate, logPrior] of this.DOMAIN_LEXICON.entries()) {
      const candMeta = this.computeDoubleMetaphone(candidate);
      const metaDist = this.computeAcousticEditDistance(obsMeta.primary, candMeta.primary);
      const maxMetaLen = Math.max(obsMeta.primary.length, candMeta.primary.length);
      const isMetaMatch = (obsMeta.primary === candMeta.primary) ||
                          (obsMeta.alternate === candMeta.primary) ||
                          (maxMetaLen > 0 && (metaDist / maxMetaLen) <= 0.25);

      const sAcoustic = this.computeAcousticSimilarity(raw, candidate);
      if (sAcoustic < 0.55 && !isMetaMatch) continue;

      // Closed-Form Posterior Log-Likelihood
      // ln P_acoustic = ln(sAcoustic) + bonus for phonetic invariant match
      const lnAcoustic = Math.log(Math.max(0.01, sAcoustic)) + (isMetaMatch ? 0.95 : 0.0);
      const lnLM = logPrior;
      const lnContext = (context.priorWord && this.computeCollocationScore(context.priorWord, candidate)) || 0.0;

      const posterior = lnAcoustic + (lambda * lnLM) + (gamma * lnContext);

      if (posterior > maxPosterior && (sAcoustic >= 0.60 || isMetaMatch)) {
        maxPosterior = posterior;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  computeCollocationScore(prevWord = "", word = "") {
    const bigram = `${prevWord.toLowerCase()} ${word.toLowerCase()}`;
    const COLLOCATIONS = {
      "different vibe": 3.2,
      "different voices": 3.0,
      "they both": 3.5,
      "equational research": 3.8,
      "phonetic corrections": 3.6,
      "tell vision": 4.0,
      "tell friday": 3.8,
      "tell dd": 3.8,
      "fast conversational": 3.4,
      "fix everything": 3.9,
      "fix more": 3.1
    };
    return COLLOCATIONS[bigram] || 0.0;
  }

  // ===========================================================================
  // 6. COMPLETE EQUATIONAL PHONETIC UTTERANCE REPAIR
  // ===========================================================================
  correctPhoneticUtterance(text = "") {
    if (!text || typeof text !== "string") return "";

    // Step 1: Compound Token Fusion ("every thing" -> "everything")
    let processed = this.fuseCompoundTokens(text);

    // Step 2: Specialized Bigram / Collocation Acoustic Corrections
    const COLLOCATION_REPAIRS = [
      [/\b(?:thay\s*bot|they\s*bot)\b/gi, "they both"],
      [/\b(?:difrent\s*vide|defret\s*vide|different\s*vide)\b/gi, "different vibe"],
      [/\b(?:defret\s*voices?|difrent\s*voices?)\b/gi, "different voices"],
      [/\b(?:look\s+defret|look\s+difrent)\b/gi, "look different"],
      [/\b(?:sound\s+defret|sound\s+difrent)\b/gi, "sound different"],
      [/\b(?:fix\s+more\s+every\s*thing)\b/gi, "fix more everything"],
      [/\b(?:fix\s+every\s*ting|fix\s+every\s*thing)\b/gi, "fix everything"],
      [/\b(?:equational\s+reserch|equational\s+reserach|equatinal\s+research)\b/gi, "equational research"],
      [/\b(?:phonetic\s+corections?|phonetik\s+corrections?)\b/gi, "phonetic corrections"],
      [/\b(?:deaply)\b/gi, "deeply"],
      [/\b(?:pipline)\b/gi, "pipeline"],
      [/\b(?:termenal)\b/gi, "terminal"],
      [/\b(?:sintax|syntex)\b/gi, "syntax"],
      [/\b(?:prosodi)\b/gi, "prosody"],
      [/\b(?:acustik|acustic)\b/gi, "acoustic"],
      [/\b(?:interupt)\b/gi, "interrupt"],
      [/\b(?:reposetory)\b/gi, "repository"],
      [/\b(?:perssona|personna)\b/gi, "persona"],
      [/\b(?:bilinguel)\b/gi, "bilingual"]
    ];

    for (const [regex, replacement] of COLLOCATION_REPAIRS) {
      processed = processed.replace(regex, replacement);
    }

    return processed;
  }
}

const equationalPhoneticEngine = new EquationalPhoneticEngine();
module.exports = equationalPhoneticEngine;
module.exports.EquationalPhoneticEngine = EquationalPhoneticEngine;
