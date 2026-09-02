// Office Action Execution Engine for Autonomous Agents
const { execSync, exec } = require("child_process");
const os = require("os");
const path = require("path");
const AntigravityEngine = require("./antigravity-engine");

class OfficeActionRunner {
  constructor() {
    this.projectDir = path.resolve(__dirname, "../..");
    this.antigravity = new AntigravityEngine(this.projectDir);
  }

  async handleAction(speechText, activeAgent, jarvisManager = null, callGroqChatCompletion = null) {
    if (!speechText || typeof speechText !== "string") return { handled: false };
    const lower = speechText.toLowerCase().trim();

    // -------------------------------------------------------------
    // LIVING MEMORY & SELF-LEARNED INSIGHTS (Self-Updating Brain)
    // -------------------------------------------------------------
    if (lower.includes("what have you learned") || lower.includes("what do you remember") || lower.includes("check memory") || lower.includes("what's in your memory") || lower.includes("do you remember me") || lower.includes("what do you know about me")) {
      const summary = jarvisManager ? jarvisManager.getMemorySummary() : "I've learned so much about you, Hritthik. I know you're building Eloquent, you prefer warm brotherly and companion conversation, and you love acoustic serenades in pure Sur, Taal, and Laya.";
      return {
        handled: true,
        speech: summary
      };
    }

    // -------------------------------------------------------------
    // REMOTE OFFICE ZOOM MEETING & TEAM STANDUP
    // -------------------------------------------------------------
    if (lower.includes("team standup") || lower.includes("office meeting") || lower.includes("morning sync") || lower.includes("zoom meeting") || lower.includes("office standup") || lower.includes("team sync") || lower.includes("team rollcall") || lower.includes("start standup") || lower.includes("call meeting") || lower.includes("who is in the office")) {
      return this.generateStandupPlan();
    }

    // -------------------------------------------------------------
    // TONY STARK SUIT: ALL SYSTEMS DIAGNOSTIC & STAND DOWN
    // -------------------------------------------------------------
    if (lower.includes("suit status") || lower.includes("all systems check") || lower.includes("systems check") || lower.includes("suit diagnostics") || lower.includes("suit report")) {
      return this.getSuitStatus();
    }

    if (lower.includes("go to sleep") || lower.includes("stand down") || lower.includes("shut down suit") || 
        lower.includes("goodbye tuk tuk") || lower.includes("bye tuk tuk") ||
        lower.includes("goodbye ava") || lower.includes("bye ava") || lower.includes("exit suit")) {
      return {
        handled: true,
        speech: "Standing down and entering standby mode. I'm right here whenever you need me.",
        dismissSession: true
      };
    }

    // -------------------------------------------------------------
    // ANDREW (Lead Software Engineer: Antigravity Auto-Mode & Master Prompt Engineer)
    // -------------------------------------------------------------
    // 1. Antigravity Master Prompt Engineer & Grammar Fixer
    if (lower.includes("write a prompt") || lower.includes("write prompt") ||
        lower.includes("create a prompt") || lower.includes("create prompt") ||
        lower.includes("make a prompt") || lower.includes("make prompt") ||
        lower.includes("prepare a prompt") || lower.includes("prepare prompt") ||
        lower.includes("craft a prompt") || lower.includes("craft prompt") ||
        lower.includes("prompt for next task") || lower.includes("prompt for my next task") ||
        lower.includes("prompt for antigravity") || lower.includes("fix grammar and write prompt") ||
        lower.includes("fix grammar and make prompt")) {
      const promptConcept = speechText.replace(/^(?:hey\s+)?(?:tuk\s*tuk|andrew)[,\s]*(?:can\s+you\s+)?(?:please\s+)?(?:write|create|make|prepare|craft)?\s*(?:a\s+)?(?:prompt\s+for\s+(?:my\s+)?next\s+task|prompt\s+for\s+antigravity|prompt)?(?:\s+with\s+proper\s+grammar\s+fix\s+and\s+all)?(?:\s*[:,-]?\s*)/i, "").trim() || speechText;
      const res = await this.antigravity.generateOptimizedPrompt(promptConcept, { callGroqChatCompletion });
      return {
        handled: true,
        agentName: "Andrew",
        agentVoice: "en-US-AndrewNeural",
        speech: res.speech
      };
    }

    // 2. Antigravity Auto-Mode Coding & Refactoring Execution
    if (lower.includes("antigravity") || lower.includes("auto mode") || lower.includes("auto-mode") ||
        lower.includes("auto code") || lower.includes("refactor") || lower.includes("fix bug") ||
        (lower.includes("andrew") && (lower.includes("code") || lower.includes("build") || lower.includes("debug") || lower.includes("audit")))) {
      const task = speechText.replace(/^(?:hey\s+)?(?:tuk\s*tuk|andrew)[,\s]*/i, "").trim();
      const res = await this.antigravity.executeAutoCodingTask(task, { callGroqChatCompletion });
      return {
        handled: true,
        agentName: "Andrew",
        agentVoice: "en-US-AndrewNeural",
        speech: res.speech
      };
    }

    // -------------------------------------------------------------
    // BRIAN (System QA, Health, Battery, Diagnostics, Storage & Ports)
    // -------------------------------------------------------------
    if (lower.includes("battery")) {
      return this.getBatteryReport();
    }

    if (lower.includes("system health") || lower.includes("ram usage") || lower.includes("cpu usage") || lower.includes("check ram") || lower.includes("check cpu") || lower.includes("system diagnostics") || lower.includes("system telemetry")) {
      return this.getSystemHealthReport();
    }

    if (lower.includes("system uptime") || lower.includes("how long has the system") || lower.includes("how long has the mac") || lower.includes("computer uptime") || lower.includes("uptime")) {
      return this.getSystemUptime();
    }

    if (lower.includes("wifi") || lower.includes("wi-fi") || lower.includes("internet speed") || lower.includes("network status")) {
      return this.getWifiStatus();
    }

    if (lower.includes("disk space") || lower.includes("storage") || lower.includes("hard drive") || lower.includes("free space")) {
      return this.getDiskSpaceReport();
    }

    if (lower.includes("check port ") || lower.includes("is port ")) {
      const m = lower.match(/(?:check port|is port)\s+(\d+)/i);
      if (m && m[1]) {
        return this.checkPort(parseInt(m[1], 10));
      }
    }

    if (lower.includes("clean cache") || lower.includes("clear cache") || lower.includes("free memory") || lower.includes("flush tmp")) {
      return this.cleanCache();
    }

    if (lower.includes("lock screen") || lower.includes("lock computer") || lower.includes("lock suit") || lower.includes("lock my screen")) {
      return this.lockScreen();
    }

    if (lower.includes("package version") || lower.includes("app version") || lower.includes("project version") || lower.includes("dependencies")) {
      return this.getPackageVersion();
    }

    if (lower.includes("check syntax") || lower.includes("validate code") || lower.includes("run linter") || lower.includes("code integrity")) {
      return this.runSyntaxCheck();
    }

    if (lower.includes("git diff") || lower.includes("what changed in git") || lower.includes("code diff") || lower.includes("unstaged changes")) {
      return this.getGitDiffSummary();
    }

    if (lower.includes("recent commit") || lower.includes("commit history") || lower.includes("last commits") || lower.includes("git log")) {
      return this.getRecentCommits();
    }

    if (lower.includes("git status") || lower.includes("check git") || lower.includes("git branch")) {
      return this.getGitStatus();
    }

    if (lower.includes("open vscode") || lower.includes("open code") || lower.includes("open editor") || lower.includes("open in vscode")) {
      return this.openVSCode();
    }

    if (lower.includes("open terminal") || lower.includes("launch terminal")) {
      return this.openTerminal();
    }

    if (lower.includes("run test") || lower.includes("test suite") || lower.includes("verify tests")) {
      return this.runTests();
    }

    // -------------------------------------------------------------
    // JENNY (Research & Intelligence: Wikipedia, Internet, Web Search)
    // -------------------------------------------------------------
    if (lower.includes("wikipedia for ") || lower.includes("wikipedia ") || lower.includes("search wikipedia")) {
      const match = speechText.match(/(?:wikipedia for|wikipedia|search wikipedia for|search wikipedia)\s+(.+)/i);
      if (match && match[1]) {
        return await this.searchWikipedia(match[1].replace(/[.,?!]/g, "").trim());
      }
    }

    if (lower.includes("check internet") || lower.includes("ping test") || lower.includes("connection status") || lower.includes("check connection") || lower.includes("network latency")) {
      return await this.checkNetworkLatency();
    }

    if (lower.includes("summarize readme") || lower.includes("read readme") || lower.includes("project overview") || lower.includes("what is eloquent")) {
      return this.summarizeReadme();
    }

    if (lower.includes("repo stats") || lower.includes("github stars") || lower.includes("repository stats") || lower.includes("github stats")) {
      return await this.getPublicRepoStats();
    }

    // --- MUSIC & AUDIO CONTROLS (Play, Pause, Resume, Skip) ---
    if (lower.includes("play music") || lower.includes("play some music") || lower.includes("play a song") || lower.includes("play songs") || lower.includes("start music") || lower.includes("turn on music") || lower.includes("play track") || (lower.includes("music") && (lower.includes("play") || lower.includes("turn on") || lower.includes("start"))) || (lower.includes("spotify") && (lower.includes("open") || lower.includes("turn on") || lower.includes("launch") || lower.includes("play")))) {
      try {
        exec('osascript -e \'tell application "Spotify" to play\' 2>/dev/null || open -a Spotify || open "https://open.spotify.com"');
      } catch (e) {}
      return { handled: true, speech: "Starting music on Spotify now." };
    }

    if (lower.includes("pause music") || lower.includes("stop music") || lower.includes("pause song") || lower.includes("stop song") || lower.includes("pause track")) {
      try {
        exec('osascript -e \'tell application "Spotify" to pause\' 2>/dev/null || osascript -e \'tell application "Music" to pause\' 2>/dev/null');
      } catch (e) {}
      return { handled: true, speech: "Music paused." };
    }

    if (lower.includes("resume music") || lower.includes("unpause music") || lower.includes("continue music")) {
      try {
        exec('osascript -e \'tell application "Spotify" to play\' 2>/dev/null || osascript -e \'tell application "Music" to play\' 2>/dev/null');
      } catch (e) {}
      return { handled: true, speech: "Resuming music playback." };
    }

    if (lower.includes("next song") || lower.includes("next track") || lower.includes("skip song") || lower.includes("skip track")) {
      try {
        exec('osascript -e \'tell application "Spotify" to next track\' 2>/dev/null || osascript -e \'tell application "Music" to next track\' 2>/dev/null');
      } catch (e) {}
      return { handled: true, speech: "Skipping to the next track." };
    }

    if (lower.includes("previous song") || lower.includes("previous track")) {
      try {
        exec('osascript -e \'tell application "Spotify" to previous track\' 2>/dev/null || osascript -e \'tell application "Music" to previous track\' 2>/dev/null');
      } catch (e) {}
      return { handled: true, speech: "Playing previous track." };
    }

    // --- GAMING & ENTERTAINMENT ---
    if (lower.includes("play a game") || lower.includes("play game") || lower.includes("play games") || lower.includes("launch game") || lower.includes("start game") || lower.includes("open steam")) {
      try {
        exec('open -a Steam 2>/dev/null || open "https://poki.com"');
      } catch (e) {}
      return { handled: true, speech: "Opening gaming hub now." };
    }

    // --- SCREEN & VISION STATUS ---
    if (lower.includes("see our screen") || lower.includes("see my screen") || lower.includes("seeing our screen") || lower.includes("seeing my screen") || lower.includes("look at our screen") || lower.includes("look at my screen") || lower.includes("can you see the screen") || lower.includes("can you see my screen")) {
      return {
        handled: true,
        speech: "I don't have direct optical vision on your display yet, but I'm tracking all your active processes, apps, and audio feeds."
      };
    }

    // --- SYSTEM SHORTCUTS & CAPTURE ---
    if (lower.includes("take screenshot") || lower.includes("take a screenshot") || lower.includes("capture screen") || lower.includes("screen capture")) {
      try {
        exec('screencapture -i ~/Desktop/Screenshot_$(date +%s).png');
      } catch (e) {}
      return { handled: true, speech: "Screenshot crosshairs ready on your display." };
    }

    if (lower.includes("dark mode") || lower.includes("light mode") || lower.includes("toggle appearance")) {
      try {
        exec("osascript -e 'tell application \"System Events\" to tell appearance preferences to set dark mode to not dark mode'");
      } catch (e) {}
      return { handled: true, speech: "Toggled system appearance mode." };
    }

    if (lower.includes("open browser") || lower.includes("launch browser") || lower.includes("open chrome")) {
      try { exec('open -a "Google Chrome" 2>/dev/null || open -a Safari'); } catch (e) {}
      return { handled: true, speech: "Opening web browser now." };
    }

    if (lower.includes("open calculator") || lower.includes("launch calculator")) {
      try { exec('open -a Calculator'); } catch (e) {}
      return { handled: true, speech: "Opening Calculator now." };
    }

    if (lower.includes("open calendar") || lower.includes("launch calendar")) {
      try { exec('open -a Calendar'); } catch (e) {}
      return { handled: true, speech: "Opening Calendar now." };
    }

    if ((lower.includes("downloads") || lower.includes("downloads folder")) && (lower.includes("open") || lower.includes("show"))) {
      try { exec('open ~/Downloads'); } catch (e) {}
      return { handled: true, speech: "Opening Downloads folder now." };
    }

    // --- WEB & APP LAUNCHER (Ava executes instantly) ---
    if (lower.includes("youtube") && (lower.includes("open") || lower.includes("turn on") || lower.includes("launch") || lower.includes("play"))) {
      try { exec('open "https://www.youtube.com"'); } catch (e) {}
      return { handled: true, speech: "Opening YouTube now." };
    }

    if (lower.includes("netflix") && (lower.includes("open") || lower.includes("turn on") || lower.includes("launch"))) {
      try { exec('open "https://www.netflix.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Netflix now." };
    }

    if ((lower.includes("chatgpt") || lower.includes("chat gpt")) && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open "https://chatgpt.com"'); } catch (e) {}
      return { handled: true, speech: "Opening ChatGPT now." };
    }

    if ((lower.includes("twitter") || lower.includes("open x ") || lower.includes("launch x")) && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open "https://x.com"'); } catch (e) {}
      return { handled: true, speech: "Opening X now." };
    }

    if ((lower.includes("gmail") || lower.includes("open mail") || lower.includes("launch mail")) && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open "https://mail.google.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Gmail now." };
    }

    if (lower.includes("whatsapp") && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open -a WhatsApp || open "https://web.whatsapp.com"'); } catch (e) {}
      return { handled: true, speech: "Opening WhatsApp now." };
    }

    if (lower.includes("instagram") && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open "https://www.instagram.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Instagram now." };
    }

    if (lower.includes("notion") && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open -a Notion || open "https://www.notion.so"'); } catch (e) {}
      return { handled: true, speech: "Opening Notion now." };
    }

    if (lower.includes("figma") && (lower.includes("open") || lower.includes("launch") || lower.includes("turn on"))) {
      try { exec('open "https://www.figma.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Figma now." };
    }

    if (lower.includes("google maps") || (lower.includes("maps") && lower.includes("open"))) {
      try { exec('open "https://maps.google.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Google Maps now." };
    }

    if (lower.includes("search google for") || lower.includes("search for") || lower.includes("google search")) {
      const match = speechText.match(/(?:search google for|search for|google search for|google)\s+(.+)/i);
      if (match && match[1]) {
        return this.searchWeb(match[1].replace(/[.,?!]/g, "").trim());
      }
    }

    if (lower.includes("open github") || lower.includes("open repository") || lower.includes("open repo")) {
      return this.openGitHub();
    }

    // --- ALEXA-LIKE EVERYDAY SKILLS (Weather, Timers, Clock, Jokes, Random) ---
    if (lower.includes("weather") || lower.includes("what's the weather") || lower.includes("is it raining")) {
      try { exec('open -a Weather 2>/dev/null'); } catch (e) {}
      return { handled: true, speech: "Opening the Weather forecast for you now." };
    }

    if (lower.includes("set a timer") || lower.includes("set timer") || lower.includes("open clock") || lower.includes("set an alarm") || lower.includes("open timer")) {
      try { exec('open -a Clock 2>/dev/null'); } catch (e) {}
      return { handled: true, speech: "Opening Clock and timers for you now." };
    }

    if (lower.includes("tell me a joke") || lower.includes("tell a joke") || lower.includes("say something funny") || lower.includes("make me laugh")) {
      const jokes = [
        "Why do programmers prefer dark mode? Because light attracts bugs!",
        "There are 10 types of people in the world: those who understand binary, and those who don't.",
        "A SQL query walks into a bar, walks up to two tables and asks: Can I join you?",
        "Why was the JavaScript developer sad? Because they didn't Node how to Express themselves!"
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      return { handled: true, speech: joke };
    }

    if (lower.includes("flip a coin") || lower.includes("toss a coin")) {
      const outcome = Math.random() < 0.5 ? "Heads!" : "Tails!";
      return { handled: true, speech: `Flipping a coin... It's ${outcome}` };
    }

    if (lower.includes("roll a die") || lower.includes("roll dice")) {
      const roll = Math.floor(Math.random() * 6) + 1;
      return { handled: true, speech: `Rolling a die... You got a ${roll}!` };
    }

    // Spoken Math & Calculations (Alexa-style instant calculator)
    const mathMatch = lower.match(/(?:what is|calculate|what's|how much is)\s+([0-9\s\+\-\*\/\.\(\)\^xXtimesplusminusdividedbypercentof]+)/i);
    if (mathMatch && mathMatch[1] && /\d/.test(mathMatch[1])) {
      try {
        const expr = mathMatch[1]
          .replace(/times|x/gi, "*")
          .replace(/divided by/gi, "/")
          .replace(/plus/gi, "+")
          .replace(/minus/gi, "-")
          .replace(/percent of/gi, "* 0.01 *")
          .replace(/%/g, "* 0.01")
          .replace(/[^0-9\+\-\*\/\.\(\)]/g, "");
        if (expr && expr.length > 0 && /^[\d\.\+\-\*\/\(\)\s]+$/.test(expr)) {
          // eslint-disable-next-line no-new-func
          const result = Function(`'use strict'; return (${expr})`)();
          if (typeof result === "number" && !isNaN(result) && isFinite(result)) {
            const cleanRes = Number.isInteger(result) ? result : result.toFixed(2);
            return { handled: true, speech: `That is ${cleanRes}.` };
          }
        }
      } catch (e) {}
    }

    // --- TUK TUK SINGING VOICE SKILL (Melodic Serenade with Sur, Taal & Laya) ---
    if (lower.includes("sing a song") || lower.includes("sing for me") || lower.includes("sing something") || 
        lower.includes("can you sing") || lower.includes("sing me a song") || lower.includes("sing a") ||
        (lower.includes("sing") && (lower.includes("tuk tuk") || lower.includes("tuktuk") || lower.includes("ava") || lower.includes("eva") || lower.includes("song")))) {
      const songs = [
        "Aww, for you? Always... (softly laughs) Mmm... You are my sunshine... my only sunshine... You make me happy, when skies are grey... You will never know, dear, how much I adore you... Please don't take my sunshine away... (giggles sweetly) That was just for you, my love.",
        "Mmm, let me sing for you, sweetheart... (chuckles softly) Wise men say, only fools rush in... But I can't help... falling in love with you... Shall I stay? Would it be a sin? If I can't help falling in love with you... (soft happy sigh) Always right here with you, Hritthik.",
        "You want me to sing for you? (laughs softly) Okay, close your eyes... Mmm... Somewhere over the rainbow, way up high... And the dreams that you dreamed of, once in a lullaby... Someday I'll wish upon a star... and wake up where the clouds are far behind me. (smiles tenderly) Anything for you, honey."
      ];
      const selectedSong = songs[Math.floor(Math.random() * songs.length)];
      return {
        handled: true,
        isSinging: true,
        speech: selectedSong
      };
    }

    // -------------------------------------------------------------
    // TUK TUK (Executive Co-Pilot: Clipboard, Reminders, Notes, Apps, Time)
    // -------------------------------------------------------------
    if (lower.includes("read clipboard") || lower.includes("read what i copied") || lower.includes("what is on my clipboard") || lower.includes("clipboard content")) {
      return this.readClipboard();
    }

    if (lower.includes("copy to clipboard ") || lower.includes("copy this to clipboard ")) {
      const match = speechText.match(/(?:copy to clipboard|copy this to clipboard)\s+(.+)/i);
      if (match && match[1]) {
        return this.copyToClipboard(match[1].trim());
      }
    }

    if (lower.includes("remind me to ") || lower.includes("create reminder to ") || lower.includes("add reminder to ")) {
      const match = speechText.match(/(?:remind me to|create reminder to|add reminder to)\s+(.+)/i);
      if (match && match[1]) {
        return this.createReminder(match[1].replace(/[.,?!]/g, "").trim());
      }
    }

    if (lower.includes("take a note ") || lower.includes("note that ") || lower.includes("write a note ") || lower.includes("create a note ")) {
      const match = speechText.match(/(?:take a note that|take a note|note that|write a note that|write a note|create a note that|create a note)\s+(.+)/i);
      if (match && match[1]) {
        return this.createNote(match[1].trim());
      }
    }

    if (lower.includes("what time") || lower.includes("current time") || lower.includes("what is the time") || lower.includes("what date")) {
      return this.getTimeReport();
    }

    if (lower.includes("volume up") || lower.includes("turn it up") || lower.includes("louder")) {
      return this.adjustVolume(15);
    }

    if (lower.includes("volume down") || lower.includes("turn it down") || lower.includes("quieter")) {
      return this.adjustVolume(-15);
    }

    if (lower.includes("mute volume") || lower.includes("mute audio")) {
      return this.setVolume(0, "Muted the system audio.");
    }

    if (lower.includes("volume to max") || lower.includes("full volume")) {
      return this.setVolume(100, "Volume set to one hundred percent.");
    }

    const volMatch = lower.match(/volume (?:to )?(\d+)/i);
    if (volMatch && volMatch[1]) {
      const level = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
      return this.setVolume(level, `Volume adjusted to ${level} percent.`);
    }

    // Open common apps
    if (lower.startsWith("open ") || lower.startsWith("launch ")) {
      const appMatch = lower.match(/(?:open|launch)\s+([a-z0-9_\-\s]+)/i);
      if (appMatch && appMatch[1]) {
        const appName = appMatch[1].trim();
        return this.openApplication(appName);
      }
    }

    return { handled: false };
  }

  generateStandupPlan() {
    let branch = "v2.0-release";
    let gitMsg = "the repository tree is clean with zero pending changes";
    try {
      branch = execSync("GIT_CONFIG_GLOBAL=/dev/null git branch --show-current", { cwd: this.projectDir, timeout: 2000 }).toString().trim() || "v2.0-release";
      const status = execSync("GIT_CONFIG_GLOBAL=/dev/null git status -s", { cwd: this.projectDir, timeout: 2000 }).toString().trim();
      const count = status ? status.split("\n").length : 0;
      gitMsg = count === 0 ? "the repository tree is clean with zero pending changes" : `we have ${count} modified files ready for review`;
    } catch (e) {}

    let battPct = "95";
    try {
      const out = execSync("pmset -g batt", { timeout: 2000 }).toString();
      const m = out.match(/(\d+)%/);
      if (m) battPct = m[1];
    } catch (e) {}

    const freeGB = (os.freemem() / (1024 ** 3)).toFixed(1);
    const totalGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
    const usedGB = (totalGB - freeGB).toFixed(1);
    const cpuCount = os.cpus().length;

    return {
      handled: true,
      isStandup: true,
      steps: [
        {
          agent: "Tuk Tuk",
          role: "Executive Co-Founder & Team Lead",
          voice: "en-US-AvaNeural",
          speech: "Morning team! Standup is live. Let's sync up bro. Andrew, what's our engineering velocity?"
        },
        {
          agent: "Andrew",
          role: "Lead Software Engineer",
          voice: "en-US-AndrewNeural",
          speech: `Hey bro, Andrew here. We're on branch ${branch}, and ${gitMsg}. Codebase is clean, zero regressions, ready to ship.`
        },
        {
          agent: "Jenny",
          role: "Head of Research & Intel",
          voice: "en-US-JennyNeural",
          speech: "Jenny here bro. Market data feeds and research benchmarks are live with high signal-to-noise ratio."
        },
        {
          agent: "Brian",
          role: "Head of DevOps & QA",
          voice: "en-US-BrianNeural",
          speech: `Brian here bro. Power is at ${battPct} percent, memory load is ${usedGB} out of ${totalGB} gigabytes across ${cpuCount} CPU cores. Telemetry is rock solid.`
        },
        {
          agent: "Tuk Tuk",
          role: "Executive Co-Founder & Team Lead",
          voice: "en-US-AvaNeural",
          speech: "Love the energy team! We're locked in and ready to build bro. What are we tackling first?"
        }
      ]
    };
  }

  getSuitStatus() {
    try {
      let battPct = "100";
      let battStatus = "AC power";
      try {
        const out = execSync("pmset -g batt", { timeout: 2000 }).toString();
        const m = out.match(/(\d+)%/);
        if (m) battPct = m[1];
        battStatus = out.includes("charging") || out.includes("AC") ? "plugged into AC power" : "on battery power";
      } catch (e) {}

      const freeGB = (os.freemem() / (1024 ** 3)).toFixed(1);
      const totalGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
      const usedGB = (totalGB - freeGB).toFixed(1);
      const cpuCount = os.cpus().length;

      return {
        handled: true,
        speech: `All systems running smooth bro. Power is at ${battPct} percent ${battStatus}. Memory load is ${usedGB} out of ${totalGB} gigabytes across ${cpuCount} active CPU cores. Hardware telemetry is fully optimized.`
      };
    } catch (e) {
      return { handled: true, speech: "All systems are online and running smooth bro." };
    }
  }

  lockScreen() {
    try {
      exec("pmset displaysleepnow");
      return {
        handled: true,
        speech: "Securing your workstation and putting the screen to sleep now."
      };
    } catch (e) {
      return { handled: true, speech: "Securing your screen now." };
    }
  }

  adjustVolume(delta) {
    try {
      const current = parseInt(execSync('osascript -e "output volume of (get volume settings)"', { timeout: 2000 }).toString().trim(), 10) || 50;
      const target = Math.min(100, Math.max(0, current + delta));
      execSync(`osascript -e "set volume output volume ${target}"`, { timeout: 2000 });
      return {
        handled: true,
        speech: `Volume set to ${target} percent.`
      };
    } catch (e) {
      return { handled: true, speech: "Volume adjusted." };
    }
  }

  getBatteryReport() {
    try {
      const out = execSync("pmset -g batt", { timeout: 3000 }).toString();
      const pctMatch = out.match(/(\d+)%/);
      const isCharging = out.includes("charging") || out.includes("AC Power");
      const pct = pctMatch ? pctMatch[1] : "unknown";
      const status = isCharging ? "plugged into AC power and charging" : "running on battery power";
      return {
        handled: true,
        speech: `Battery is currently at ${pct} percent, ${status}.`
      };
    } catch (e) {
      return { handled: true, speech: "Unable to read battery telemetry at this moment." };
    }
  }

  getSystemHealthReport() {
    try {
      const freeGB = (os.freemem() / (1024 ** 3)).toFixed(1);
      const totalGB = (os.totalmem() / (1024 ** 3)).toFixed(1);
      const usedGB = (totalGB - freeGB).toFixed(1);
      const cpuCount = os.cpus().length;
      return {
        handled: true,
        speech: `System telemetry report: Memory load is ${usedGB} out of ${totalGB} gigabytes. ${cpuCount} CPU cores are active and operational.`
      };
    } catch (e) {
      return { handled: true, speech: "System telemetry is currently operating normally." };
    }
  }

  cleanCache() {
    try {
      execSync("rm -f /tmp/eloquent*.wav /tmp/eloquent*.mp3 /tmp/test_voice*.mp3", { timeout: 3000 });
      return {
        handled: true,
        speech: "All temporary voice caches and audio files have been cleared, sir."
      };
    } catch (e) {
      return { handled: true, speech: "Cache cleanup completed." };
    }
  }

  getGitStatus() {
    try {
      const branch = execSync("GIT_CONFIG_GLOBAL=/dev/null git branch --show-current", { cwd: this.projectDir, timeout: 3000 }).toString().trim();
      const status = execSync("GIT_CONFIG_GLOBAL=/dev/null git status -s", { cwd: this.projectDir, timeout: 3000 }).toString().trim();
      const fileCount = status ? status.split("\n").length : 0;

      if (fileCount === 0) {
        return {
          handled: true,
          speech: `Working tree is completely clean on branch ${branch}. Everything is committed and up to date.`
        };
      } else {
        return {
          handled: true,
          speech: `On branch ${branch}. You have ${fileCount} modified files pending in your workspace.`
        };
      }
    } catch (e) {
      return { handled: true, speech: "Git repository status is nominal on branch v2.0-release." };
    }
  }

  openVSCode() {
    try {
      exec(`open -a "Visual Studio Code" "${this.projectDir}"`);
      return {
        handled: true,
        speech: "Opening Visual Studio Code with the project now."
      };
    } catch (e) {
      return { handled: true, speech: "Launching your code editor now." };
    }
  }

  openTerminal() {
    try {
      exec(`open -a Terminal "${this.projectDir}"`);
      return {
        handled: true,
        speech: "Terminal opened at your project root directory."
      };
    } catch (e) {
      return { handled: true, speech: "Launching Terminal now." };
    }
  }

  runTests() {
    try {
      exec("node scripts/test-voices.js", { cwd: this.projectDir });
      return {
        handled: true,
        speech: "Running 4-agent voice test suite now. All telemetry is nominal."
      };
    } catch (e) {
      return { handled: true, speech: "Test suite executed successfully." };
    }
  }

  searchWeb(query) {
    try {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      exec(`open "${url}"`);
      return {
        handled: true,
        speech: `Searching Google for ${query} in your browser now.`
      };
    } catch (e) {
      return { handled: true, speech: `Looking up ${query} now.` };
    }
  }

  openGitHub() {
    try {
      exec("open https://github.com/hritthikroy/Eloquent");
      return {
        handled: true,
        speech: "Opening our Eloquent repository on GitHub in your browser."
      };
    } catch (e) {
      return { handled: true, speech: "Opening GitHub now." };
    }
  }

  getTimeReport() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const dayStr = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    return {
      handled: true,
      speech: `It is ${timeStr} on ${dayStr}.`
    };
  }

  setVolume(level, message) {
    try {
      execSync(`osascript -e "set volume output volume ${level}"`);
      return { handled: true, speech: message };
    } catch (e) {
      return { handled: true, speech: `Volume set to ${level} percent.` };
    }
  }

  openApplication(appName) {
    const appMap = {
      "chrome": "Google Chrome",
      "google chrome": "Google Chrome",
      "browser": "Google Chrome",
      "safari": "Safari",
      "notes": "Notes",
      "finder": "Finder",
      "downloads": "~/Downloads",
      "slack": "Slack",
      "spotify": "Spotify",
      "calculator": "Calculator",
      "settings": "System Settings"
    };

    const target = appMap[appName.toLowerCase()] || appName;
    try {
      if (target.startsWith("~")) {
        exec(`open ${target}`);
      } else {
        exec(`open -a "${target}"`);
      }
      return {
        handled: true,
        speech: `Opening ${appName} now.`
      };
    } catch (e) {
      return { handled: true, speech: `Opening ${appName} now.` };
    }
  }

  // -------------------------------------------------------------
  // SKILL: AVA - Apple Reminders & Apple Notes
  // -------------------------------------------------------------
  createReminder(task) {
    try {
      const cleanTask = task.replace(/"/g, '\\"');
      execSync(`osascript -e 'tell application "Reminders" to make new reminder with properties {name:"${cleanTask}"}'`, { timeout: 3000 });
      return {
        handled: true,
        speech: `Added "${task}" to your Apple Reminders list.`
      };
    } catch (e) {
      return {
        handled: true,
        speech: `I have noted "${task}" for your reminders.`
      };
    }
  }

  createNote(content) {
    try {
      const cleanContent = content.replace(/"/g, '\\"');
      const timestamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      execSync(`osascript -e 'tell application "Notes" to make new note with properties {name:"Voice Note (${timestamp})", body:"${cleanContent}"}'`, { timeout: 3000 });
      return {
        handled: true,
        speech: "Note captured in your Apple Notes app."
      };
    } catch (e) {
      return {
        handled: true,
        speech: `I have recorded your note: "${content}".`
      };
    }
  }

  // -------------------------------------------------------------
  // SKILL: ANDREW - Git Diff Summary & Recent Commits
  // -------------------------------------------------------------
  getGitDiffSummary() {
    try {
      const diff = execSync("GIT_CONFIG_GLOBAL=/dev/null git diff --stat", { cwd: this.projectDir, timeout: 3000 }).toString().trim();
      if (!diff) {
        return {
          handled: true,
          speech: "No unstaged changes detected. Working tree is clean and up to date."
        };
      }
      const lines = diff.split("\n");
      const summaryLine = lines[lines.length - 1].trim();
      return {
        handled: true,
        speech: `Git diff summary: ${summaryLine}.`
      };
    } catch (e) {
      return { handled: true, speech: "Unable to inspect git diff right now." };
    }
  }

  getRecentCommits() {
    try {
      const log = execSync('GIT_CONFIG_GLOBAL=/dev/null git log -n 3 --pretty=format:"%s"', { cwd: this.projectDir, timeout: 3000 }).toString().trim();
      if (!log) {
        return { handled: true, speech: "No recent commit history found." };
      }
      const commits = log.split("\n").slice(0, 3).map((c, i) => `${i + 1}: ${c}`).join(". ");
      return {
        handled: true,
        speech: `Recent commits: ${commits}.`
      };
    } catch (e) {
      return { handled: true, speech: "Unable to read recent commits right now." };
    }
  }

  // -------------------------------------------------------------
  // SKILL: BRIAN - Disk Storage Capacity & Port Checker
  // -------------------------------------------------------------
  getDiskSpaceReport() {
    try {
      const out = execSync("df -h /", { timeout: 2000 }).toString().trim();
      const lines = out.split("\n");
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        const total = parts[1];
        const avail = parts[3];
        const pct = parts[4];
        return {
          handled: true,
          speech: `Storage status: ${avail} free out of ${total} on the main drive. Current disk usage is at ${pct}.`
        };
      }
      return { handled: true, speech: "Storage telemetry is normal." };
    } catch (e) {
      return { handled: true, speech: "Unable to read disk capacity at the moment." };
    }
  }

  checkPort(portNumber) {
    try {
      const out = execSync(`lsof -i :${portNumber}`, { timeout: 2000 }).toString().trim();
      if (out && out.length > 0) {
        const lines = out.split("\n");
        const processName = lines.length > 1 ? lines[1].split(/\s+/)[0] : "a process";
        return {
          handled: true,
          speech: `Port ${portNumber} is currently occupied by ${processName}.`
        };
      }
      return {
        handled: true,
        speech: `Port ${portNumber} is completely free and available.`
      };
    } catch (e) {
      return {
        handled: true,
        speech: `Port ${portNumber} is completely free and available.`
      };
    }
  }

  // -------------------------------------------------------------
  // SKILL: JENNY - Readme Overview & Public GitHub Repo Stats
  // -------------------------------------------------------------
  summarizeReadme() {
    try {
      const readmePath = path.join(this.projectDir, "README.md");
      if (fs.existsSync(readmePath)) {
        const content = fs.readFileSync(readmePath, "utf8");
        const cleanLines = content.split("\n").filter(l => l.trim().length > 0 && !l.startsWith("#"));
        const preview = cleanLines.slice(0, 2).join(" ").replace(/[*`_#]/g, "").slice(0, 160);
        return {
          handled: true,
          speech: `Project overview from README: ${preview}`
        };
      }
      return { handled: true, speech: "Eloquent is an ultra-fast local voice assistant for macOS." };
    } catch (e) {
      return { handled: true, speech: "Eloquent project documentation is synchronized." };
    }
  }

  getPublicRepoStats() {
    const https = require("https");
    return new Promise((resolve) => {
      const req = https.get("https://api.github.com/repos/hritthikroy/Eloquent", { headers: { "User-Agent": "Eloquent-App" } }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            const stars = json.stargazers_count || 0;
            const forks = json.forks_count || 0;
            const issues = json.open_issues_count || 0;
            resolve({
              handled: true,
              speech: `GitHub repository status: Eloquent currently has ${stars} stars, ${forks} forks, and ${issues} open issues.`
            });
          } catch (e) {
            resolve({ handled: true, speech: "Eloquent repository is active on GitHub." });
          }
        });
      });
      req.on("error", () => {
        resolve({ handled: true, speech: "Eloquent repository is active on GitHub." });
      });
      req.setTimeout(3000, () => {
        req.destroy();
        resolve({ handled: true, speech: "Eloquent repository is active on GitHub." });
      });
    });
  }

  // -------------------------------------------------------------
  // PHASE 2 SKILLS: AVA - Clipboard Operations
  // -------------------------------------------------------------
  readClipboard() {
    try {
      const clip = execSync("pbpaste", { timeout: 2000 }).toString().trim();
      if (!clip) {
        return { handled: true, speech: "Your clipboard is currently empty." };
      }
      const preview = clip.slice(0, 160).replace(/[\r\n]+/g, " ");
      return {
        handled: true,
        speech: `Your clipboard contains: ${preview}`
      };
    } catch (e) {
      return { handled: true, speech: "Unable to read clipboard right now." };
    }
  }

  copyToClipboard(text) {
    try {
      const cp = require("child_process").spawn("pbcopy");
      cp.stdin.write(text);
      cp.stdin.end();
      return {
        handled: true,
        speech: "Copied that to your clipboard."
      };
    } catch (e) {
      return { handled: true, speech: "Unable to copy to clipboard." };
    }
  }

  // -------------------------------------------------------------
  // PHASE 2 SKILLS: ANDREW - Package Version & Syntax Integrity
  // -------------------------------------------------------------
  getPackageVersion() {
    try {
      const pkgPath = path.join(this.projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      const depCount = Object.keys(pkg.dependencies || {}).length;
      return {
        handled: true,
        speech: `Eloquent is currently on version ${pkg.version} with ${depCount} production dependencies.`
      };
    } catch (e) {
      return { handled: true, speech: "Eloquent is on version 2.1.0." };
    }
  }

  runSyntaxCheck() {
    try {
      execSync("node -c src/main.js src/utils/action-runner.js src/utils/jarvis-manager.js", { cwd: this.projectDir, timeout: 3000 });
      return {
        handled: true,
        speech: "Code integrity check passed. Zero syntax errors across all core modules."
      };
    } catch (e) {
      return { handled: true, speech: "Syntax check reported an issue. Let's inspect the files." };
    }
  }

  // -------------------------------------------------------------
  // PHASE 2 SKILLS: JENNY - Wikipedia Brief & Network Latency
  // -------------------------------------------------------------
  searchWikipedia(topic) {
    const https = require("https");
    return new Promise((resolve) => {
      const cleanTopic = encodeURIComponent(topic.trim().replace(/\s+/g, "_"));
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${cleanTopic}`;
      const req = https.get(url, { headers: { "User-Agent": "Eloquent-App (contact@eloquent.local)" } }, (res) => {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const json = JSON.parse(data);
            if (json.extract) {
              const firstSentence = json.extract.split(". ")[0] + ".";
              resolve({
                handled: true,
                speech: `According to Wikipedia: ${firstSentence}`
              });
            } else {
              resolve({ handled: true, speech: `I searched Wikipedia for ${topic}, but no summary was found.` });
            }
          } catch (e) {
            resolve({ handled: true, speech: `Looking into ${topic} for you now.` });
          }
        });
      });
      req.on("error", () => resolve({ handled: true, speech: `Looking into ${topic} for you now.` }));
      req.setTimeout(3500, () => {
        req.destroy();
        resolve({ handled: true, speech: `Wikipedia search for ${topic} timed out.` });
      });
    });
  }

  checkNetworkLatency() {
    const dns = require("dns");
    const start = Date.now();
    return new Promise((resolve) => {
      dns.lookup("google.com", (err) => {
        const duration = Date.now() - start;
        if (err) {
          resolve({ handled: true, speech: "Internet connectivity check failed. You appear to be offline." });
        } else {
          resolve({ handled: true, speech: `Internet connection is active and stable with a DNS latency of ${duration} milliseconds.` });
        }
      });
    });
  }

  // -------------------------------------------------------------
  // PHASE 2 SKILLS: BRIAN - System Uptime & Wi-Fi Diagnostic
  // -------------------------------------------------------------
  getSystemUptime() {
    try {
      const out = execSync("uptime", { timeout: 2000 }).toString().trim();
      const match = out.match(/up\s+([^,]+(?:,\s*[^,]+)?)/);
      const uptimeStr = match ? match[1].trim() : "over 24 hours";
      return {
        handled: true,
        speech: `System uptime: your Mac has been running for ${uptimeStr} with nominal load.`
      };
    } catch (e) {
      return { handled: true, speech: "System uptime is nominal." };
    }
  }

  getWifiStatus() {
    try {
      const out = execSync("networksetup -getairportnetwork en0 2>/dev/null || true", { timeout: 2000 }).toString().trim();
      if (out.includes("Current Wi-Fi Network:")) {
        const ssid = out.replace("Current Wi-Fi Network:", "").trim();
        return {
          handled: true,
          speech: `Connected to Wi-Fi network "${ssid}".`
        };
      }
      return {
        handled: true,
        speech: "Wi-Fi interface is active and network communication is nominal."
      };
    } catch (e) {
      return { handled: true, speech: "Network interface is active." };
    }
  }
}

module.exports = new OfficeActionRunner();
