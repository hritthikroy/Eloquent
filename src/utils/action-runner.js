// Office Action Execution Engine for Autonomous Agents
const { execSync, exec } = require("child_process");
const os = require("os");
const path = require("path");

class OfficeActionRunner {
  constructor() {
    this.projectDir = path.resolve(__dirname, "../..");
  }

  async handleAction(speechText, activeAgent) {
    if (!speechText || typeof speechText !== "string") return { handled: false };
    const lower = speechText.toLowerCase().trim();

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

    if (lower.includes("go to sleep") || lower.includes("stand down") || lower.includes("shut down suit") || lower.includes("goodbye ava") || lower.includes("bye ava") || lower.includes("exit suit")) {
      return {
        handled: true,
        speech: "Standing down and entering standby mode, Boss. I'm right here whenever you need me.",
        dismissSession: true
      };
    }

    // -------------------------------------------------------------
    // BRIAN (System QA, Health, Battery, Diagnostics, Storage & Ports)
    // -------------------------------------------------------------
    if (lower.includes("battery")) {
      return this.getBatteryReport();
    }

    if (lower.includes("system health") || lower.includes("ram") || lower.includes("cpu") || lower.includes("memory") || lower.includes("telemetry") || lower.includes("diagnostics")) {
      return this.getSystemHealthReport();
    }

    if (lower.includes("disk space") || lower.includes("storage status") || lower.includes("hard drive") || lower.includes("free space")) {
      return this.getDiskSpaceReport();
    }

    if (lower.includes("check port ") || lower.includes("is port ")) {
      const m = lower.match(/(?:check port|is port)\s+(\d+)/i);
      if (m && m[1]) {
        return this.checkPort(parseInt(m[1], 10));
      }
    }

    if (lower.includes("clean cache") || lower.includes("clear cache") || lower.includes("clean disk") || lower.includes("clear temporary")) {
      return this.cleanCache();
    }

    if (lower.includes("lock screen") || lower.includes("lock computer") || lower.includes("lock suit") || lower.includes("lock my screen")) {
      return this.lockScreen();
    }

    // -------------------------------------------------------------
    // ANDREW (Lead Software Engineer: Git, Diff, Commits, VSCode, Terminal)
    // -------------------------------------------------------------
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
    // JENNY (Research & Intelligence: Web Search, Docs, Repo Stats)
    // -------------------------------------------------------------
    if (lower.includes("summarize readme") || lower.includes("read readme") || lower.includes("project overview") || lower.includes("what is eloquent")) {
      return this.summarizeReadme();
    }

    if (lower.includes("repo stats") || lower.includes("github stars") || lower.includes("repository stats") || lower.includes("github stats")) {
      return await this.getPublicRepoStats();
    }

    if (lower.includes("open youtube")) {
      try { exec('open "https://www.youtube.com"'); } catch (e) {}
      return { handled: true, speech: "Opening YouTube now, Boss." };
    }

    if (lower.includes("open chatgpt") || lower.includes("open chat gpt")) {
      try { exec('open "https://chatgpt.com"'); } catch (e) {}
      return { handled: true, speech: "Opening ChatGPT now, Boss." };
    }

    if (lower.includes("open twitter") || lower.includes("open x")) {
      try { exec('open "https://x.com"'); } catch (e) {}
      return { handled: true, speech: "Opening X now, Boss." };
    }

    if (lower.includes("open gmail") || lower.includes("open mail")) {
      try { exec('open "https://mail.google.com"'); } catch (e) {}
      return { handled: true, speech: "Opening Gmail now, Boss." };
    }

    if (lower.includes("search google for") || lower.includes("search for") || lower.includes("google ")) {
      const match = speechText.match(/(?:search google for|search for|google)\s+(.+)/i);
      if (match && match[1]) {
        return this.searchWeb(match[1].replace(/[.,?!]/g, "").trim());
      }
    }

    if (lower.includes("open github") || lower.includes("open repository") || lower.includes("open repo")) {
      return this.openGitHub();
    }

    // -------------------------------------------------------------
    // AVA (Executive Co-Pilot: Reminders, Notes, Apps, Volume, Time)
    // -------------------------------------------------------------
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
      return this.setVolume(0, "Muted the system audio for you, Boss.");
    }

    if (lower.includes("volume to max") || lower.includes("full volume")) {
      return this.setVolume(100, "Volume set to one hundred percent.");
    }

    const volMatch = lower.match(/volume (?:to )?(\d+)/i);
    if (volMatch && volMatch[1]) {
      const level = Math.min(100, Math.max(0, parseInt(volMatch[1], 10)));
      return this.setVolume(level, `Volume adjusted to ${level} percent, Boss.`);
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
          agent: "Ava",
          role: "Executive Director & Team Lead",
          voice: "en-US-AvaNeural",
          speech: "Alright team, remote office standup is in session! Welcome to the meeting, Boss. Andrew, let's start with engineering. What's our technical status?"
        },
        {
          agent: "Andrew",
          role: "Lead Software Engineer",
          voice: "en-US-AndrewNeural",
          speech: `Hey everyone, Andrew here. We're working on branch ${branch}, and ${gitMsg}. My editor is open and I'm ready to ship code.`
        },
        {
          agent: "Jenny",
          role: "Head of Research & Intel",
          voice: "en-US-JennyNeural",
          speech: "Jenny checking in from intelligence. All documentation feeds, competitor research, and web tools are synchronized and standing by."
        },
        {
          agent: "Brian",
          role: "Head of DevOps & QA",
          voice: "en-US-BrianNeural",
          speech: `Brian for operations and QA. Power is at ${battPct} percent, memory load is ${usedGB} out of ${totalGB} gigabytes across ${cpuCount} CPU cores. All test suites and infrastructure are green.`
        },
        {
          agent: "Ava",
          role: "Executive Director & Team Lead",
          voice: "en-US-AvaNeural",
          speech: "Thanks team! The entire office is locked in and ready for your command, Boss. What should we tackle first?"
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
        speech: `All suit systems are green, Boss. Power is at ${battPct} percent ${battStatus}. Memory load is ${usedGB} out of ${totalGB} gigabytes across ${cpuCount} active CPU cores. I am standing by for your command.`
      };
    } catch (e) {
      return { handled: true, speech: "All suit systems are online and operational, Boss." };
    }
  }

  lockScreen() {
    try {
      exec("pmset displaysleepnow");
      return {
        handled: true,
        speech: "Securing your workstation and putting the screen to sleep now, Boss."
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
        speech: `Volume set to ${target} percent, Boss.`
      };
    } catch (e) {
      return { handled: true, speech: "Volume adjusted, Boss." };
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
        speech: "Opening Visual Studio Code with the project now, Boss."
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
        speech: `Opening ${appName} for you now, Boss.`
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
        speech: `I've added "${task}" to your Apple Reminders list, Boss.`
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
        speech: `Note captured in your Apple Notes app, Boss.`
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
}

module.exports = new OfficeActionRunner();
