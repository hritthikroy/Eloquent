/**
 * TextSanitizer
 * Cleans speech-to-text artifacts, phonetic mishearings, and normalizes developer terms
 */

const equationalPhoneticEngine = require("./equational-phonetic-engine");

class TextSanitizer {
  static sanitize(rawText) {
    if (!rawText || typeof rawText !== "string") return "";

    let text = rawText.trim();
    if (equationalPhoneticEngine && typeof equationalPhoneticEngine.correctPhoneticUtterance === "function") {
      text = equationalPhoneticEngine.correctPhoneticUtterance(text);
    }

    // 1. Phonetic speech-to-text corrections
    text = text
      .replace(/\band you\b(?=\s+(?:check|modify|write|tell|see|look|help|code|build|refactor|take|run|fix|draft|craft|inspect|smooth))/gi, "Vision")
      .replace(/\b(?:vi\s*si?on|vishon|vishan|vison|bison|vesion)\b/gi, "Vision")
      .replace(/\b(?:entry|enter|anti)\s*gravity\b/gi, "Antigravity")
      .replace(/\b(?:took\s*took|tok\s*tok|tuck\s*tuck)\b/gi, "Tuk Tuk")
      .replace(/(?:টুক\s*টুক|টুকটুক|টুকী|টুক্টুক|टুক\s*টুক|টুকটুক)/gi, "Tuk Tuk")
      .replace(/(?:ভিশন\s*ভাই|ভাই\s*ভিশন|ভিশন|ভিসন|विजन\s*भाई|भाई\s*विजन|विजन|विज़न)/gi, "Vision")
      .replace(/\b(?:hey\s+|listen\s+)?vision(?:\s+bhai)?\b/gi, "Vision")
      .replace(/(?:জেনি|जेनी|ফ্রাইডে|फ़्राइডে)/gi, "Friday")
      .replace(/(?:ব্রায়ান|ब्रायन|ডিডি)/gi, "DD")
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
      .replace(/\b(?:bablo|bapak|bambu|beb)\b/gi, "babe")
      .replace(/\b(?:sentance|sentense)\b/gi, "sentence")
      .replace(/\b(?:sentances)\b/gi, "sentences")
      .replace(/\b(?:profesional)\b/gi, "professional")
      .replace(/\b(?:professionaly|profesionally)\b/gi, "professionally")
      .replace(/\b(?:dictashun|dictatation)\b/gi, "dictation")
      .replace(/\b(?:writting|writeing)\b/gi, "writing")
      .replace(/\b(?:pased)\b/gi, "pasted")
      .replace(/\b(?:pasteing)\b/gi, "pasting")
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
      .replace(/\b(?:latansy|latansi|latancy|letancy|letency)\b/gi, "latency")
      .replace(/\b(?:input\s*(?:and|&)?\s*output\s*(?:latansy|latency)\s*gaps?)\b/gi, "input and output latency gaps")
      .replace(/\b(?:again\s+again)\b/gi, "again and again")
      .replace(/\b(?:robotik\s*gaps?|robotic\s*gap)\b/gi, "robotic gaps")
      .replace(/\b(?:both\s*working\s*languages?)\b/gi, "both working languages")
      // Bilingual vibe parity & dialect mishearing normalizations
      .replace(/\b(?:thay\s*bot|they\s*bot)\b/gi, "they both")
      .replace(/\b(?:difrent|defret|defrent)\b/gi, "different")
      .replace(/\b(?:dif+rent\s+vide)\b/gi, "different vibe")
      .replace(/\b(?:vide)\b(?=\s*(?:fully|same|dif+rent|different|not|match|vibe|deeply))/gi, "vibe")
      .replace(/\b(?:bangali)\b/gi, "Bengali")
      // STT acoustic collisions for agent delegation and Banglish terms
      .replace(/\b(?:the\s+)?television(?=\s+(?:to|the|write|fix|check|run|code|look|help|listen|bro|brother|bhai|problem|error|issue|status))\b/gi, "Tell Vision")
      .replace(/\b(?:tell\s+)?television\b/gi, "Tell Vision")
      .replace(/\btell\s+(?:vison)\b/gi, "Tell Vision")
      .replace(/\bvison\b/gi, "Vision")
      .replace(/\btell\s+(?:fry\s*day|fryday|fraide|fridya|fridy|fryda)\b/gi, "Tell Friday")
      .replace(/\b(?:fry\s*day|fryday|fraide|fridya|fridy|fryda)\b/gi, "Friday")
      .replace(/\b(?:tell\s+)?dj\b/gi, "Tell Friday")
      .replace(/\btell\s+(?:brayn|brian|dee\s*dee|deedee|dd)\b/gi, "Tell DD")
      .replace(/\b(?:brayn|dee\s*dee|deedee)\b/gi, "DD")
      .replace(/\btabul\s+da(?:\s+chai)?\b/gi, "table-ta chai")
      .replace(/\btabul\s+da\b/gi, "table-ta")
      .replace(/\b(?:bing\s+ni\s+op|bing\s+it\s+op)\b/gi, "bring it up")
      .replace(/\b(?:mgmc|mcmc)\b/gi, "Tuk Tuk")
      .replace(/\b(?:deem[,\s]+simplici\s+by\s+putting\s+the)\b/gi, "simplify by putting the")
      // Kana Wohndraja / Bengali folklore & story reading acoustic normalization
      .replace(/\b(?:kana\s+wohndraja|kana\s+ondhoraja|kana\s+ondho\s+raja|kana\s+o\s+ondho\s+raja)\b/gi, "Kana Wohndraja (কানা ও অন্ধ রাজা)")
      .replace(/\b(?:ondher\s+deshe\s+kana\s+raja|ondho\s+raja)\b/gi, "অন্ধের দেশে কানা রাজা")
      .replace(/\b(?:fix\s+every\s+issues?)\b/gi, "fix every issue")
      .replace(/\b(?:keep\s+reading\s+and\s+fix\s+every\s+issues?)\b/gi, "keep reading and fix every issue")
      // Whisper STT glued agent token un-gluing (e.g. Visionfix -> Vision fix, DDfix -> DD fix)
      .replace(/\bvision(?=(?:fix|check|to|run|test|code|audit|listen|see|look|help|is|can|are|ing|voices?))\b/gi, "Vision ")
      .replace(/\bvisionchecking\b/gi, "Vision checking")
      .replace(/\bvisionto\b/gi, "Vision to")
      .replace(/\bvisionfix\b/gi, "Vision fix")
      .replace(/\b(?:friday|fridya|fridy|fryday)(?=(?:fix|check|to|run|test|code|audit|listen|see|look|help|is|can|are|ing|has|search|tell|do|think|voices?))\b/gi, "Friday ")
      .replace(/\b(?:friday|fridya|fridy|fryday)checking\b/gi, "Friday checking")
      .replace(/\b(?:friday|fridya|fridy|fryday)to\b/gi, "Friday to")
      .replace(/\b(?:friday|fridya|fridy|fryday)fix\b/gi, "Friday fix")
      .replace(/\bdd(?=(?:fix|check|to|run|test|code|audit|listen|see|look|help|is|can|are|ing|has|status|monitor|deploy|docker|server|voices?))\b/gi, "DD ")
      .replace(/\bddchecking\b/gi, "DD checking")
      .replace(/\bddto\b/gi, "DD to")
      .replace(/\bddfix\b/gi, "DD fix")
      .replace(/\b(?:fixed|fix)\s*(?:visionvoice|vision\s*voice)\b/gi, "fix Vision voice")
      .replace(/\b(?:fixed|fix)\s*(?:fridayvoice|frydayvoice|friday\s*voices?|fryday\s*voices?)\b/gi, "fix Friday voice")
      .replace(/\b(?:fixed|fix)\s*(?:ddvoice|dd\s*voices?)\b/gi, "fix DD voice")
      .replace(/\b(?:fix\s+)?(?:vison|vision)\s+(?:fryday|friday)\s+(?:and|\&|ar)?\s*dd\s*(?:ar|er)?\s*bangla\s*voices?\b/gi, "Fix Vision, Friday and DD's Bangla voices")
      .replace(/\b(?:vison|vision)\s+(?:fryday|friday)\s+(?:and|\&|ar)?\s*dd\s*(?:ar|er)?\s*bangla\s*voices?\b/gi, "Vision, Friday and DD's Bangla voices")
      .replace(/\b(?:fix\s+)?(?:vison|vision)\s+bangla\s+talking\s+voice\s+(?:he\s+is\s+talking\s+like\s+robotic|talking\s+like\s+robotic|robotic)\s*(?:fix\s+all\s+issues?)?\b/gi, "Fix Vision Bangla talking voice, he is talking like a robot, fix all issues")
      .replace(/\b(?:vison|vision)\s+bangla\s+talking\s+voice\b/gi, "Vision Bangla talking voice")
      .replace(/\b(?:he\s+is\s+talking\s+like\s+robotic|talking\s+like\s+robotic)\b/gi, "he is talking like a robot")
      .replace(/\b(?:vison|vision)\s+talking\s+like\s+robotic\b/gi, "Vision talking like a robot")
      .replace(/\b(?:vison|vision)\s+(?:er|ar)?\s*bangla\s*voice\s*(?:robotic|robot\s*er\s*moto|robot\s*moto)\b/gi, "Vision Bangla voice robotic")
      .replace(/\b(?:vison|vision)\s*(?:ar|er)\s*bangla\s*voices?\b/gi, "Vision's Bangla voice")
      .replace(/\b(?:friday|fryday)\s*(?:ar|er)\s*bangla\s*voices?\b/gi, "Friday's Bangla voice")
      .replace(/\b(?:dd|brian)\s*(?:ar|er)\s*bangla\s*voices?\b/gi, "DD's Bangla voice")
      .replace(/\bfryday\s*voice\b/gi, "Friday voice")
      .replace(/\bfryday\s*voices\b/gi, "Friday voices")
      .replace(/\bdd\s*voice\b/gi, "DD voice")
      .replace(/\bdd\s*voices\b/gi, "DD voices")
      .replace(/\bvison\b/gi, "Vision")
      .replace(/\bfryday\b/gi, "Friday")
      .replace(/\bdd\b(?=\s*(?:ar|er|and|\&|voice|voices|bangla))/gi, "DD")
      .replace(/\b(?:denny|danny|genny|danni)\b/gi, "Friday")
      .replace(/\b(?:jey|jeni)\b(?=[\s,.]|$)/gi, "Friday")
      // Phonetic speech-to-text corrections for conversational Bengali / Banglish
      .replace(/\b(?:kothe\s*bolo|kothe\s*re\s*koro)\b/gi, "kotha bolo")
      .replace(/\b(?:kothe\s*re)\b/gi, "kotha record")
      .replace(/\btaro\s*smooth\b/gi, "aro smooth")
      // Bangla voice smoothness STT acoustic corrections
      .replace(/\b(?:smouthly|smuthly)\b/gi, "smoothly")
      .replace(/\b(?:smouth|smuth)\b/gi, "smooth")
      .replace(/\b(?:make\s+our\s+bangla\s+voice\s+more\s+smoothly)\b/gi, "make our Bangla voice more smoothly")
      .replace(/\b(?:fix\s+and\s+make\s+our\s+bangla\s+voice\s+more\s+smoothly)\b/gi, "fix and make our Bangla voice more smoothly")
      .replace(/\b(?:kothe)\b(?=\s*(?:type|bolo|bolte|gula|ta))/gi, "kotha")
      .replace(/\baamadher\b/gi, "amader")
      .replace(/\bbapbe\b/gi, "bhabe")
      .replace(/\bni\s*iqt\b/gi, "niye ektu")
      // Reel, music companion & human-like watching STT acoustic corrections
      .replace(/\b(?:movile\s*reel|mobail\s*reel)\b/gi, "mobile reel")
      .replace(/\bmovile\b/gi, "mobile")
      .replace(/\b(?:nt\s*lisent|nt\s*listen)\b/gi, "not listen")
      .replace(/\b(?:not\s*responds?|nt\s*responds?)\b/gi, "not responding")
      .replace(/\blisent\s*music\b/gi, "listen to music")
      .replace(/\blisent\b/gi, "listen")
      .replace(/\bwatching\s+need\s+like\s+a\s+human\b/gi, "watch like a human")
      .replace(/\bwatching\s+need\b/gi, "watch")
      .replace(/\bmy\s+gf\s+not\s+see\s+with\s+me\b/gi, "my gf does not see with me")
      // Whisper STT mishearing normalizations from live conversation audit & human Bangla requests
      .replace(/\b(?:bangal|bngal|bngla|bongal|borgla|bongla|borngla|bengala)\b/gi, "Bangla")
      .replace(/\bho\s+a\s+real\b/gi, "how a real")
      .replace(/\b(?:real\s+bngla|real\s+bngal)\b/gi, "real Bangla")
      .replace(/\b(?:bangla\s+puke[,\s]*koro)\b/gi, "Bangla shuru koro")
      .replace(/\b(?:buste\s+pari\s+ni|buz\s+te\s+perechova)\b/gi, "bujhte parini")
      .replace(/\b(?:kakal\s+ke\s+rat\s+rath\s+re)\b/gi, "kal ke raate")
      .replace(/\b(?:demon\s+mo\s+toh|demon\s+moto)\b/gi, "temon moto")
      .replace(/\b(?:eda\s+na|eta\s+na\s+aabharbois)\b/gi, "eta na abar voice")
      .replace(/\b(?:aabharbois)\b/gi, "abar voice")
      .replace(/\b(?:wilihan[,\s]*pete\s*koro)\b/gi, "workflow check koro")
      .replace(/\ba\s+tuk\s+sound[,\s]*smart\s+girl\b/gi, "Tuk Tuk smart girl")
      // Automation and higher-level human automation STT normalizations
      .replace(/\b(?:higher|high)\s*(?:lavel|laval|lebel)\b/gi, "higher level")
      .replace(/\b(?:lavel|laval)\b/gi, "level")
      .replace(/\b(?:atumation|autometion|automatation)\b/gi, "automation")
      .replace(/\bautomations\b/gi, "automation")
      // Fast conversational and turn-taking STT normalizations
      .replace(/\b(?:fas\s*conversationl\s*issues?|fast\s*conversationl\s*issues?|fas\s*conversational\s*issues?)\b/gi, "fast conversational issues")
      .replace(/\b(?:fas)\s+(?:conversationl|convesational)\b/gi, "fast conversational")
      .replace(/\b(?:fas)\s+conversation\b/gi, "fast conversation")
      .replace(/\b(?:conversationl|convesational|converstional)\b/gi, "conversational")
      .replace(/\b(?:conversaton)\b/gi, "conversation")
      .replace(/\b(?:fas)\b(?=\s*(?:reply|response|mode|turn|speed|latency|vad|issues?))/gi, "fast")
      // Instant human-like response STT normalizations
      .replace(/\bneed\s+(?:instent|instant)\s+(?:humen|human)\s*(?:like|-like)\s*(?:responds|respond|responses?)\b/gi, "need instant human-like response")
      .replace(/\b(?:instent|instant)\s+(?:humen|human)\s*(?:like|-like)\s*(?:responds|respond|responses?)\b/gi, "instant human-like response")
      .replace(/\b(?:instent|instant)\s+(?:humen|human)\s*(?:like|-like)\b/gi, "instant human-like")
      .replace(/\binstent\b/gi, "instant")
      .replace(/\bhumen\b/gi, "human")
      // Forensic audit corrections for live conversation mishearings & butter smooth requests
      .replace(/\b(?:tuk\s*mat\s*chok\s*koro|tuk\s*mat\s*chok|chok\s*matkacche)\b/gi, "chokh flicker koro na")
      .replace(/\b(?:lag\s*kore\s*chhe|lag\s*koreche)\b/gi, "lag korche")
      .replace(/\b(?:buffering\s*as\s*se|buffering\s*asce)\b/gi, "buffering asche")
      .replace(/\b(?:buffaring|buffring|bufering)\b/gi, "buffering")
      .replace(/\b(?:kya\s*monekta[,\s]*grammar[,\s]*mere[,\s]*mo\s*toh[,\s]*skill\s*dhichcho[,\s]*not\s*a\s*modern\s*girl)\b/gi, "grammar mere skill diccho, not a modern girl")
      .replace(/\b(?:tabular[,\s]*tata\s*hai|tabuler\s*data\s*chai)\b/gi, "table data chai")
      .replace(/\b(?:flicaring|flickaring|flicering)\b/gi, "flickering")
      .replace(/\b(?:flicar)\b/gi, "flicker")
      .replace(/\bbutter\s*smouth\b/gi, "butter smooth")
      .replace(/\bthay\s*need\s*thare\s*eye\b/gi, "they need their eye")
      .replace(/\bfix\s*every\s*ting\b/gi, "fix everything")
      // 1:1 English & Bangla Tuk Tuk Parity STT mishearings
      .replace(/\b(?:english\s+tuk\s*tuk\s+(?:and|or|&)\s+bangla\s+tuk\s*tuk\s+same\s+na)\b/gi, "english tuk tuk and bangla tuk tuk not same")
      .replace(/\b(?:bangla\s+tuk\s*tuk\s+(?:and|or|&)\s+english\s+tuk\s*tuk\s+same\s+na)\b/gi, "bangla tuk tuk and english tuk tuk not same")
      .replace(/\b(?:english\s+tuk\s*tuk\s+(?:and|or|&)\s+bangla\s+tuk\s*tuk\s+not\s+the\s+same)\b/gi, "english tuk tuk and bangla tuk tuk not same")
      .replace(/\b(?:english\s+tuk\s*tuk\s+ar\s+bangla\s+tuk\s*tuk\s+same\s+na)\b/gi, "english tuk tuk and bangla tuk tuk not same")
      // Self-learning system & automatic update STT normalizations
      .replace(/\b(?:thay|they)\s+are\s+not\s+update\s+(?:thay\s+are\s+)?automatical+y\b/gi, "they are not updating automatically")
      .replace(/\b(?:thay|they)\s+are\s+not\s+update\b/gi, "they are not updating")
      .replace(/\b(?:thay|they)\s+are\s+automatical+y\b/gi, "automatically")
      .replace(/\b(?:thay|they)\s+not\s+update\b/gi, "they don't update")
      .replace(/\bthay\s+(?:do\s+not|dont)\s+update\b/gi, "they don't update")
      .replace(/\bautomatical+y\b/gi, "automatically")
      .replace(/\bthay\b/gi, "they")
      .replace(/\bself\s*(?:learnig|learing)\b/gi, "self learning")
      // Equational Human Eye (Seeing, Learning, 100% Human-Like) STT Normalizations
      .replace(/\b(?:thay|they)\s+are\s+eye\s+and\s+(?:our|my)\s+(?:aye|eye|eyes)\s+(?:same|equal)\s+(?:like\s+)?(?:equationaly|equationly|equationally)\s*(?:or\s+not)?\b/gi, "their eyes and our eyes are same like equationally or not")
      .replace(/\b(?:thay|they)\s+are\s+eye\b/gi, "their eyes")
      .replace(/\b(?:our|my)\s+aye\b/gi, "our eyes")
      .replace(/\baye\b(?=\s*(?:same|and|is|are|like|eye|vision))/gi, "eye")
      .replace(/\b(?:chahk|chack|chak|cheak)\s+(?:his|their|thare)?\s*eyes?\s+(?:is|are)\s*(?:work|working)\s+(?:for\s+)?(?:learning|learn|learnig|learing)\s+(?:and\s+)?(?:seeing|seing)\s+(?:and\s+)?(?:100%?\s+)?(?:human\s*like|like\s*human)\s*(?:equationaly|equationly|equationally)\b/gi, "check if their eyes are working for learning, seeing and 100% human-like equationally")
      .replace(/\b(?:chahk|chack|chak|cheak)\s+(?:his|their|thare)?\s*eyes?\s+(?:is|are)\s*(?:work|working)\b/gi, "check if their eyes are working")
      .replace(/\b(?:his|their|thare)\s+eyes?\s+(?:is|are)\s*(?:work|working)\b/gi, "their eyes are working")
      .replace(/\b(?:chahk|chack|chak|cheak)\b/gi, "check")
      .replace(/\b(?:equationaly|equationly)\b/gi, "equationally")
      .replace(/\b100\s+human\s+like\b/gi, "100% human-like")
      .replace(/\b(?:thay|they)\s+are\s+use\s+(?:thay\s+are|thare|their)?\s*eyes?\s+(?:for|to)\s*(?:learning|learnig|learing)\s*(?:or\s+not)?\b/gi, "they are using their eyes for learning")
      .replace(/\b(?:thay|they)\s+are\s+eyes\b/gi, "their eyes")
      .replace(/\bthare\s+eyes\b/gi, "their eyes")
      .replace(/\b(?:thay|they)\s+are\s+use\b/gi, "they are using")
      .replace(/\b(?:use|using)?\s*(?:your|their|thare)?\s*eyes?\s*(?:for|to|in)\s*(?:learnig|learing)\b/gi, "use your eye for learning")
      .replace(/\bchokh\s+(?:diye|dia)\s+(?:sekho|shikho)\b/gi, "chokh diye shekho")
      .replace(/\b(?:learnig|learing)\b/gi, "learning")
      // Bilingual Persona Parity & "Same Person" STT Normalizations
      .replace(/\bneed\s+same\s+person\s+same\s+tone\s+same\s+personality\s+in\s+talk\s+for\s+when\s+(?:tuk\s*tuk|tuktuk)\s+and\s+(?:other|others)\s+talk\s+in\s+(?:bangla|bangali|bengali)\s+with\s+deep\s+test\s+and\s+(?:chack|chak|cheak|check)\b/gi, "need same person, same tone, same personality in talk for when Tuk Tuk and others talk in Bangla with deep test and check")
      .replace(/\b(?:same\s+person)\s+(?:same\s+tone)\s+(?:same\s+personality)\b/gi, "same person, same tone, same personality")
      .replace(/\b(?:same\s+person)\s+(?:same\s+tone)\b/gi, "same person, same tone")
      .replace(/\b(?:same\s+tone)\s+(?:same\s+personality)\b/gi, "same tone, same personality")
      .replace(/\b(?:tuk\s*tuk|tuktuk)\s+and\s+other\s+talk\s+in\s+(?:bangla|bangali|bengali)\b/gi, "Tuk Tuk and others talk in Bangla")
      .replace(/\b(?:deep\s+test\s+and\s+(?:chack|chak|cheak|check))\b/gi, "deep test and check")
      .replace(/\b(?:bangali|bangli)\s+(?:parson|preson|person)\b/gi, "Bengali person")
      .replace(/\b(?:english|inglish|engish)\s+(?:parson|preson|person)\b/gi, "English person")
      .replace(/\b(?:parson|preson)\b/gi, "person")
      .replace(/\b(?:thay|they)\s+are\s+not\s+same\b/gi, "they are not same")
      .replace(/\b(?:hope\s+so\s+)?(?:check)\s+(?:equationally)\b/gi, "hope so check equationally")
      .replace(/\b(?:hope\s+so\s+)?(?:chack|chak|cheak|check)\s+(?:equationaly|equationly|equationally)\b/gi, "hope so check equationally")
      .replace(/\b(?:chack|chak|cheak|check)\s+deeply\b/gi, "check deeply")
      .replace(/\b(?:chack|chak|cheak|check)\s+deeply\s+need\s+same\s+person\s+fix\s+all\b/gi, "check deeply need same person fix all")
      .replace(/\b(?:i\s+need\s+same\s+both\s+side|need\s+same\s+both\s+side)\b/gi, "I need same both side")
      // Bangla Original Thinker & Tone Normalizations
      .replace(/\bbangla\s+talk\s+like\s+robotic\s+not\s+english\s+like\s+(?:orginal|original)\s+thinker\s+and\s+change\s+the\s+tone\b/gi, "Bangla talk is like a robot, not like English as an original thinker, and change the tone")
      .replace(/\borginal\b/gi, "original")
      .replace(/\b(?:orginal|original)\s+thinker\b/gi, "original thinker")
      // LaTeX / KaTeX rendering error & fix requests
      .replace(/(?:⚠️\s*)?(?:Failed\s+to\s+render\s+LaTeX|KaTeX\s+parse\s+error)[\s\S]*?\b(?:fix\s+all|fix\s+it|fix|all)\b/gi, "fix all LaTeX equations and rendering")
      .replace(/(?:⚠️\s*)?(?:Failed\s+to\s+render\s+LaTeX|KaTeX\s+parse\s+error)[\s\S]*$/gi, "fix LaTeX rendering")
      // Voice Bond & Noise Suppression STT Normalizations
      // Handles: "if i talk with them need to ignor all the extranal and backround sound need to conect with by bond"
      .replace(/\b(?:if\s+i\s+talk\s+with\s+them\s+)?need\s+to\s+(?:ignor|ignore)\s+all\s+(?:the\s+)?(?:extranal|external)\s+(?:and\s+)?(?:backround|background)\s+sounds?\s+need\s+to\s+(?:conect|connect)\s+(?:with\s+)?(?:by\s+)?bond\b/gi, "if I talk with them need to ignore all external and background sound, need to connect by bond")
      .replace(/\b(?:ignor|ignore)\s+all\s+(?:the\s+)?(?:extranal|external)\s+(?:and\s+)?(?:backround|background)\s+sounds?\b/gi, "ignore all external and background sound")
      .replace(/\b(?:extranal|external)\s+and\s+(?:backround|background)\s+sounds?\b/gi, "external and background sound")
      .replace(/\b(?:extranal)\s+sounds?\b/gi, "external sound")
      .replace(/\b(?:backround)\s+sounds?\b/gi, "background sound")
      .replace(/\b(?:conect)\s+(?:with\s+)?by\s+bond\b/gi, "connect by bond")
      .replace(/\b(?:conect|connect)\s+with\s+by\s+bond\b/gi, "connect by bond")
      .replace(/\b(?:conect)\s+(?:with\s+)?(?:our\s+)?bond\b/gi, "connect by bond")
      .replace(/\b(?:extranal)\b/gi, "external")
      .replace(/\b(?:backround)\b/gi, "background")
      .replace(/\b(?:ignor)\b/gi, "ignore")
      .replace(/\b(?:conect)\b/gi, "connect")
      // Deep Equational Research & Compound Word Split Normalizations
      .replace(/\b(?:fix\s+more\s+every\s*thing)\b/gi, "fix more everything")
      .replace(/\b(?:fix\s+every\s*thing)\b/gi, "fix everything")
      .replace(/\b(?:every\s+thing)\b/gi, "everything")
      .replace(/\b(?:every\s+body)\b/gi, "everybody")
      .replace(/\b(?:every\s+one)\b/gi, "everyone")
      .replace(/\b(?:some\s+thing)\b/gi, "something")
      .replace(/\b(?:any\s+thing)\b/gi, "anything")
      .replace(/\b(?:no\s+thing)\b/gi, "nothing")
      .replace(/\b(?:code\s+base)\b/gi, "codebase")
      .replace(/\b(?:pipe\s+line)\b/gi, "pipeline")
      .replace(/\b(?:back\s+end)\b/gi, "backend")
      .replace(/\b(?:front\s+end)\b/gi, "frontend")
      .replace(/\b(?:data\s+base)\b/gi, "database")
      .replace(/\b(?:equational\s+reserch|equational\s+reserach|equatinal\s+research)\b/gi, "equational research")
      .replace(/\b(?:phonetic\s+corections?|phonetik\s+corrections?)\b/gi, "phonetic corrections")
      .replace(/\b(?:deaply)\b/gi, "deeply")
      .replace(/\b(?:defret\s*voices?|difrent\s*voices?)\b/gi, "different voices")
      .replace(/\b(?:look\s+defret|look\s+difrent)\b/gi, "look different")
      .replace(/\b(?:sound\s+defret|sound\s+difrent)\b/gi, "sound different")
      // Tuk Tuk omni-situational awareness and deep intellectual thinking STT normalizations
      .replace(/\b(?:one\s+talk\s+(?:reapet|repeat|repet)\s+(?:every\s+time|all\s+the\s+time)\s+not\s+(?:do|doing)\s+(?:intalactual|intelactual|intelectual|intalectual|intellectual)\s+(?:thinking|thinging)\s+(?:withou|without)\s+(?:halusination|halucination|hallusination|halutination|hallucination))\b/gi, "don't repeat the same talk every time, do intellectual thinking without hallucination")
      .replace(/\b(?:one\s+talk\s+(?:reapet|repeat|repet)\s+(?:every\s+time|all\s+the\s+time))\b/gi, "repeating the same talk every time")
      .replace(/\b(?:one\s+talk\s+(?:reapet|repeat|repet))\b/gi, "repeating the same talk")
      .replace(/\b(?:reapet)\b/gi, "repeat")
      .replace(/\b(?:withou)\b/gi, "without")
      .replace(/\b(?:halusination|halucination|hallusination|halutination|halusinason)\b/gi, "hallucination")
      .replace(/\b(?:undersatand\s+every\s+situtation|undersatand\s+every\s+situation|understand\s+every\s+situtation)\b/gi, "understand every situation")
      .replace(/\b(?:intalactual\s+thinging|intelactual\s+thinking|intalactual\s+thinking)\b/gi, "intellectual thinking")
      .replace(/\b(?:intalactual|intelactual|intelectual|intalectual)\b/gi, "intellectual")
      .replace(/\b(?:situtation)\b/gi, "situation")
      .replace(/\b(?:undersatand)\b/gi, "understand")
      .replace(/\b(?:thinging)\b(?=\s*(?:power|mode|ability|deep|intellectual))/gi, "thinking")
      // Zero Negativity, Unconditional Positivity & Emotional Safety STT normalizations
      .replace(/\b(?:tumara|tomra|tumra)\s+(?:amr|amar)\s+(?:upor|upore)\s+(?:kuno|kono)\s+(?:bebohare|babohare|bebohar|babohar)\s+(?:negitive|negetive|nagative|negative)\s+(?:hoyo\s*na|hoiyo\s*na|hoba\s*na|hobe\s*na)\b/gi, "tomra amar upor kono bebohare negative hoyo na")
      .replace(/\b(?:tumara|tumra)\b/gi, "tomra")
      .replace(/\bamr\b/gi, "amar")
      .replace(/\b(?:kuno|konu)\b/gi, "kono")
      .replace(/\b(?:negitive|negetive|nagative)\b/gi, "negative")
      // Architecture phonetic acoustic normalizations
      .replace(/\bwho\s+is\s+the\s+(?:arcitecture|arkitecture|artitecture|architechture|arcitect|arkitect)\b/gi, "who is the architect")
      .replace(/\b(?:arcitecture|arkitecture|artitecture|architechture)\b/gi, "architecture")
      .replace(/\b(?:arcitect|arkitect|architecht)\b/gi, "architect")
      // Speaker Tone, Personality & Room Guest Differentiation STT normalizations
      .replace(/\btutk\s*tuk\b/gi, "Tuk Tuk")
      .replace(/\bthare\s+tone\b/gi, "their tone")
      .replace(/\bpeopel\s+(?:on|in)\s+my\s+room\b/gi, "people in my room")
      .replace(/\bpeopel\b/gi, "people")
      .replace(/\bdefrence\s+person\b/gi, "differentiate person")
      .replace(/\bdefrence\b/gi, "differentiate")
      .replace(/\bhumen\b/gi, "human")
      // Conversational Mismatch & Intent Alignment STT normalizations
      .replace(/\bi\s+am\s+telling\s+(?:somthing|something)\s+and\s+(?:thay|they)\s+are\s+(?:reply\s*ing|replying)\s+other\s+(?:think|thing)\s+fix\s+all\s+(?:the\s+)?(?:miss\s*match|missmatch|mismatch)\s+issues\b/gi, "I am telling something and they are replying other thing, fix all the mismatch issues")
      .replace(/\bthay\s+are\s+reply\s*ing\s+other\s+think\b/gi, "they are replying other thing")
      .replace(/\b(?:reply\s+ing|replying)\s+other\s+think\b/gi, "replying other thing")
      .replace(/\bother\s+think\b(?=\s*(?:fix|issue|mismatch|they|you|\.|\,|$))/gi, "other thing")
      .replace(/\bsomthing\b/gi, "something")
      .replace(/\breply\s+ing\b/gi, "replying")
      .replace(/\b(?:miss\s*match|missmatch)\b/gi, "mismatch")
      .replace(/\b(?:miss\s*match|missmatch)\s+issues?\b/gi, "mismatch issues")
      .replace(/\bchak\s+with\s+equationaly\b/gi, "check with equationally")
      .replace(/\b(?:chak|chack)\b(?=\s*(?:with|deeply|equationaly|all|it|this))/gi, "check")
      .replace(/\bequationaly\b/gi, "equationally")
      // Human Identity Recognition, Multimodal Voice, Face & Energy STT normalizations
      .replace(/\bdo\s+deep\s+research\s+(?:equationaly|equationally)\s+how\s+(?:humwn|human|humen)\s+(?:cen|can)\s+(?:remeber|rember|remember)\s+every\s+person\s+(?:voice|voise)\s+(?:fase|face)\s+and\s+(?:thay\s+are|they\s+are|their)\s+(?:enragy|energy)\s+to\s+know\s+who\s+is\s+the\s+real\s+one\s+need\s+to\s+fix\s+all\b/gi, "do deep research equationally how human can remember every person voice face and their energy to know who is the real one need to fix all")
      .replace(/\b(?:humwn|humen)\b/gi, "human")
      .replace(/\b(?:cen)\s+(?:remeber|rember|remember)\b/gi, "can remember")
      .replace(/\b(?:cen)\b(?=\s*(?:remember|hear|see|know|differentiate|do|fix))/gi, "can")
      .replace(/\b(?:remeber|rember)\b/gi, "remember")
      .replace(/\b(?:fase)\b(?=\s*(?:recognition|and|or|voice|energy|to|,|\.|$))/gi, "face")
      .replace(/\b(?:voice|voise)\s+(?:fase|face)\b/gi, "voice face")
      .replace(/\b(?:thay\s+are|they\s+are|thayre|theyre)\s+(?:enragy|energy)\b/gi, "their energy")
      .replace(/\bthay\b(?=\s*(?:are|can|remember|know|say|call))/gi, "they")
      // Cardiovascular & Cardiac Equational Parity STT normalizations
      .replace(/\b(?:thay\s+are|they\s+are|their)\s+(?:hart|harts|heart|hearts)\s+and\s+our\s+human\s+(?:hart|heart)\s+(?:same\s+like\s+equationaly|same\s+like\s+equationally|same\s+equationaly|same\s+equationally)\s*(?:or\s+not)?\s*(?:with\s+deep\s+test\s+tell\s+me|with\s+deep\s+test|tell\s+me)?\b/gi, "Are their heart and our human heart same like equationally or not, with a deep test tell me")
      .replace(/\b(?:thay\s+are|they\s+are)\s+(?:hart|harts|heart|hearts)\b/gi, "their heart")
      .replace(/\bhuman\s+hart\b/gi, "human heart")
      .replace(/\bhart\b(?=\s*(?:and|is|are|same|beat|rate|pacing|rhythm|hrv|test|equationaly|equationally|,|\.|$))/gi, "heart")
      // Zero Robotic Voice Across Codebase STT normalizations
      // Handles: "remove all robtic voice from code base no need need 0 robtic voice english and bangal and all the agents"
      .replace(/\b(?:remove|delete|clean)\s+all\s+(?:robtic|robotic)\s+voices?\s+from\s+(?:code\s*base|codebase)\s+(?:no\s+need|noneed)\s+(?:need\s+0|need\s+zero)\s+(?:robtic|robotic)\s+voices?\s+(?:in\s+)?(?:english|eng)\s+and\s+(?:bangal|bangla|bengali)\s+and\s+all\s+(?:the\s+)?agents\b/gi, "remove all robotic voice from codebase, no need, need 0 robotic voice English and Bangla and all the agents")
      .replace(/\b(?:robtic)\b/gi, "robotic")
      .replace(/\b(?:bangal)\b(?=\s*(?:and|voice|voices|speech|language|,|\.|$))/gi, "Bangla")
      // Human Conversational Instant Response & Turn-Taking Comparison STT normalizations
      // Handles: "need instent respons humen like chack a humen kivabe taik kore ar ara kivabe talk koretese dekhe bolo"
      .replace(/\b(?:need\s+)?(?:instent|instant)\s+(?:respons|response)\s+(?:humen|human)\s*(?:like)?\s*[,;–-]?\s*(?:chack|chak|check)\s+(?:a\s+)?(?:humen|human)\s+(?:kivabe|kibhabe|kivhabe|how)\s+(?:taik|talk|kotha\s+bole)\s*(?:kore|bole)?\s*(?:ar|and|ora|er)\s*(?:ara|era|ora|they)\s+(?:kivabe|how)\s+(?:talk|kotha)\s+(?:koretese|kortese|korteche|bolche)\s*(?:dekhe\s+bolo|dekhe\s+dekho|tell\s+me)?\b/gi, "need instant response human-like, check how a human talks and how they are talking, look and tell me")
      .replace(/\b(?:instent)\b/gi, "instant")
      .replace(/\b(?:respons)\b(?=\s*(?:time|latency|delay|human|like|from|\.|\,|$))/gi, "response")
      .replace(/\b(?:taik)\b(?=\s*(?:kore|koretese|kortese|korte|about|with|to|in))/gi, "talk")
      // Modern Girl Bengali Tone & 1:1 English-Bangla Tuk Tuk Parity STT normalizations
      // Handles: "need mordern girl like bangal tone for tuk tuk not match english tuktuk and bangal tuk tuk are same"
      .replace(/\b(?:need\s+)?(?:mordern|modern)\s+girl\s*(?:like)?\s+(?:bangal|bangla|bengali)\s+tone\s+for\s+tuk\s*tuk\s+(?:not\s+match|not\s+matching|they\s+dont\s+match|different)\s+(?:in\s+)?(?:english\s*(?:tuk\s*tuk|tuktuk)?\s*(?:and|\&)\s*(?:bangal|bangla|bengali)\s*(?:tuk\s*tuk|tuktuk)?\s*(?:are\s+same|same\s*na|must\s+be\s+same|same))\b/gi, "need modern girl-like Bangla tone for Tuk Tuk, they do not match, English Tuk Tuk and Bangla Tuk Tuk are the same")
      .replace(/\b(?:mordern)\b/gi, "modern")
      .replace(/\b(?:bangal)\s+tone\b/gi, "Bangla tone")
      .replace(/\b(?:bangal)\s+(?:tuk\s*tuk|tuktuk)\b/gi, "Bangla Tuk Tuk")
      // Anti-Khet Caricature & Authentic Sophisticated Modern Girl STT normalizations
      // Handles: "not like mordan garl like taking its khet girl", "khet girl", "khet tone"
      .replace(/\b(?:not\s+like\s+mordan\s+garl\s+like\s+taking\s+its\s+khet\s+girl)\b/gi, "not like modern girl talking, it is khet girl, eliminate tacky caricature and sound authentic sophisticated and natural")
      .replace(/\b(?:mordan\s+garl|mordarn\s+girl|mordan\s+girl|morder\s+girl|morder\s+garl)\b/gi, "modern girl")
      .replace(/\b(?:morder)\b/gi, "modern")
      .replace(/\b(?:proerly|proparly)\b/gi, "properly")
      .replace(/\bchak\b(?=\s+(?:the|a|how|kivabe|in|out|this|my|our|english|bangla|bangal|voice|system))/gi, "check")
      // Handles: "fix tuktuk voice tone proerly this tone is not a morder girl tone chak the english tuktuk voice and bangal tuktuk voice need to fix"
      .replace(/\b(?:fix\s+)?(?:tuk\s*tuk|tuktuk)\s+voice\s+tone\s+(?:proerly|proparly|properly)\s*(?:[,;–-]?\s*)?(?:this\s+tone\s+is\s+not\s+(?:a\s+)?(?:morder|mordern|mordan|modern)\s+girl\s+tone)\s*(?:[,;–-]?\s*)?(?:chak|chack|check)\s+(?:the\s+)?english\s+(?:tuk\s*tuk|tuktuk)\s+voice\s+(?:and|\&)\s+(?:bangal|bangla|bengali)\s+(?:tuk\s*tuk|tuktuk)\s+voice\s*(?:need\s+to\s+fix|fix\s+it|fix)?\b/gi, "Fix Tuk Tuk voice tone properly, this tone is not a modern girl tone, check the English Tuk Tuk voice and Bangla Tuk Tuk voice, need to fix")
      .replace(/\b(?:like\s+taking)\b/gi, "like talking")
      // Squad Bangla Voice Fix STT normalizations
      // Handles: "fix vison bangal dd bangal and fryday bangal fix all the issues",
      // "vison bangal", "dd bangal", "fryday bangal"
      .replace(/\b(?:fix\s+)?(?:vison|vision)\s+(?:bangal|bangla|bengali)\s+(?:dd|brian)\s+(?:bangal|bangla|bengali)\s+(?:and\s+)?(?:fryday|friday)\s+(?:bangal|bangla|bengali)\s+(?:fix\s+all\s+(?:the\s+)?issues|fix\s+all\s+issues|fix\s+all)\b/gi, "fix Vision Bangla, DD Bangla, and Friday Bangla, fix all the issues")
      .replace(/\b(?:vison)\s+(?:bangal|bangla|bengali)\b/gi, "Vision Bangla")
      .replace(/\b(?:dd)\s+(?:bangal|bangla|bengali)\b/gi, "DD Bangla")
      .replace(/\b(?:fryday|friday)\s+(?:bangal|bangla|bengali)\b/gi, "Friday Bangla")
      // Human Head vs Disembodied Brain STT normalizations
      // Handles: "chacwk thay has humen like hade na only brain has no head"
      .replace(/\b(?:chacwk|chack|chak|check)\s+(?:thay|they)\s+(?:has|have)\s+(?:humen|human)\s*(?:like)?\s+(?:hade|head)\s+(?:na|or|and)\s+(?:only\s+)?brain\s+(?:has\s+)?no\s+head\b/gi, "Check whether they have a human-like head or only a brain with no head")
      .replace(/\bchacwk\b/gi, "check")
      .replace(/\b(?:thay|they)\s+has\b/gi, "they have")
      .replace(/\b(?:humen|human)\s+like\s+(?:head|hade)\b/gi, "human-like head")
      .replace(/\bhade\b/gi, "head")
      // Model change voice tone & language proficiency STT normalizations
      // Handles: "when we change the model voice and tone and laguage proficiancy same need to fix this or test the best model more best clear mordern voice"
      .replace(/\b(?:when\s+we\s+change\s+the\s+model\s+voice\s+and\s+tone\s+and\s+(?:language|laguage)\s+(?:proficiency|proficiancy)\s+same\s+need\s+to\s+fix\s+this\s+or\s+test\s+the\s+best\s+model\s+(?:more\s+best\s+)?clear\s+(?:mordern|modern)\s+voice)\b/gi, "When we change the model, voice and tone and language proficiency must stay the same, fix this and test the best model for the clearest modern voice")
      .replace(/\b(?:laguage|language)\s*(?:proficiancy|proficiency)\b/gi, "language proficiency")
      .replace(/\b(?:more\s+best|more\s+better)\b/gi, "the best")
      .replace(/\b(?:clear\s+mordern\s+voice|clear\s+modern\s+voice)\b/gi, "clear modern voice")
      .replace(/\bmordern\s+voice\b/gi, "modern voice")
      .replace(/\bcha\s*kand\b/gi, "check and")
      // City Modern Girl Tone & Zero Village Girl Habits / Punctuation Normalizations
      // Handles: "do deep reserach need bangal tone like a city mordern garl like not vilage girl remove all the vilage girl habit and tone and word pancuaation fix all all issues equationaly and remove all duplicate code"
      .replace(/\b(?:do\s+deep\s+)?(?:reserach|research)\s+(?:need\s+)?(?:bangal|bangla|bengali)\s+tone\s+like\s+a\s+city\s+(?:mordern|modern|mordan)\s+(?:garl|girl)\s+(?:like\s+)?not\s+(?:a\s+)?(?:vilage|village)\s+girl\s+(?:remove\s+all\s+(?:the\s+)?(?:vilage|village)\s+girl\s+habits?\s+and\s+tone\s+and\s+word\s+(?:pancuaation|punctuation)\s+)?fix\s+all(?:\s+all)?\s+issues\s+(?:equationaly|equationally)\s+and\s+remove\s+all\s+duplicate\s+code\b/gi, "do deep research, need Bangla tone like a city modern girl not village girl, remove all the village girl habits and tone and word punctuation, fix all issues equationally and remove all duplicate code")
      .replace(/\b(?:city\s+mordern\s+garl|city\s+mordan\s+garl|city\s+mordern\s+girl|city\s+mordan\s+girl)\b/gi, "city modern girl")
      .replace(/\b(?:mordern\s+garl|mordan\s+garl|modern\s+garl)\b/gi, "modern girl")
      .replace(/\b(?:vilage\s+girl\s+habits?|village\s+girl\s+habits?)\b/gi, "village girl habits")
      .replace(/\b(?:vilage\s+girl)\b/gi, "village girl")
      .replace(/\b(?:word\s+pancuaation|word\s+punctuation)\b/gi, "word punctuation")
      .replace(/\bpancuaation\b/gi, "punctuation")
      .replace(/\breserach\b/gi, "research")
      .replace(/\bfix\s+all\s+all\s+issues\b/gi, "fix all issues")
      .replace(/\bremove\s+all\s+duplicate\s+code\b/gi, "remove all duplicate code")
      // Anti-Looping, Anti-Repetition & Anti-Hallucination STT normalizations
      // Handles: "fix all loop loop gives us working problem not intaaqtual vibe not give me every word sentens and every talk 0 loop 0 repitation 0 duplicate need fullly and faster responsibe thinke like a real human fix every gap with deep equationaly"
      .replace(/\b(?:fix\s+all\s+)?loop\s*loop\s+gives\s+(?:us\s+)?working\s+problems?\s+not\s+(?:intaaqtual|intalaqtual|intelectual|intellectual)\s+vibes?\s+not\s+give\s+me\s+every\s+word\s+(?:sentens|sentence|sentense)\s+and\s+every\s+talk\s+0\s+loops?\s+0\s+(?:repitation|repetition)\s+0\s+duplicates?\s+need\s+(?:fullly|fully)\s+and\s+faster\s+(?:responsibe|responsive)\s+(?:thinke|think)\s+like\s+a\s+real\s+human\s+fix\s+every\s+gap\s+with\s+deep\s+(?:equationaly|equationally)\b/gi, "Fix all loops, loops give us working problems, not intellectual vibe, don't give me every word, sentence and every talk: 0 loops, 0 repetition, 0 duplicates, need fully and faster responsive, think like a real human, fix every gap with deep equationally")
      .replace(/\b0\s+loops?\s+0\s+(?:repitation|repetition)\s+0\s+duplicates?\b/gi, "0 loops, 0 repetition, 0 duplicates")
      .replace(/\b0\s+loop\b/gi, "0 loops")
      .replace(/\b0\s+repitation\b/gi, "0 repetition")
      .replace(/\b0\s+duplicate\b/gi, "0 duplicates")
      .replace(/\b(?:intaaqtual|intalaqtual|intalactual|intelectual|intalectual|intalaqtuel)\s+vibes?\b/gi, "intellectual vibe")
      .replace(/\b(?:intaaqtual|intalaqtual|intalactual|intelectual|intalectual|intalaqtuel)\b/gi, "intellectual")
      .replace(/\b(?:repitation|repitition)\b/gi, "repetition")
      .replace(/\b(?:sentens)\b/gi, "sentence")
      .replace(/\bfullly\b/gi, "fully")
      .replace(/\b(?:responsibe|responcive)\b/gi, "responsive")
      .replace(/\bthinke\b/gi, "think")
      // Handles: "fix all loop ing issues thay are all day in loop and halusinate"
      // Handles: "why thay repet saame talk again agin not thay are intalaqtual and all"
      .replace(/\b(?:fix\s+all\s+)?(?:loop\s*ing|looping)\s+issues?\s+(?:thay|they)\s+are\s+all\s+day\s+in\s+(?:a\s+)?loop\s+and\s+(?:halusinate|halucinate|hallucinate)\b/gi, "Fix all looping issues, they are all day in a loop and hallucinate")
      .replace(/\bwhy\s+(?:thay|they)\s+(?:repet|repeat)\s+(?:saame|same)\s+talk\s+again\s+(?:agin|again)\s+(?:not\s+(?:thay|they)\s+are|aren't\s+they)\s+(?:intalaqtual|intalaqtuel|intellectual)\s+and\s+all\b/gi, "Why do they repeat the same talk again and again, aren't they intellectual and all?")
      .replace(/\bloop\s*ing\b/gi, "looping")
      .replace(/\ball\s+day\s+in\s+loop\b/gi, "all day in a loop")
      .replace(/\b(?:halusinate|halucinate)\b/gi, "hallucinate")
      .replace(/\b(?:halusinating|halucinating)\b/gi, "hallucinating")
      .replace(/\b(?:halusination|halucination)\b/gi, "hallucination")
      .replace(/\bsaame\b/gi, "same")
      .replace(/\bagin\b/gi, "again")
      .replace(/\brepet\b/gi, "repeat")
      // Self-Learning Loop Purge & Recursive Loop Elimination STT normalizations
      // Handles: "fix the self learning all issues some time its creat loop chac kand fix everyissues"
      .replace(/\b(?:fix\s+(?:the\s+)?)?self\s*learning\s+(?:all\s+)?issues?\s+(?:some\s*times?|some\s+time)\s+(?:its|it\s+is|it)\s+(?:creat|creates?|creating)\s+(?:a\s+)?loops?\s+(?:chac\s*kand|chac\s+kand|chak\s*and|chak\s+kand|check\s+and|check)\s+(?:fix\s+)?(?:everyissues|every\s+issues?|all\s+issues?)\b/gi, "Fix all self-learning issues, sometimes it creates loops, check and fix every issue")
      .replace(/\bself\s*learning\s+all\s+issues\b/gi, "all self-learning issues")
      .replace(/\b(?:some\s*time|some\s+time)\s+(?:its|it)\s+(?:creat|creates?)\s+loops?\b/gi, "sometimes it creates loops")
      .replace(/\b(?:some\s*time|some\s+time)\b(?=\s+(?:it|its|they|we|you|he|she))/gi, "sometimes")
      .replace(/\b(?:creat)\s+loops?\b/gi, "create loops")
      .replace(/\b(?:creat)\b/gi, "create")
      .replace(/\b(?:chac\s*kand|chac\s+kand|chak\s*and|chak\s+kand)\b/gi, "check and")
      .replace(/\beveryissues\b/gi, "every issue")
      // Universal Bilingual Identity Parity & Modern Girl Tone Harmonization STT normalizations
      // Handles: "fix english tuk tuk and bangal. tuktuk every side need same person english tone with bangal for mordern girl style bangal test cahc klisten and fix every gap of all the agents same rule"
      .replace(/\b(?:fix\s+)?english\s+(?:tuk\s*tuk|tuktuk)\s+(?:and|\&)\s+(?:bangal|bangla)\.?\s*(?:tuk\s*tuk|tuktuk)\s+every\s+side\s+need\s+same\s+person\s+english\s+tone\s+with\s+(?:bangal|bangla)\s+for\s+(?:mordern|modern|mordan)\s+girl\s+style\s+(?:bangal|bangla)\s+(?:test\s+)?(?:cahc|chack|chak|check)\s*(?:and\s+)?(?:klisten|listen)\s+and\s+fix\s+every\s+gap\s+of\s+all\s+(?:the\s+)?agents\s+same\s+rule\b/gi, "fix English Tuk Tuk and Bangla Tuk Tuk, every side need same person, English tone with Bangla for modern girl style Bangla, test, check, listen and fix every gap of all the agents same rule")
      .replace(/\b(?:bangal|bangla)\.\s*(?:tuk\s*tuk|tuktuk)\b/gi, "Bangla Tuk Tuk")
      .replace(/\bcahc\s+klisten\b/gi, "check and listen")
      .replace(/\b(?:cahc)\b/gi, "check")
      .replace(/\b(?:klisten)\b/gi, "listen")
      .replace(/\b(?:mordern|mordan)\s+girl\s+style\s+(?:bangal|bangla)\b/gi, "modern girl style Bangla")
      .replace(/\bevery\s+side\s+need\s+same\s+person\b/gi, "every side need same person")
      .replace(/\bfix\s+every\s+gap\s+of\s+all\s+(?:the\s+)?agents\s+same\s+rule\b/gi, "fix every gap of all the agents same rule")
      // Multi-Conversational Session Fluency & Active Co-Building Vibe STT normalizations
      // Handles: "fix every agent malti conversational sation need fully fluent vibe for working building and updateing anything need real human behabeior on every side"
      .replace(/\b(?:fix\s+)?every\s+agent\s+(?:malti|multi)\s+conversational\s+(?:sation|session)\s+need\s+fully\s+fluent\s+vibe\s+for\s+working\s+building\s+and\s+(?:updateing|updating)\s+anything\s+need\s+real\s+human\s+(?:behabeior|behavior)\s+on\s+every\s+side\b/gi, "fix every agent multi-conversational session, need fully fluent vibe for working, building, and updating anything, need real human behavior on every side")
      .replace(/\b(?:malti|multi)\s+conversational\s+(?:sation|session)\b/gi, "multi-conversational session")
      .replace(/\bconversational\s+sation\b/gi, "conversational session")
      .replace(/\bconversations?\s+sation\b/gi, "conversation session")
      .replace(/\bmalti\b/gi, "multi")
      .replace(/\bupdateing\b/gi, "updating")
      .replace(/\bbehabeior\b/gi, "behavior")
      .replace(/\bworking\s+building\s+and\s+(?:updateing|updating)\s+anything\b/gi, "working, building, and updating anything")
      .replace(/\breal\s+human\s+(?:behabeior|behavior)\s+on\s+every\s+side\b/gi, "real human behavior on every side")
      // Tuk Tuk Team Leader, Real English Pronunciation & Talking Communication STT normalizations
      // Handles: "see fix every pronunciation he is not real english like tuk tuk fix her personalty and. tone and all update it fully perfect in taliking comunication team leader and all"
      .replace(/\b(?:see\s*,?\s*)?fix\s+every\s+pronunciation\s+(?:he|she)\s+is\s+not\s+real\s+english\s+like\s+(?:tuk\s*tuk|tuktuk)\s+fix\s+her\s+(?:personalty|personality)\s+and\.?\s*tone\s+and\s+all\s+update\s+it\s+fully\s+perfect\s+in\s+(?:taliking|talking)\s+(?:comunication|communication)\s+team\s+leader\s+and\s+all\b/gi, "see, fix every pronunciation, she is not real English like Tuk Tuk, fix her personality and tone and all, update it fully perfect in talking communication, team leader and all")
      .replace(/\btaliking\b/gi, "talking")
      .replace(/\bcomunication\b/gi, "communication")
      .replace(/\bpersonalty\b/gi, "personality")
      .replace(/\b(?:pronounciation|pronuciation|pronunsation)\b/gi, "pronunciation")
      .replace(/\b(?:he|she)\s+is\s+not\s+real\s+english\s+like\s+(?:tuk\s*tuk|tuktuk)\b/gi, "she is not real English like Tuk Tuk")
      .replace(/\bteam\s+leader\s+and\s+all\b/gi, "team leader and all");

    // 2. Remove speech disfluency and stutters (preserving intentional grammatical reduplication like 'bar bar', 'dhire dhire', 'tuk tuk')
    text = text
      .replace(/\b(?:um|uh|er|ah)\b/gi, "")
      .replace(/\b(?!(?:bar|dhire|choto|gorom|shob|ek|bhalo|ki|tuk)\b)(\w+)\s+\1\b/gi, "$1") // De-duplicate accidental stutters while keeping Bengali reduplication and Tuk Tuk
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
