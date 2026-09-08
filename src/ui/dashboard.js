// Import ipcRenderer with error handling
let ipcRenderer;
try {
  const electron = require('electron');
  ipcRenderer = electron.ipcRenderer;
  console.log('✅ ipcRenderer imported successfully');
} catch (error) {
  console.error('❌ Failed to import ipcRenderer:', error);
  // Try alternative import methods
  try {
    ipcRenderer = window.require('electron').ipcRenderer;
    console.log('✅ ipcRenderer imported via window.require');
  } catch (error2) {
    console.error('❌ Failed to import ipcRenderer via window.require:', error2);
    // Last resort - check if it's available globally
    if (window.electronAPI && window.electronAPI.ipcRenderer) {
      ipcRenderer = window.electronAPI.ipcRenderer;
      console.log('✅ ipcRenderer found via window.electronAPI');
    } else {
      console.error('❌ ipcRenderer not available through any method');
    }
  }
}

function showSection(name) {
  try {
    // Hide all sections
    document.querySelectorAll('[id$="-section"]').forEach(el => el.style.display = 'none');
    
    // Show the requested section
    const targetSection = document.getElementById(name + '-section');
    if (targetSection) {
      targetSection.style.display = 'block';
    } else {
      console.error('Section not found:', name + '-section');
      return;
    }
    
    // Remove active class from all sidebar items
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    
    // Find and activate the clicked sidebar item
    const clickedItem = document.querySelector(`.sidebar-item[data-section="${name}"]`);
    if (clickedItem) {
      clickedItem.classList.add('active');
    }
    
    // Refresh history when switching to history section
    if (name === 'history') {
      loadHistory();
    }
    
    console.log('Switched to section:', name);
  } catch (error) {
    console.error('Error switching section:', error);
  }
}

function saveSettings() {
  const language = document.getElementById('language').value;
  const aiMode = document.getElementById('aiMode').value;

  ipcRenderer.send('save-config', {
    language,
    aiMode
  });

  alert(`Settings saved! ✅\n\n✨ AI Mode: ${document.getElementById('aiMode').selectedOptions[0].text}\n🌐 Language: ${language}`);
}

// Load config on start
ipcRenderer.send('get-config');
ipcRenderer.on('config', (_, config) => {
  // Load user settings (no API keys)
  if (config.language) document.getElementById('language').value = config.language;
  if (config.aiMode) {
    // Map legacy 'qn' mode to 'auto' for compatibility
    const validModes = ['auto', 'grammar'];
    const aiModeValue = validModes.includes(config.aiMode) ? config.aiMode : 'auto';
    document.getElementById('aiMode').value = aiModeValue;
    updateAIModeDescription(aiModeValue);
  }
});


// Function to update daily limit display based on API key count
function updateDailyLimitDisplay(apiKeys) {
  // Count valid API keys (non-empty)
  const validKeyCount = apiKeys.filter(key => key && key.trim() !== '').length;
  const totalMinutes = validKeyCount * 40;

  // Update description (check if element exists)
  const descEl = document.getElementById('sessionDescription');
  if (descEl) {
    if (validKeyCount === 1) {
      descEl.innerHTML = 'Track your daily recording sessions. You have <strong style="color: #60a5fa;">40 minutes/day</strong> with 1 API key.';
    } else if (validKeyCount > 1) {
      descEl.innerHTML = `Track your daily recording sessions. With ${validKeyCount} API keys, you get <strong style="color: #60a5fa;">${totalMinutes} minutes/day</strong> total recording time.`;
    } else {
      descEl.innerHTML = 'Track your daily recording sessions. <strong style="color: #ff6b6b;">Add API keys in Settings</strong> to enable recording.';
    }
  }

  // Update progress display (check if elements exist)
  const timeProgressEl = document.getElementById('timeProgress');
  if (timeProgressEl) {
    timeProgressEl.textContent = `0 / ${totalMinutes} min`;
  }
  
  const timeRemainingEl = document.getElementById('timeRemaining');
  if (timeRemainingEl) {
    timeRemainingEl.textContent = `${totalMinutes} minutes remaining`;
  }

  // Update API key count display (check if element exists)
  const keyCountEl = document.getElementById('apiKeyCount');
  if (keyCountEl) {
    keyCountEl.textContent = validKeyCount === 1 ? '1 API Key' : `${validKeyCount} API Keys`;
  }
}

// AI Mode descriptions - Smart Modes
const aiModeDescriptions = {
  auto: '<strong style="color: #a855f7;">Auto - Smart Detection:</strong> Automatically detects your content type and applies the perfect level of enhancement. Light fixes for good text, full rewriting for rough speech. The intelligent choice for all situations.',
  grammar: '<strong style="color: #a855f7;">Grammar Only:</strong> Light touch - just fixes spelling, grammar, and punctuation. Preserves your natural voice and style. Use when you want minimal changes.'
};

function updateAIModeDescription(mode) {
  document.getElementById('aiModeDescription').innerHTML = aiModeDescriptions[mode] || aiModeDescriptions.auto;
}

// Update description when AI mode changes
document.getElementById('aiMode').addEventListener('change', (e) => {
  updateAIModeDescription(e.target.value);
});


// API Usage tracking functions
const MAX_DAILY_REQUESTS = 14400; // 14,400 requests per day per API
const WHISPER_COST_PER_REQUEST = 0.0005; // $0.0005 per request
const LLAMA_COST_PER_REQUEST = 0.0005;   // $0.0005 per request

function getAPIUsage() {
  const today = new Date().toISOString().split('T')[0];
  const stored = JSON.parse(localStorage.getItem('apiUsage') || '{}');

  // Reset if new day
  if (stored.date !== today) {
    return {
      date: today,
      whisper: 0,
      llama: 0
    };
  }

  return stored;
}

function saveAPIUsage(usage) {
  localStorage.setItem('apiUsage', JSON.stringify(usage));
}

function updateAPIUsageDisplay() {
  const usage = getAPIUsage();

  // Calculate costs
  const whisperCost = usage.whisper * WHISPER_COST_PER_REQUEST;
  const llamaCost = usage.llama * LLAMA_COST_PER_REQUEST;
  const totalCost = whisperCost + llamaCost;

  // Update Whisper API display
  const whisperCountEl = document.getElementById('whisperCount');
  if (whisperCountEl) whisperCountEl.textContent = `${usage.whisper} / ${MAX_DAILY_REQUESTS}`;
  const whisperPercentage = Math.min((usage.whisper / MAX_DAILY_REQUESTS) * 100, 100);
  const whisperProgressBarEl = document.getElementById('whisperProgressBar');
  if (whisperProgressBarEl) whisperProgressBarEl.style.width = whisperPercentage + '%';
  const whisperRemainingEl = document.getElementById('whisperRemaining');
  if (whisperRemainingEl) whisperRemainingEl.textContent = `${MAX_DAILY_REQUESTS - usage.whisper} requests remaining`;
  const whisperCostEl = document.getElementById('whisperCost');
  if (whisperCostEl) whisperCostEl.textContent = `${whisperCost.toFixed(3)} used`;

  // Update Llama API display
  const llamaCountEl = document.getElementById('llamaCount');
  if (llamaCountEl) llamaCountEl.textContent = `${usage.llama} / ${MAX_DAILY_REQUESTS}`;
  const llamaPercentage = Math.min((usage.llama / MAX_DAILY_REQUESTS) * 100, 100);
  const llamaProgressBarEl = document.getElementById('llamaProgressBar');
  if (llamaProgressBarEl) llamaProgressBarEl.style.width = llamaPercentage + '%';
  const llamaRemainingEl = document.getElementById('llamaRemaining');
  if (llamaRemainingEl) llamaRemainingEl.textContent = `${MAX_DAILY_REQUESTS - usage.llama} requests remaining`;
  const llamaCostEl = document.getElementById('llamaCost');
  if (llamaCostEl) llamaCostEl.textContent = `${llamaCost.toFixed(3)} used`;

  // Update total cost
  const totalCostEl = document.getElementById('totalCost');
  if (totalCostEl) totalCostEl.textContent = `${totalCost.toFixed(3)}`;

  // Color-code progress bars based on usage
  updateProgressBarColors('whisperProgressBar', 'whisperCost', 'whisperCount', whisperPercentage);
  updateProgressBarColors('llamaProgressBar', 'llamaCost', 'llamaCount', llamaPercentage);
}

function updateProgressBarColors(progressBarId, costId, countId, percentage) {
  const progressBar = document.getElementById(progressBarId);
  const costElement = document.getElementById(costId);
  const countElement = document.getElementById(countId);

  // Check if elements exist before updating
  if (!progressBar || !costElement || !countElement) {
    return;
  }

  if (percentage > 90) {
    // Critical - red
    progressBar.style.background = '#ff3b30';
    costElement.style.color = '#ff3b30';
    countElement.style.color = '#ff3b30';
  } else if (percentage > 70) {
    // Warning - orange
    progressBar.style.background = '#ffaa00';
    costElement.style.color = '#ffaa00';
    countElement.style.color = '#ffaa00';
  } else {
    // Normal - blue/purple
    if (progressBarId === 'whisperProgressBar') {
      progressBar.style.background = '#3b82f6';
    } else {
      progressBar.style.background = '#8b5cf6';
    }
    costElement.style.color = null; // Use default color
    countElement.style.color = null; // Use default color
  }
}

// Update display on load (wrapped in try-catch to prevent errors)
try {
  updateAPIUsageDisplay();
} catch (error) {
  console.log('API usage display not available');
}

// Listen for API request events from main process
ipcRenderer.on('api-request', (_, apiType) => {
  const usage = getAPIUsage();

  if (apiType === 'whisper') {
    usage.whisper++;
  } else if (apiType === 'llama') {
    usage.llama++;
  }

  saveAPIUsage(usage);
  try {
    updateAPIUsageDisplay();
  } catch (error) {
    // Silently ignore if elements don't exist
  }
});

// Also update API usage when recording completes (for tracking both APIs in rewrite mode)
ipcRenderer.on('recording-complete', (_, data) => {
  console.log('Recording complete:', data);
  // Refresh history - the main process will send updated history-data
  // No need to call loadHistory() as it's sent automatically
});

// Auto-refresh every minute to check for day change
setInterval(() => {
  try {
    updateAPIUsageDisplay();
  } catch (error) {
    // Silently ignore if elements don't exist
  }
}, 60000);


// ==========================================================================
// Agent Talk & Working Conversation History Hub Management
// ==========================================================================
let historyData = [];
let currentHistoryFilter = 'all';
let currentHistorySearch = '';

// Modern Toast Notification Utility
function showHistoryToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('historyToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'historyToastContainer';
    container.className = 'history-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `history-toast ${type === 'success' ? 'toast-success' : (type === 'error' ? 'toast-error' : '')}`;
  const icon = type === 'success' ? '✨' : (type === 'error' ? '❌' : 'ℹ️');
  toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px) scale(0.95)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, duration);
}

// Request latest history and telemetry stats
function loadHistory() {
  ipcRenderer.send('get-history');
  ipcRenderer.invoke('get-history-stats').then(stats => {
    if (stats) updateHistoryTelemetryStats(stats);
  }).catch(() => {});
}

// Helper: Format voice name for UI chip
function formatVoiceName(voice) {
  if (!voice) return 'AvaMultilingual';
  if (voice.includes('Ava')) return 'Ava (Partner)';
  if (voice.includes('Andrew')) return 'Andrew (Vision)';
  if (voice.includes('Emma')) return 'Emma (Friday)';
  if (voice.includes('Brian')) return 'Brian (DevOps)';
  return voice.replace('en-US-', '').replace('Neural', '');
}

// Helper: Format agent reply text (preserves line breaks and basic formatting)
function formatAgentReplyText(text) {
  if (!text) return '<span style="opacity: 0.5; font-style: italic;">No speech output</span>';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

// Update telemetry bar counters and health meter
function updateHistoryTelemetryStats(stats) {
  if (!stats) return;
  const totalEl = document.getElementById('statTotalTurns');
  const tuktukEl = document.getElementById('statCountTuktuk');
  const visionEl = document.getElementById('statCountVision');
  const fridayEl = document.getElementById('statCountFriday');
  const brianEl = document.getElementById('statCountBrian');
  const squadEl = document.getElementById('statCountSquad');
  const healthPill = document.getElementById('statHealthPill');
  const healthScoreEl = document.getElementById('statHealthScore');
  const issuesBadge = document.getElementById('issuesCountBadge');

  if (totalEl) totalEl.textContent = stats.totalTurns || 0;
  if (tuktukEl) tuktukEl.textContent = (stats.agents && stats.agents.tuktuk) || 0;
  if (visionEl) visionEl.textContent = (stats.agents && stats.agents.vision) || 0;
  if (fridayEl) fridayEl.textContent = (stats.agents && stats.agents.friday) || 0;
  if (brianEl) brianEl.textContent = (stats.agents && stats.agents.brian) || 0;
  if (squadEl) squadEl.textContent = (stats.agents && stats.agents.squad) || 0;

  const score = stats.healthScore !== undefined ? stats.healthScore : 100;
  if (healthScoreEl) healthScoreEl.textContent = `${score}%`;

  const openIssues = (stats.issuesDetected || 0) - (stats.issuesFixed || 0);
  if (issuesBadge) {
    if (openIssues > 0) {
      issuesBadge.textContent = openIssues;
      issuesBadge.style.display = 'inline-block';
    } else {
      issuesBadge.style.display = 'none';
    }
  }

  if (healthPill) {
    if (openIssues > 0) {
      healthPill.className = 'stat-pill stat-health has-issues';
      healthPill.innerHTML = `⚠️ <b id="statHealthScore">${score}%</b> (${openIssues} Issues Detected)`;
    } else {
      healthPill.className = 'stat-pill stat-health';
      healthPill.innerHTML = `🩺 Health Score: <b id="statHealthScore">${score}%</b> (Operational)`;
    }
  }
}

// Display history feed with multi-agent cards and turn IDs
function displayHistory(history = historyData, searchTerm = currentHistorySearch) {
  const historyList = document.getElementById('historyList');
  const emptyHistory = document.getElementById('emptyHistory');
  if (!historyList || !emptyHistory) return;

  currentHistorySearch = searchTerm;
  let filtered = Array.isArray(history) ? [...history] : [];

  // 1. Filter by Agent or Issues Status
  if (currentHistoryFilter !== 'all') {
    if (currentHistoryFilter === 'issues') {
      filtered = filtered.filter(item => item.hasIssue || (item.issues && item.issues.some(i => !i.fixed)));
    } else {
      filtered = filtered.filter(item => {
        const itemAgent = (item.agentKey || (item.agent ? item.agent.toLowerCase().replace(/\s+/g, '') : 'tuktuk')).toLowerCase();
        if (currentHistoryFilter === 'brian') return itemAgent === 'brian' || itemAgent === 'dd';
        if (currentHistoryFilter === 'squad') return itemAgent === 'squad' || itemAgent === 'team';
        return itemAgent === currentHistoryFilter;
      });
    }
  }

  // 2. Filter by Search Query
  if (searchTerm && searchTerm.trim().length > 0) {
    const q = searchTerm.toLowerCase().trim();
    filtered = filtered.filter(item => {
      const idMatch = item.id && item.id.toLowerCase().includes(q);
      const textMatch = item.text && item.text.toLowerCase().includes(q);
      const promptMatch = (item.userPrompt || item.originalText || '').toLowerCase().includes(q);
      const replyMatch = (item.agentReply || item.text || '').toLowerCase().includes(q);
      const agentMatch = (item.agent || '').toLowerCase().includes(q);
      const voiceMatch = (item.voice || '').toLowerCase().includes(q);
      const stateMatch = (item.workingState || '').toLowerCase().includes(q);
      const issueMatch = item.issues && item.issues.some(i => (i.title + ' ' + i.message).toLowerCase().includes(q));
      return idMatch || textMatch || promptMatch || replyMatch || agentMatch || voiceMatch || stateMatch || issueMatch;
    });
  }

  // 3. Handle Empty State
  if (filtered.length === 0) {
    historyList.innerHTML = '';
    emptyHistory.style.display = 'flex';
    return;
  }

  emptyHistory.style.display = 'none';

  // 4. Render Turn Cards (capped at 60 for 60fps glassmorphic scrolling)
  const itemsToRender = filtered.slice(0, 60);

  historyList.innerHTML = itemsToRender.map(turn => {
    const date = new Date(turn.timestamp || Date.now());
    const timeAgo = getTimeAgo(date);
    const fullDate = date.toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });

    const agentKey = (turn.agentKey || (turn.agent ? turn.agent.toLowerCase().replace(/\s+/g, '') : 'tuktuk')).toLowerCase();
    let agentCss = 'tuktuk';
    let agentName = turn.agent || 'Tuk Tuk';
    let agentAvatar = turn.avatar || '🌸';
    let agentRole = turn.role || 'Co-Founder & Partner';
    let agentColor = '#fda4af';

    if (agentKey === 'vision' || agentKey === 'andrew') {
      agentCss = 'vision'; agentName = 'Vision'; agentAvatar = '⚡'; agentRole = 'Lead Systems Architect'; agentColor = '#67e8f9';
    } else if (agentKey === 'friday') {
      agentCss = 'friday'; agentName = 'Friday'; agentAvatar = '🧠'; agentRole = 'Head of Product Intelligence'; agentColor = '#6ee7b7';
    } else if (agentKey === 'brian' || agentKey === 'dd') {
      agentCss = 'brian'; agentName = 'Brian'; agentAvatar = '🛡️'; agentRole = 'Head of DevOps & Reliability'; agentColor = '#fcd34d';
    } else if (agentKey === 'team' || agentKey === 'squad') {
      agentCss = 'squad'; agentName = 'Squad'; agentAvatar = '👥'; agentRole = 'Multi-Agent Collective'; agentColor = '#c4b5fd';
    } else if (turn.mode === 'standard' || turn.mode === 'rewrite') {
      agentCss = 'standard'; agentName = 'Standard'; agentAvatar = '🎤'; agentRole = 'Voice Dictation'; agentColor = '#93c5fd';
    }

    const hasOpenIssues = turn.issues && turn.issues.some(i => !i.fixed);
    const cardClass = `turn-card agent-card-${agentCss} ${hasOpenIssues ? 'has-issues-card' : ''}`;

    const turnId = turn.id || `turn_${date.getTime()}_${agentCss}`;
    const userPrompt = turn.userPrompt || turn.originalText || '';
    const agentReply = turn.agentReply || turn.text || '';
    const voiceDisplay = formatVoiceName(turn.voice);

    return `
      <div class="${cardClass}" data-turn-id="${turnId}">
        <!-- Header Row -->
        <div class="turn-header">
          <div class="turn-header-left">
            <span class="turn-agent-badge turn-agent-${agentCss}">
              <span>${agentAvatar}</span>
              <span>${agentName}</span>
              <span class="turn-role-tag">• ${agentRole}</span>
            </span>

            <span class="turn-id-chip copy-id-btn" data-id="${turnId}" title="Click to copy Turn ID">
              🔑 ${turnId}
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </span>

            <span class="turn-voice-badge" title="Voice profile used for synthesis">
              🎙️ ${voiceDisplay}
            </span>

            <span class="turn-meta-time" title="${fullDate}">
              🕒 ${timeAgo}
            </span>

            ${turn.latencyMs ? `<span class="turn-voice-badge" style="color: #60a5fa;" title="Response generation latency">⚡ ${turn.latencyMs}ms</span>` : ''}
            ${turn.duration ? `<span class="turn-voice-badge" style="color: #94a3b8;" title="Audio duration">⏱️ ${turn.duration}s</span>` : ''}
          </div>

          <div class="turn-header-actions">
            <button class="turn-btn turn-btn-replay replay-speech-btn" data-turn-id="${turnId}" title="Replay spoken neural voice speech">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
              Replay
            </button>

            <button class="turn-btn turn-btn-copy copy-turn-btn" data-turn-id="${turnId}" title="Copy full conversation turn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Turn
            </button>

            <button class="turn-btn turn-btn-delete delete-btn" data-turn-id="${turnId}" title="Delete turn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Conversation Content: Both Prompt & Agent Working Reply -->
        <div class="turn-content-box">
          ${userPrompt ? `
            <div class="turn-bubble turn-bubble-user">
              <div class="turn-bubble-label">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                You (Prompt / Voice)
              </div>
              <div style="font-size: 14.5px; line-height: 1.6; color: #f1f5f9;">${escapeHtml(userPrompt)}</div>
            </div>
          ` : ''}

          <div class="turn-bubble turn-bubble-agent bubble-${agentCss}">
            <div class="turn-bubble-label" style="color: ${agentColor};">
              <span>${agentAvatar}</span>
              <span>${agentName} (${agentRole})</span>
            </div>
            <div style="font-size: 14.5px; line-height: 1.65;">${formatAgentReplyText(agentReply)}</div>
          </div>

          <!-- Working Action / Standup Execution details if present -->
          ${turn.workingState || turn.actionResult ? `
            <div class="turn-working-drawer">
              <span class="turn-working-badge">⚙️ WORKING EXECUTION</span>
              <span>${escapeHtml(turn.workingState || (turn.actionResult ? `Action: ${turn.actionResult.action} (Status: ${turn.actionResult.status || 'OK'})` : 'Executed successfully'))}</span>
            </div>
          ` : ''}

          <!-- Issue Diagnostics Drawer -->
          ${turn.issues && turn.issues.length > 0 ? turn.issues.map(iss => `
            <div class="turn-issue-banner ${iss.fixed ? 'issue-fixed' : ''}">
              <div class="turn-issue-info">
                <div class="turn-issue-title">
                  ${iss.fixed ? '✅ ISSUE RESOLVED' : (iss.severity === 'high' ? '🚨 HIGH SEVERITY ISSUE' : '⚠️ ISSUE DETECTED')}: ${escapeHtml(iss.title)}
                </div>
                <div class="turn-issue-desc">${escapeHtml(iss.message)}</div>
              </div>
              ${!iss.fixed ? `
                <button class="btn-fix-single fix-single-issue-btn" data-turn-id="${turnId}" title="Auto-heal this specific issue">
                  🩺 Fix Issue
                </button>
              ` : `
                <span style="color: #86efac; font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  ✨ Sanitized &amp; Healed
                </span>
              `}
            </div>
          `).join('') : ''}
        </div>
      </div>
    `;
  }).join('');

  // 5. Attach event listeners
  setTimeout(() => {
    // Copy Turn ID button
    document.querySelectorAll('.copy-id-btn').forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const id = this.getAttribute('data-id');
        if (id) {
          navigator.clipboard.writeText(id).then(() => {
            showHistoryToast(`Turn ID copied: ${id}`, 'success', 2000);
          }).catch(() => {
            showHistoryToast('Failed to copy Turn ID', 'error');
          });
        }
      });
    });

    // Copy full conversation turn button
    document.querySelectorAll('.copy-turn-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.getAttribute('data-turn-id');
        const item = historyData.find(h => (h.id || '') === id);
        if (item) {
          const userP = item.userPrompt || item.originalText || '';
          const agentR = item.agentReply || item.text || '';
          const copyStr = `[Turn ID: ${item.id}]\nUser: ${userP}\n${item.agent || 'Agent'}: ${agentR}`;
          navigator.clipboard.writeText(copyStr).then(() => {
            showHistoryToast('Full turn copied to clipboard!', 'success', 2000);
          }).catch(() => {
            showHistoryToast('Failed to copy turn', 'error');
          });
        }
      });
    });

    // Replay neural speech button
    document.querySelectorAll('.replay-speech-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const id = this.getAttribute('data-turn-id');
        const item = historyData.find(h => (h.id || '') === id);
        if (!item) return;

        const textToSpeak = item.agentReply || item.text;
        if (!textToSpeak) {
          showHistoryToast('No speech text to replay', 'error');
          return;
        }

        this.disabled = true;
        this.style.opacity = '0.6';
        showHistoryToast(`🔊 Replaying ${item.agent || 'Agent'} speech...`, 'info', 2000);

        try {
          await ipcRenderer.invoke('replay-agent-speech', {
            text: textToSpeak,
            voice: item.voice,
            agentKey: item.agentKey
          });
        } catch (err) {
          console.error('Replay failed:', err);
          showHistoryToast('Speech replay failed', 'error');
        } finally {
          this.disabled = false;
          this.style.opacity = '1';
        }
      });
    });

    // Delete turn button
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = this.getAttribute('data-turn-id');
        deleteHistoryItem(id);
      });
    });

    // Fix single issue button
    document.querySelectorAll('.fix-single-issue-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const turnId = this.getAttribute('data-turn-id');
        if (!turnId) return;

        this.disabled = true;
        this.textContent = '⏳ Healing...';

        try {
          const res = await ipcRenderer.invoke('fix-single-agent-issue', turnId);
          if (res && res.success) {
            showHistoryToast(`🩺 Issue on turn ${turnId} fixed & sanitized!`, 'success');
            loadHistory();
          } else {
            showHistoryToast('Issue healing completed.', 'info');
            loadHistory();
          }
        } catch (err) {
          console.error('Fix single issue failed:', err);
          showHistoryToast('Healing error: ' + err.message, 'error');
        }
      });
    });
  }, 0);
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function deleteHistoryItem(id) {
  if (confirm('Delete this conversation turn?')) {
    ipcRenderer.send('delete-history-item', id);
    showHistoryToast('Turn deleted', 'info', 1500);
  }
}

function clearAllHistory() {
  if (confirm('Clear all conversation history? This cannot be undone.')) {
    ipcRenderer.send('clear-history');
    showHistoryToast('All conversation history cleared', 'info', 2000);
  }
}

// Search functionality
const searchInput = document.getElementById('historySearch');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    displayHistory(historyData, e.target.value);
  });
}

// Filter pills listener
document.querySelectorAll('#historyFilterPills .history-filter-pill').forEach(pill => {
  pill.addEventListener('click', function() {
    document.querySelectorAll('#historyFilterPills .history-filter-pill').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    currentHistoryFilter = this.getAttribute('data-filter') || 'all';
    displayHistory(historyData, currentHistorySearch);
  });
});

// Fix All Issues / Self-Heal button listener
const fixAllBtn = document.getElementById('fixAllIssuesBtn');
if (fixAllBtn) {
  fixAllBtn.addEventListener('click', async function() {
    const originalContent = this.innerHTML;
    this.disabled = true;
    this.innerHTML = `<span class="spin-animation">⚡</span> Healing Systems &amp; History...`;

    try {
      const report = await ipcRenderer.invoke('fix-all-agent-issues');
      const fixedCount = (report && report.issuesFixedCount) || 0;
      const turnsCount = (report && report.turnsHealedCount) || 0;
      showHistoryToast(`⚡ Autonomous self-healing complete! Resolved ${fixedCount} issue(s) across ${turnsCount} turn(s).`, 'success', 4000);
      loadHistory();
    } catch (err) {
      console.error('Self-healing failed:', err);
      showHistoryToast('Self-healing error: ' + err.message, 'error');
    } finally {
      this.disabled = false;
      this.innerHTML = originalContent;
    }
  });
}

// Export History button listener
const exportBtn = document.getElementById('exportHistoryBtn');
if (exportBtn) {
  exportBtn.addEventListener('click', async function() {
    try {
      const markdown = await ipcRenderer.invoke('export-history', 'markdown');
      if (markdown) {
        await navigator.clipboard.writeText(markdown);
        showHistoryToast('📥 Complete conversation history exported & copied as Markdown!', 'success', 3500);
      } else {
        showHistoryToast('No history records to export.', 'info');
      }
    } catch (err) {
      console.error('Export failed:', err);
      showHistoryToast('Export failed: ' + err.message, 'error');
    }
  });
}

// Clear All History button listener
const clearAllBtn = document.getElementById('clearAllHistoryBtn');
if (clearAllBtn) {
  clearAllBtn.addEventListener('click', clearAllHistory);
}

// Listen for history updates
ipcRenderer.on('history-data', (_, history) => {
  console.log('Received history data:', history ? history.length : 0, 'items');
  historyData = Array.isArray(history) ? history : [];
  displayHistory(historyData, currentHistorySearch);
  updateLastTranscriptionDisplay(historyData);
  ipcRenderer.invoke('get-history-stats').then(stats => {
    if (stats) updateHistoryTelemetryStats(stats);
  }).catch(() => {});
});

// Also listen for history-updated event for real-time updates
ipcRenderer.on('history-updated', (_, history) => {
  console.log('Received history-updated event:', history ? history.length : 0, 'items');
  historyData = Array.isArray(history) ? history : [];
  displayHistory(historyData, currentHistorySearch);
  updateLastTranscriptionDisplay(historyData);
  ipcRenderer.invoke('get-history-stats').then(stats => {
    if (stats) updateHistoryTelemetryStats(stats);
  }).catch(() => {});
});

// Update the most recent transcription display
function updateLastTranscriptionDisplay(history) {
  if (history && history.length > 0) {
    const latest = history[0]; // Most recent is at index 0
    const textElement = document.getElementById('lastTranscriptionText');
    const timeElement = document.getElementById('lastTranscriptionTime');
    const copyButton = document.getElementById('copyLastTranscription');

    if (textElement && (latest.agentReply || latest.text)) {
      textElement.innerHTML = escapeHtml(latest.agentReply || latest.text);
      textElement.setAttribute('data-raw-text', latest.agentReply || latest.text);
    }

    if (timeElement && latest.timestamp) {
      const date = new Date(latest.timestamp);
      timeElement.textContent = date.toLocaleTimeString();
    }

    if (copyButton) {
      copyButton.style.display = 'block';
    }
  }
}

// Copy last transcription to clipboard
function copyLastTranscriptionText() {
  const textElement = document.getElementById('lastTranscriptionText');
  if (textElement) {
    const text = textElement.getAttribute('data-raw-text') || textElement.textContent;
    navigator.clipboard.writeText(text).then(() => {
      const copyButton = document.getElementById('copyLastTranscription');
      const originalText = copyButton.textContent;
      copyButton.textContent = '✅ Copied!';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      showHistoryToast('Failed to copy text to clipboard', 'error');
    });
  }
}

// Load history on page load
loadHistory();


// ============================================
// AUTHENTICATION STATE MANAGEMENT
// ============================================
let currentAuthState = {
  isAuthenticated: false,
  user: null,
  subscription: null,
  usage: null,
  lastUpdate: 0
};

// Debounce auth updates to prevent rapid-fire UI changes
let authUpdateTimeout = null;
const AUTH_UPDATE_DEBOUNCE = 300; // ms

// Google Sign-in handler
function handleGoogleSignIn() {
  console.log('🔐 User clicked Google Sign In button');
  console.log('🔐 handleGoogleSignIn() called - starting debug trace');
  
  const signInBtn = document.getElementById('google-signin-btn') ||
                    document.querySelector('.sidebar-item[data-action="google-signin"]') ||
                    document.querySelector('.google-signin-btn');
  
  console.log('🔐 Sign-in button found:', !!signInBtn);
  if (signInBtn) {
    console.log('🔐 Button classes:', signInBtn.className);
    console.log('🔐 Button data-action:', signInBtn.getAttribute('data-action'));
  }
  
  if (!signInBtn) {
    console.error('Google Sign In button not found');
    showNotification('❌ Error', 'Sign in button not found');
    return;
  }
  
  // Prevent double-clicks
  if (signInBtn.classList.contains('signing-in')) {
    console.log('Already signing in, ignoring click');
    return;
  }
  
  console.log('🔐 Starting sign-in process...');
  console.log('🔐 About to send IPC message...');
  
  signInBtn.classList.add('signing-in');
  signInBtn.innerHTML = `
    <div class="google-icon">
      <div class="spinner"></div>
    </div>
    <span class="signin-text">Signing in...</span>
  `;
  
  // Re-enable after 8 seconds as fallback
  const resetTimeout = setTimeout(() => {
    if (signInBtn && !currentAuthState.isAuthenticated) {
      console.log('⏰ Sign-in timeout, resetting button');
      signInBtn.classList.remove('signing-in');
      resetSignInButton(signInBtn);
      showNotification('⏰ Timeout', 'Sign in took too long. Please try again.');
    }
  }, 8000);
  
  try {
    console.log('📤 Sending initiate-google-signin IPC message');
    console.log('📤 ipcRenderer available:', !!ipcRenderer);
    console.log('📤 ipcRenderer type:', typeof ipcRenderer);
    
    if (!ipcRenderer || typeof ipcRenderer.send !== 'function') {
      throw new Error('ipcRenderer not available or invalid');
    }
    
    ipcRenderer.send('initiate-google-signin');
    console.log('📤 IPC message sent successfully');
    
    // Store timeout ID to clear it on successful sign-in
    signInBtn.dataset.resetTimeout = resetTimeout;
  } catch (error) {
    console.error('Error initiating Google sign-in:', error);
    console.error('Error stack:', error.stack);
    clearTimeout(resetTimeout);
    signInBtn.classList.remove('signing-in');
    resetSignInButton(signInBtn);
    showNotification('❌ Sign In Failed', error.message || 'Please try again');
  }
}

function resetSignInButton(btn) {
  console.log('🔄 Resetting sign-in button');
  
  // Query for the button fresh to ensure we have the current DOM reference
  let currentButton = document.getElementById('google-signin-btn') ||
                      document.querySelector('.sidebar-item[data-action="user-menu"]') ||
                      document.querySelector('.sidebar-item[data-action="google-signin"]') ||
                      document.querySelector('.google-signin-btn');
  
  if (!currentButton) {
    console.warn('⚠️ Could not find button to reset');
    return;
  }
  
  // Clear any pending timeout
  if (currentButton.dataset.resetTimeout) {
    clearTimeout(parseInt(currentButton.dataset.resetTimeout));
    delete currentButton.dataset.resetTimeout;
  }
  
  // Update content and attributes FIRST
  currentButton.classList.remove('signing-in');
  currentButton.classList.add('google-signin-btn');
  currentButton.setAttribute('id', 'google-signin-btn');
  currentButton.setAttribute('data-action', 'google-signin');
  currentButton.innerHTML = `
    <div class="google-icon">
      <svg viewBox="0 0 48 48" width="20" height="20">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      </svg>
    </div>
    <span class="signin-text">Google Sign In</span>
  `;
  
  // Clone and replace to remove ALL event listeners
  const parent = currentButton.parentNode;
  if (parent) {
    const newButton = currentButton.cloneNode(true);
    parent.replaceChild(newButton, currentButton);
    currentButton = newButton; // Update reference
    
    // Add fresh click listener for sign-in
    currentButton.addEventListener('click', function(e) {
      console.log('🖱️ Sign-in button clicked (after reset)');
      e.preventDefault();
      e.stopPropagation();
      handleGoogleSignIn();
    });
    
    console.log('✅ Sign-in button reset with fresh listener');
  } else {
    console.warn('⚠️ Button has no parent, adding listener directly to existing button');
    
    // Just add the event listener directly without trying to replace
    // First remove any existing listeners by cloning the attributes only
    const newButton = document.createElement('div');
    newButton.className = currentButton.className;
    newButton.innerHTML = currentButton.innerHTML;
    Array.from(currentButton.attributes).forEach(attr => {
      newButton.setAttribute(attr.name, attr.value);
    });
    
    // Find the parent by looking for the sidebar
    const sidebar = document.querySelector('.sidebar-content');
    if (sidebar) {
      // Find the account section
      const accountSection = Array.from(sidebar.children).find(child => 
        child.textContent && child.textContent.includes('Account')
      );
      if (accountSection) {
        // Replace the old button with the new one
        const oldButton = accountSection.querySelector('.sidebar-item[data-action="user-menu"], .sidebar-item[data-action="google-signin"], #google-signin-btn');
        if (oldButton) {
          accountSection.replaceChild(newButton, oldButton);
          currentButton = newButton;
        }
      }
    }
    
    // Add fresh click listener
    currentButton.addEventListener('click', function(e) {
      console.log('🖱️ Sign-in button clicked (after reset, no parent)');
      e.preventDefault();
      e.stopPropagation();
      handleGoogleSignIn();
    });
    
    console.log('✅ Sign-in button reset with fresh listener (no parent)');
  }
}

// Plan management functions
function subscribeToPlan(planType) {
  console.log('💰 Subscribing to plan:', planType);
  
  // Show loading state on the button
  const button = document.querySelector(`button[data-plan="${planType}"]`);
  if (button) {
    const originalText = button.innerHTML;
    button.innerHTML = '⏳ Creating payment...';
    button.disabled = true;
    
    // Reset button after 10 seconds if no response
    setTimeout(() => {
      if (button.disabled) {
        button.innerHTML = originalText;
        button.disabled = false;
      }
    }, 10000);
  }
  
  // Get crypto payment amount for the plan
  const paymentAmount = getCryptoPaymentAmount(planType);
  
  // Create crypto payment with BlockBee
  ipcRenderer.send('create-crypto-payment', {
    amount: paymentAmount.usd,
    currency: 'USD',
    coin: 'usdt_bep20', // Default to USDT BEP20
    planType: planType,
    description: paymentAmount.description
  });
}

// Helper function to get crypto payment amounts
function getCryptoPaymentAmount(planType) {
  const amounts = {
    'starter': { usd: 2.99, description: 'Starter Plan - Monthly' },
    'pro': { usd: 9.99, description: 'Pro Plan - Monthly' },
    'enterprise': { usd: 19.99, description: 'Enterprise Plan - Monthly' }
  };
  
  return amounts[planType] || amounts['starter'];
}

function managePlan() {
  ipcRenderer.send('manage-subscription');
}

// Listen for crypto payment responses
ipcRenderer.on('crypto-payment-created', (_, paymentData) => {
  console.log('💰 Crypto payment created:', paymentData);
  console.log('🔍 Payment instructions:', paymentData.paymentInstructions);
  console.log('🔍 QR code URL:', paymentData.qr_code_url);
  console.log('🔍 QR code from instructions:', paymentData.paymentInstructions?.qr_code);
  
  // Reset all plan buttons
  document.querySelectorAll('button[data-plan]').forEach(btn => {
    btn.disabled = false;
    const plan = btn.getAttribute('data-plan');
    if (plan === 'starter') btn.innerHTML = 'Upgrade to Starter';
    else if (plan === 'pro') btn.innerHTML = 'Upgrade to Pro';
    else if (plan === 'enterprise') btn.innerHTML = 'Upgrade to Enterprise';
  });
  
  // Show payment instructions modal
  showPaymentInstructions(paymentData);
  
  // Optionally show payment details
  if (paymentData.estimate) {
    showNotification('💰 Payment Details', 
      `Amount: ${paymentData.estimate.amount_crypto} ${paymentData.estimate.coin.toUpperCase()}\n` +
      `USD Value: $${paymentData.estimate.amount_usd}`
    );
  }
});

ipcRenderer.on('crypto-payment-error', (_, error) => {
  console.error('💰 Crypto payment error:', error);
  
  // Reset all plan buttons
  document.querySelectorAll('button[data-plan]').forEach(btn => {
    btn.disabled = false;
    const plan = btn.getAttribute('data-plan');
    if (plan === 'starter') btn.innerHTML = 'Upgrade to Starter';
    else if (plan === 'pro') btn.innerHTML = 'Upgrade to Pro';
    else if (plan === 'enterprise') btn.innerHTML = 'Upgrade to Enterprise';
  });
  
  showNotification('❌ Payment Error', error || 'Failed to create crypto payment');
});
ipcRenderer.on('auth-status', (_, authData) => {
  console.log('📊 Auth status received:', authData?.isAuthenticated ? 'authenticated' : 'not authenticated');
  
  if (authData && authData.isAuthenticated && authData.user) {
    updateAuthState(authData);
  }
  // Don't auto-initiate sign-in - let user click the button
});

// INSTANT FRONTEND UPDATE: Listen for real-time auth updates with debouncing
ipcRenderer.on('auth-updated', (_, authData) => {
  console.log('📥 Auth update received:', authData);
  
  // Clear any pending timeout on the sign-in button
  const signInBtn = document.getElementById('google-signin-btn');
  if (signInBtn && signInBtn.dataset.resetTimeout) {
    clearTimeout(parseInt(signInBtn.dataset.resetTimeout));
    delete signInBtn.dataset.resetTimeout;
  }
  
  // Debounce rapid updates
  if (authUpdateTimeout) {
    clearTimeout(authUpdateTimeout);
  }
  
  authUpdateTimeout = setTimeout(() => {
    const now = Date.now();
    
    // Skip if same state received within debounce window
    if (now - currentAuthState.lastUpdate < AUTH_UPDATE_DEBOUNCE) {
      return;
    }
    
    console.log('🔄 Auth update processed:', authData?.isAuthenticated ? 'signed in' : 'signed out');
    
    if (authData && authData.isAuthenticated && authData.user) {
      // Only show notification if state actually changed
      const wasAuthenticated = currentAuthState.isAuthenticated;
      updateAuthState(authData);
      
      if (!wasAuthenticated) {
        showNotification('✅ Signed In', `Welcome, ${authData.user.name || authData.user.email}!`);
      }
    } else if (authData && authData.pending) {
      // Handle pending sign-in (waiting for browser OAuth)
      console.log('⏳ Sign-in pending, waiting for browser OAuth');
      showNotification('🌐 Sign In', authData.message || 'Complete sign-in in your browser');
    } else if (authData && authData.error) {
      // Handle sign-in error
      console.error('❌ Sign-in error:', authData.error);
      resetToSignedOutUI();
      showNotification('❌ Sign In Failed', authData.error);
    } else if (!authData || (!authData.isAuthenticated && currentAuthState.isAuthenticated)) {
      // Handle sign out
      currentAuthState = {
        isAuthenticated: false,
        user: null,
        subscription: null,
        usage: null,
        lastUpdate: now
      };
      resetToSignedOutUI();
      showNotification('👋 Signed Out', 'See you next time!');
    }
  }, AUTH_UPDATE_DEBOUNCE);
});

function updateAuthState(authData) {
  currentAuthState = {
    isAuthenticated: authData.isAuthenticated,
    user: authData.user,
    subscription: authData.subscription,
    usage: authData.usage,
    lastUpdate: Date.now()
  };
  
  updateAuthUI(authData.user);
  if (authData.subscription) {
    updatePlanUI(authData.subscription);
  }
  
  // Initialize usage tracking only after successful authentication
  // Add small delay to ensure token is available in main process
  if (authData.isAuthenticated && authData.user) {
    console.log('📊 User authenticated, initializing usage tracking...');
    setTimeout(function() {
      initGlobalUsageTracking();
    }, 500);
  }
  
  // Check admin access when auth state changes
  setTimeout(checkAdminAccess, 100);
}

// Listen for subscription status updates
ipcRenderer.on('subscription-status', (_, subscriptionData) => {
  updatePlanUI(subscriptionData);
});

// Reset UI to signed-out state
function resetToSignedOutUI() {
  console.log('🔄 Resetting UI to signed-out state');
  
  // Cancel any pending auth UI updates
  updateAuthUITimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  updateAuthUITimeouts = [];
  isUpdatingAuthUI = false; // Reset the flag
  
  const userMenuItem = document.getElementById('google-signin-btn') ||
                       document.querySelector('.sidebar-item[data-action="user-menu"]') ||
                       document.querySelector('.sidebar-item[data-action="google-signin"]');
  
  if (userMenuItem) {
    resetSignInButton(userMenuItem);
    console.log('✅ Sign-in button reset');
  } else {
    console.warn('⚠️ Could not find button to reset');
  }
  
  // Hide user menu if open
  hideUserMenu();
}

// Update authentication UI
let updateAuthUITimeouts = [];
let isUpdatingAuthUI = false; // Flag to prevent concurrent updates

function updateAuthUI(user) {
  // Cancel any pending updates to prevent conflicts
  updateAuthUITimeouts.forEach(timeoutId => clearTimeout(timeoutId));
  updateAuthUITimeouts = [];
  
  if (!user || isUpdatingAuthUI) return;
  
  isUpdatingAuthUI = true;
  
  const updateUI = () => {
    // Find the sign-in button by ID first, then by action type
    let authButton = document.getElementById('google-signin-btn') ||
                     document.querySelector('.sidebar-item[data-action="google-signin"]') ||
                     document.querySelector('.sidebar-item[data-action="user-menu"]') ||
                     document.querySelector('.google-signin-btn');
    
    // Fallback: find by text content
    if (!authButton) {
      const sidebarItems = document.querySelectorAll('.sidebar-item');
      for (let item of sidebarItems) {
        if (item.textContent.includes('Google Sign In') || item.textContent.includes('Signing in') || 
            (user.name && item.textContent.includes(user.name)) || 
            (user.email && item.textContent.includes(user.email))) {
          authButton = item;
          break;
        }
      }
    }
    
    console.log('🔄 Updating auth UI, button found:', !!authButton);
    
    if (authButton) {
      const displayName = user.name || user.email.split('@')[0];
      const isAdmin = user.role === 'admin' || user.email === 'hritthikin@gmail.com';
      
      // Clear any pending timeout
      if (authButton.dataset.resetTimeout) {
        clearTimeout(parseInt(authButton.dataset.resetTimeout));
        delete authButton.dataset.resetTimeout;
      }
      
      // Check if button already shows the correct user (avoid unnecessary updates)
      const currentText = authButton.textContent || '';
      if (currentText.includes(displayName) && authButton.getAttribute('data-action') === 'user-menu') {
        console.log('✅ Auth UI already up to date for user:', displayName);
        isUpdatingAuthUI = false;
        return;
      }
      
      // Update content and attributes FIRST
      authButton.classList.remove('signing-in', 'google-signin-btn');
      authButton.setAttribute('data-action', 'user-menu');
      authButton.innerHTML = `
        <div class="user-avatar" style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white; flex-shrink: 0;">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
        ${isAdmin ? '<span style="font-size: 10px; background: rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; color: #c4b5fd;">Admin</span>' : ''}
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; opacity: 0.6; flex-shrink: 0;">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      `;
      
      // Clone and replace to remove ALL old event listeners
      const parent = authButton.parentNode;
      if (parent) {
        const newButton = authButton.cloneNode(true);
        parent.replaceChild(newButton, authButton);
        
        // Add fresh click listener for user menu
        newButton.addEventListener('click', function(e) {
          console.log('🖱️ User menu button clicked (after auth)');
          e.preventDefault();
          e.stopPropagation();
          showUserMenu();
        });
        
        console.log('✅ Auth UI updated to show user:', displayName);
        console.log('✅ Click listener re-attached');
      } else {
        // Button has no parent - this can happen during rapid updates
        // Just add listener directly and don't log as warning since it's handled
        authButton.addEventListener('click', function(e) {
          console.log('🖱️ User menu button clicked (after auth, direct)');
          e.preventDefault();
          e.stopPropagation();
          showUserMenu();
        });
        console.log('✅ Auth UI updated (direct listener)');
      }
    }
    
    isUpdatingAuthUI = false;
  };
  
  // Try immediately first
  updateUI();
  
  // Only add delayed updates if the immediate update didn't work
  if (isUpdatingAuthUI) {
    updateAuthUITimeouts.push(setTimeout(() => {
      if (!isUpdatingAuthUI) updateUI();
    }, 100));
  }
}

// Update plan UI
function updatePlanUI(subscription) {
  const currentPlanName = document.getElementById('currentPlanName');
  const currentPlanDetails = document.getElementById('currentPlanDetails');
  
  if (currentPlanName && subscription) {
    currentPlanName.textContent = subscription.planName || subscription.plan || 'Free Plan';
    if (currentPlanDetails) {
      currentPlanDetails.textContent = subscription.status === 'active' 
        ? `Active until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
        : 'Limited features';
    }
  }
}

// ============================================
// USER MENU DROPDOWN
// ============================================
let userMenuVisible = false;

function showUserMenu() {
  console.log('🔽 showUserMenu called');
  console.log('   userMenuVisible:', userMenuVisible);
  console.log('   currentAuthState:', currentAuthState);
  
  // If menu already visible, hide it
  if (userMenuVisible) {
    console.log('   Menu already visible, hiding...');
    hideUserMenu();
    return;
  }
  
  // Check if user is authenticated
  if (!currentAuthState.isAuthenticated) {
    console.log('❌ User not authenticated, redirecting to sign-in');
    handleGoogleSignIn();
    return;
  }
  
  const user = currentAuthState.user;
  if (!user) {
    console.error('❌ No user found in currentAuthState');
    console.log('   currentAuthState:', JSON.stringify(currentAuthState, null, 2));
    console.log('   Attempting to sign in instead...');
    handleGoogleSignIn();
    return;
  }
  
  console.log('✅ User found:', user.email);
  
  // Remove any existing menu
  hideUserMenu();
  
  const isAdmin = user.role === 'admin' || user.email === 'hritthikin@gmail.com';
  console.log('   isAdmin:', isAdmin);
  
  // Create overlay to capture outside clicks
  const overlay = document.createElement('div');
  overlay.id = 'user-menu-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 10000;
    background: transparent;
  `;
  overlay.addEventListener('click', hideUserMenu);
  document.body.appendChild(overlay);
  
  // Create dropdown menu - positioned to the right of sidebar
  const menu = document.createElement('div');
  menu.id = 'user-dropdown-menu';
  menu.style.cssText = `
    position: fixed;
    left: 300px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(145deg, #1e293b, #0f172a);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 0;
    width: 280px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05);
    z-index: 10001;
    overflow: hidden;
    animation: menuSlideIn 0.2s ease-out;
  `;
  
  // Add animation keyframes if not exists
  if (!document.getElementById('menu-animations')) {
    const style = document.createElement('style');
    style.id = 'menu-animations';
    style.textContent = `
      @keyframes menuSlideIn {
        from {
          opacity: 0;
          transform: translateY(-50%) translateX(-10px);
        }
        to {
          opacity: 1;
          transform: translateY(-50%) translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Create header with user info
  const header = document.createElement('div');
  header.style.cssText = `
    padding: 20px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1), rgba(139, 92, 246, 0.1));
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  `;
  header.innerHTML = `
    <div style="display: flex; align-items: center; gap: 14px;">
      <div style="width: 48px; height: 48px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 600; color: white; flex-shrink: 0; box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);">
        ${(user.name || user.email).charAt(0).toUpperCase()}
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 16px; font-weight: 600; color: white; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name || 'User'}</div>
        <div style="font-size: 13px; color: rgba(255, 255, 255, 0.6); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.email}</div>
        ${isAdmin ? '<div style="margin-top: 6px;"><span style="font-size: 11px; background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(139, 92, 246, 0.3)); padding: 3px 8px; border-radius: 6px; color: #c4b5fd; font-weight: 500;">Admin</span></div>' : ''}
      </div>
    </div>
  `;
  menu.appendChild(header);
  
  // Menu items container
  const menuItems = document.createElement('div');
  menuItems.style.cssText = 'padding: 8px;';
  
  // Admin Panel button (if admin)
  if (isAdmin) {
    const adminItem = createMenuItemNew('Admin Panel', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/><path d="M12 11V8M12 15h.01"/></svg>`, '#a78bfa');
    adminItem.addEventListener('click', function(e) {
      console.log('🔧 Admin Panel button clicked');
      e.preventDefault();
      e.stopPropagation();
      
      try {
        hideUserMenu();
        console.log('🔧 Menu hidden, opening admin panel...');
        openAdminPanel();
      } catch (error) {
        console.error('❌ Error opening admin panel:', error);
        showNotification('❌ Error', 'Failed to open admin panel: ' + error.message);
      }
    });
    menuItems.appendChild(adminItem);
    console.log('✅ Admin Panel button added to menu');
  } else {
    console.log('ℹ️ User is not admin, Admin Panel button not shown');
  }
  
  // Settings button
  const settingsItem = createMenuItemNew('Settings', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`, 'rgba(255, 255, 255, 0.9)');
  settingsItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    hideUserMenu();
    showSection('settings');
  });
  menuItems.appendChild(settingsItem);
  
  // Subscription button
  const subscriptionItem = createMenuItemNew('Subscription', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`, '#fbbf24');
  subscriptionItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    hideUserMenu();
    showSection('plans');
  });
  menuItems.appendChild(subscriptionItem);
  
  menu.appendChild(menuItems);
  
  // Divider
  const divider = document.createElement('div');
  divider.style.cssText = 'height: 1px; background: rgba(255, 255, 255, 0.1); margin: 0 8px;';
  menu.appendChild(divider);
  
  // Sign out section
  const signoutSection = document.createElement('div');
  signoutSection.style.cssText = 'padding: 8px;';
  
  const signoutItem = createMenuItemNew('Sign Out', `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 20px; height: 20px;"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`, '#f87171');
  signoutItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    handleSignOut();
  });
  signoutSection.appendChild(signoutItem);
  menu.appendChild(signoutSection);
  
  document.body.appendChild(menu);
  userMenuVisible = true;
}

function createMenuItemNew(text, iconSvg, color) {
  const item = document.createElement('div');
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: ${color};
    transition: all 0.15s ease;
    margin: 2px 0;
  `;
  
  item.innerHTML = `
    <span style="display: flex; align-items: center; justify-content: center; opacity: 0.8;">${iconSvg}</span>
    <span>${text}</span>
  `;
  
  item.addEventListener('mouseenter', function() {
    this.style.background = 'rgba(255, 255, 255, 0.08)';
    this.style.transform = 'translateX(4px)';
  });
  
  item.addEventListener('mouseleave', function() {
    this.style.background = 'transparent';
    this.style.transform = 'translateX(0)';
  });
  
  return item;
}

function hideUserMenu() {
  console.log('🔄 Hiding user menu');
  
  // Remove menu
  const menu = document.getElementById('user-dropdown-menu');
  if (menu && menu.parentNode) {
    menu.parentNode.removeChild(menu);
  }
  
  // Remove overlay
  const overlay = document.getElementById('user-menu-overlay');
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  
  // Also try to remove any stray elements
  document.querySelectorAll('#user-dropdown-menu, #user-menu-overlay').forEach(el => {
    if (el && el.parentNode) {
      el.parentNode.removeChild(el);
    }
  });
  
  userMenuVisible = false;
  document.removeEventListener('click', handleOutsideClick);
  
  console.log('✅ User menu hidden');
}

function handleOutsideClick(e) {
  const menu = document.getElementById('user-dropdown-menu');
  const userButton = document.getElementById('google-signin-btn') ||
                     document.querySelector('.sidebar-item[data-action="user-menu"]');
  
  if (menu && !menu.contains(e.target) && userButton && !userButton.contains(e.target)) {
    hideUserMenu();
  }
}

function handleSignOut() {
  console.log('🚪 handleSignOut called');
  console.log('🔍 Stack trace:', new Error().stack);
  
  // TEMPORARY: Add a confirmation to prevent accidental sign-outs
  console.log('⚠️ Sign-out requested - checking if this is intentional...');
  
  try {
    // First, forcefully remove the menu and overlay
    const menu = document.getElementById('user-dropdown-menu');
    const overlay = document.getElementById('user-menu-overlay');
    
    if (menu && menu.parentNode) {
      menu.parentNode.removeChild(menu);
      console.log('✅ Menu removed');
    }
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
      console.log('✅ Overlay removed');
    }
    userMenuVisible = false;
    
    // Reset auth state immediately
    console.log('🔄 Resetting auth state...');
    currentAuthState = {
      isAuthenticated: false,
      user: null,
      subscription: null,
      usage: null,
      lastUpdate: Date.now()
    };
    console.log('✅ Auth state reset');
    
    // Reset the button to sign-in state
    console.log('🔄 Resetting UI to signed-out state...');
    resetToSignedOutUI();
    console.log('✅ UI reset complete');
    
    // Send sign-out to main process
    console.log('📤 Sending sign-out to main process...');
    ipcRenderer.send('sign-out');
    console.log('✅ Sign-out message sent');
    
    // Show notification
    showNotification('👋 Signed Out', 'See you next time!');
    
    console.log('✅ Sign out complete');
  } catch (error) {
    console.error('❌ Error during sign out:', error);
    showNotification('❌ Error', 'Sign out failed: ' + error.message);
  }
}

// Show notification function for instant feedback
function showNotification(title, message) {
  // Create a temporary notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.95), rgba(5, 150, 105, 0.95));
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 600;
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transform: translateX(400px);
    transition: transform 0.3s ease-out;
    max-width: 300px;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: 700; margin-bottom: 4px;">${title}</div>
    <div style="font-weight: 400; opacity: 0.9;">${message}</div>
  `;
  
  document.body.appendChild(notification);
  
  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)';
  }, 100);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.transform = 'translateX(400px)';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Check authentication status on page load - single strategy for reliability
// Add a small delay to allow sign-in process to complete
setTimeout(() => {
  ipcRenderer.send('check-auth-status');
  ipcRenderer.send('check-subscription-status');
}, 100);

// Strategy 2: DOM ready check
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Dashboard DOM loaded');
  
  // Add direct click handler for Google Sign In button
  const googleSignInBtn = document.getElementById('google-signin-btn');
  if (googleSignInBtn) {
    console.log('✅ Found Google Sign In button, adding click handler');
    console.log('   Initial data-action:', googleSignInBtn.getAttribute('data-action'));
    
    googleSignInBtn.addEventListener('click', function(e) {
      console.log('🖱️ Button clicked!');
      console.log('   Event:', e);
      console.log('   Target:', e.target);
      console.log('   CurrentTarget:', e.currentTarget);
      e.preventDefault();
      e.stopPropagation();
      const action = this.getAttribute('data-action');
      console.log('   Action:', action);
      console.log('   Button element:', this);
      console.log('   currentAuthState.isAuthenticated:', currentAuthState.isAuthenticated);
      
      // Force call handleGoogleSignIn regardless of action
      console.log('   → Forcing call to handleGoogleSignIn()');
      try {
        handleGoogleSignIn();
      } catch (error) {
        console.error('   ❌ Error calling handleGoogleSignIn:', error);
      }
    });
  } else {
    console.warn('⚠️ Google Sign In button not found on DOM load');
  }
  
  // Add click event listeners for navigation
  const navButtons = document.querySelectorAll('.sidebar-item');
  
  navButtons.forEach((button) => {
    button.addEventListener('click', function(e) {
      e.stopPropagation(); // Prevent event bubbling
      
      // Handle section navigation
      const section = this.getAttribute('data-section');
      if (section) {
        showSection(section);
        return;
      }
      
      // Handle special actions
      const action = this.getAttribute('data-action');
      if (action === 'google-signin') {
        handleGoogleSignIn();
        return;
      }
      if (action === 'user-menu') {
        showUserMenu();
        return;
      }
      if (action === 'open-admin') {
        openAdminPanel();
        return;
      }
    });
  });
  
  // Add event listeners for other buttons
  const copyLastBtn = document.getElementById('copyLastTranscription');
  if (copyLastBtn) {
    copyLastBtn.addEventListener('click', copyLastTranscriptionText);
  }
  
  const clearAllBtn = document.getElementById('clearAllHistoryBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', clearAllHistory);
    // Add hover effects
    clearAllBtn.addEventListener('mouseenter', function() {
      this.style.background = 'rgba(255, 59, 48, 0.25)';
      this.style.borderColor = 'rgba(255, 59, 48, 0.5)';
      this.style.transform = 'scale(1.05)';
    });
    clearAllBtn.addEventListener('mouseleave', function() {
      this.style.background = 'rgba(255, 59, 48, 0.15)';
      this.style.borderColor = 'rgba(255, 59, 48, 0.3)';
      this.style.transform = 'scale(1)';
    });
  }
  
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  if (saveSettingsBtn) {
    saveSettingsBtn.addEventListener('click', saveSettings);
  }
  
  const managePlanBtn = document.getElementById('managePlanBtn');
  if (managePlanBtn) {
    managePlanBtn.addEventListener('click', managePlan);
  }
  
  // Add event listeners for plan subscription buttons
  const planButtons = document.querySelectorAll('button[data-plan]');
  planButtons.forEach(button => {
    button.addEventListener('click', function() {
      const plan = this.getAttribute('data-plan');
      subscribeToPlan(plan);
    });
  });
  
  // Load history on DOM ready
  loadHistory();
  
  // Check admin access after a short delay
  setTimeout(checkAdminAccess, 500);
});

// Add event listeners for toggle switches
document.querySelectorAll('.toggle-switch').forEach(toggle => {
  toggle.addEventListener('click', function() {
    this.classList.toggle('active');
  });
});

// Add event listener for search input focus/blur
const historySearchInput = document.getElementById('historySearch');
if (historySearchInput) {
  historySearchInput.addEventListener('focus', function() {
    this.style.borderColor = 'rgba(59, 130, 246, 0.6)';
    this.style.background = 'rgba(255, 255, 255, 0.15)';
    this.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.1)';
  });
  
  historySearchInput.addEventListener('blur', function() {
    this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    this.style.background = 'rgba(255, 255, 255, 0.1)';
    this.style.boxShadow = 'none';
  });
}


// Admin Panel Functions
function openAdminPanel() {
  console.log('🔧 openAdminPanel function called');
  
  try {
    console.log('🔧 Sending open-admin-panel IPC message to main process...');
    ipcRenderer.send('open-admin-panel');
    console.log('✅ IPC message sent successfully');
    
    // Show feedback to user
    showNotification('🔧 Admin Panel', 'Opening admin panel...');
  } catch (error) {
    console.error('❌ Error in openAdminPanel:', error);
    showNotification('❌ Error', 'Failed to open admin panel: ' + error.message);
  }
}

// Check if user is admin and show/hide admin panel link
async function checkAdminAccess() {
  try {
    const isAdmin = await ipcRenderer.invoke('admin-verify-access');
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) {
      adminLink.style.display = isAdmin ? 'flex' : 'none';
      console.log('🔧 Admin access:', isAdmin ? 'granted' : 'denied');
    }
  } catch (error) {
    console.log('Admin access check failed:', error.message);
    const adminLink = document.getElementById('adminPanelLink');
    if (adminLink) {
      adminLink.style.display = 'none';
    }
  }
}

// Listen for admin status updates
ipcRenderer.on('admin-status-updated', (_, isAdmin) => {
  const adminLink = document.getElementById('adminPanelLink');
  if (adminLink) {
    adminLink.style.display = isAdmin ? 'flex' : 'none';
  }
});

// Check admin access on page load
setTimeout(checkAdminAccess, 1000);


// ============================================
// GLOBAL FREE RECORDING TIME (Shared by All Users)
// ============================================

let globalUsageStats = null;
let globalUsageRefreshInterval = null;

// Get auth token from main process
async function getAuthToken() {
  try {
    const token = await ipcRenderer.invoke('get-auth-token');
    return token;
  } catch (error) {
    console.log('No auth token available');
    return null;
  }
}

// Helper function to get API URL with smart detection to avoid errors
let cachedAPIUrl = null;
let apiUrlCheckTime = 0;
let localhostFailed = false; // Track if localhost has failed before
const API_URL_CACHE_DURATION = 30000; // Cache for 30 seconds

async function getAPIUrl() {
  // Production backend URL - fallback to localhost for development
  const PRODUCTION_API_URL = 'https://agile-basin-06335-9109082620ce.herokuapp.com';
  const LOCAL_API_URL = 'http://localhost:3000';
  
  // Return cached result if still valid
  const now = Date.now();
  if (cachedAPIUrl && (now - apiUrlCheckTime) < API_URL_CACHE_DURATION) {
    return cachedAPIUrl;
  }
  
  try {
    // First try to get from config
    const config = await new Promise(function(resolve, reject) {
      const timeout = setTimeout(function() { reject(new Error('timeout')); }, 1000);
      ipcRenderer.once('config', function(_, cfg) { 
        clearTimeout(timeout);
        resolve(cfg); 
      });
      ipcRenderer.send('get-config');
    });
    
    if (config.apiUrl) {
      cachedAPIUrl = config.apiUrl;
      apiUrlCheckTime = now;
      return config.apiUrl;
    }
    
    // Skip localhost check if it failed before or if we're clearly in production
    if (localhostFailed || window.location.protocol === 'file:') {
      console.log('✅ Using production backend (localhost previously failed)');
      cachedAPIUrl = PRODUCTION_API_URL;
      apiUrlCheckTime = now;
      return PRODUCTION_API_URL;
    }
    
    // Check if we're in development mode (localhost backend running)
    // Only check localhost once, then remember the result
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // Faster timeout
      
      const localCheck = await fetch(LOCAL_API_URL + '/health', { 
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (localCheck.ok) {
        console.log('✅ Using local backend');
        cachedAPIUrl = LOCAL_API_URL;
        apiUrlCheckTime = now;
        return LOCAL_API_URL;
      }
    } catch (e) {
      // Mark localhost as failed to avoid future attempts
      localhostFailed = true;
      console.log('📡 Local backend not available, using production');
    }
    
    console.log('✅ Using production backend');
    cachedAPIUrl = PRODUCTION_API_URL;
    apiUrlCheckTime = now;
    return PRODUCTION_API_URL;
  } catch (error) {
    // Default to production
    console.log('⚠️ Config check failed, defaulting to production backend');
    cachedAPIUrl = PRODUCTION_API_URL;
    apiUrlCheckTime = now;
    return PRODUCTION_API_URL;
  }
}

// Plan limits in seconds (matching your pricing)
const PLAN_LIMITS = {
  'free': 300,        // 5 minutes/day
  'starter': 900,     // 15 minutes/day
  'pro': 3600,        // 60 minutes/day
  'enterprise': -1    // Unlimited
};

// Fetch user's usage stats from backend
async function fetchGlobalUsageStats() {
  try {
    const apiUrl = await getAPIUrl();
    const token = await getAuthToken();
    
    // If user is NOT logged in, show sign-in prompt
    if (!token || !currentAuthState.isAuthenticated) {
      console.log('📊 User not logged in, showing sign-in prompt');
      updateGlobalUsageDisplay({
        not_logged_in: true
      });
      return null;
    }
    
    // User is logged in, get their personal usage
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    };
    
    console.log('📊 Fetching user usage stats...');
    
    const response = await fetch(apiUrl + '/api/usage/stats', {
      method: 'GET',
      headers: headers
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('📊 User usage response:', data);
      
      // Get user's plan from auth state
      const userPlan = currentAuthState.subscription?.plan || currentAuthState.user?.plan || 'free';
      const limitSeconds = PLAN_LIMITS[userPlan] || PLAN_LIMITS['free'];
      
      // Use backend data if available, otherwise use local tracking
      let usedSeconds = (data.current_month || 0) * 60; // Convert minutes to seconds
      
      // If backend shows 0, use local tracking instead
      const localUsage = getLocalUsage();
      if (usedSeconds === 0 && localUsage.seconds > 0) {
        console.log('📊 Backend shows 0, using local usage:', localUsage.seconds);
        usedSeconds = localUsage.seconds;
      }
      
      globalUsageStats = {
        free_seconds_used: usedSeconds,
        free_seconds_limit: limitSeconds,
        free_seconds_remaining: limitSeconds === -1 ? -1 : Math.max(0, limitSeconds - usedSeconds),
        percentage_used: limitSeconds === -1 ? 0 : Math.min(100, (usedSeconds / limitSeconds) * 100),
        reset_period: 'daily',
        is_limit_reached: limitSeconds !== -1 && usedSeconds >= limitSeconds,
        plan: userPlan
      };
      
      updateGlobalUsageDisplay(globalUsageStats);
      return globalUsageStats;
    } else {
      // API error, show default for user's plan
      const userPlan = currentAuthState.subscription?.plan || currentAuthState.user?.plan || 'free';
      const limitSeconds = PLAN_LIMITS[userPlan] || PLAN_LIMITS['free'];
      
      globalUsageStats = {
        free_seconds_used: 0,
        free_seconds_limit: limitSeconds,
        free_seconds_remaining: limitSeconds,
        percentage_used: 0,
        reset_period: 'daily',
        is_limit_reached: false,
        plan: userPlan
      };
      
      updateGlobalUsageDisplay(globalUsageStats);
      return globalUsageStats;
    }
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    
    // If logged in but error, show defaults for their plan
    if (currentAuthState.isAuthenticated) {
      const userPlan = currentAuthState.subscription?.plan || currentAuthState.user?.plan || 'free';
      const limitSeconds = PLAN_LIMITS[userPlan] || PLAN_LIMITS['free'];
      
      const defaultStats = {
        free_seconds_used: 0,
        free_seconds_limit: limitSeconds,
        free_seconds_remaining: limitSeconds,
        percentage_used: 0,
        reset_period: 'daily',
        is_limit_reached: false,
        plan: userPlan
      };
      updateGlobalUsageDisplay(defaultStats);
      return defaultStats;
    } else {
      // Not logged in
      updateGlobalUsageDisplay({ not_logged_in: true });
      return null;
    }
  }
}

// Update the global usage display in the UI
function updateGlobalUsageDisplay(stats) {
  if (!stats) return;
  
  const usageEl = document.getElementById('freeTimeUsage');
  const progressBarEl = document.getElementById('freeTimeProgressBar');
  const resetPeriodEl = document.getElementById('freeTimeResetPeriod');
  const upgradeBtn = document.getElementById('upgradeFromFreeTime');
  
  // Handle non-logged-in users
  if (stats.not_logged_in) {
    if (usageEl) {
      usageEl.innerHTML = '<span style="color: rgba(255,255,255,0.6);">Sign in to track usage</span>';
    }
    if (progressBarEl) {
      progressBarEl.style.width = '0%';
      progressBarEl.style.background = 'rgba(255,255,255,0.2)';
    }
    if (resetPeriodEl) {
      resetPeriodEl.textContent = '';
    }
    if (upgradeBtn) {
      upgradeBtn.style.display = 'flex';
      upgradeBtn.style.background = 'linear-gradient(135deg, #3b82f6, #8b5cf6)';
      upgradeBtn.style.borderColor = '#3b82f6';
      upgradeBtn.innerHTML = '🔐 Sign in to start recording';
      upgradeBtn.onclick = function() {
        handleGoogleSignIn();
      };
    }
    return;
  }
  
  if (usageEl) {
    usageEl.innerHTML = '';
    
    // Handle unlimited plans
    if (stats.free_seconds_limit === -1) {
      usageEl.textContent = 'Unlimited';
      usageEl.style.color = '#10b981'; // Green for unlimited
    } else {
      usageEl.textContent = stats.free_seconds_used + ' / ' + stats.free_seconds_limit + ' seconds';
      
      if (stats.percentage_used >= 90) {
        usageEl.style.color = '#ef4444';
      } else if (stats.percentage_used >= 70) {
        usageEl.style.color = '#f59e0b';
      } else {
        usageEl.style.color = 'rgba(255, 255, 255, 0.9)';
      }
    }
  }
  
  if (progressBarEl) {
    if (stats.free_seconds_limit === -1) {
      progressBarEl.style.width = '100%';
      progressBarEl.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    } else {
      progressBarEl.style.width = Math.min(stats.percentage_used || 0, 100) + '%';
      
      if (stats.percentage_used >= 90) {
        progressBarEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
      } else if (stats.percentage_used >= 70) {
        progressBarEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
      } else {
        progressBarEl.style.background = 'linear-gradient(90deg, #06b6d4, #3b82f6)';
      }
    }
  }
  
  if (resetPeriodEl) {
    var periodText = stats.reset_period === 'daily' ? 'Resets daily' :
                     stats.reset_period === 'weekly' ? 'Resets weekly' :
                     'Resets monthly';
    resetPeriodEl.textContent = periodText;
  }
  
  if (upgradeBtn) {
    // Reset onclick to default behavior
    upgradeBtn.onclick = function() {
      showSection('plans');
    };
    
    // Hide upgrade button for paid plans
    if (stats.plan && stats.plan !== 'free') {
      upgradeBtn.style.display = 'none';
    } else if (stats.is_limit_reached) {
      upgradeBtn.style.display = 'flex';
      upgradeBtn.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      upgradeBtn.style.borderColor = '#f59e0b';
      upgradeBtn.innerHTML = '⚠️ Free limit reached - Upgrade now!';
    } else {
      upgradeBtn.style.display = 'flex';
      upgradeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
      upgradeBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      upgradeBtn.innerHTML = 'Upgrade now - Early bird discount🔥';
    }
  }
}

// Check if free time is available before recording
async function checkFreeTimeAvailable(secondsNeeded) {
  secondsNeeded = secondsNeeded || 60;
  try {
    const apiUrl = await getAPIUrl();
    const token = await getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
    }
    
    const response = await fetch(apiUrl + '/api/global-usage/check?seconds=' + secondsNeeded, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      return { available: true };
    }
    
    const result = await response.json();
    
    if (result.stats) {
      updateGlobalUsageDisplay(result.stats);
    }
    
    return result;
  } catch (error) {
    console.error('Error checking free time availability:', error);
    return { available: true };
  }
}

// Initialize global usage tracking
function initGlobalUsageTracking() {
  console.log('📊 Initializing global usage tracking...');
  fetchGlobalUsageStats();
  
  if (globalUsageRefreshInterval) {
    clearInterval(globalUsageRefreshInterval);
  }
  globalUsageRefreshInterval = setInterval(fetchGlobalUsageStats, 30000);
  
  var upgradeBtn = document.getElementById('upgradeFromFreeTime');
  if (upgradeBtn) {
    upgradeBtn.addEventListener('click', function() {
      showSection('plans');
    });
  }
}

// Local usage tracking (persists in localStorage)
function getLocalUsage() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const stored = localStorage.getItem('eloquent_local_usage');
    if (stored) {
      const data = JSON.parse(stored);
      // Reset if it's a new day
      if (data.date !== today) {
        return { date: today, seconds: 0 };
      }
      return data;
    }
    return { date: today, seconds: 0 };
  } catch (e) {
    return { date: new Date().toISOString().split('T')[0], seconds: 0 };
  }
}

function saveLocalUsage(data) {
  try {
    localStorage.setItem('eloquent_local_usage', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save local usage:', e);
  }
}

function addLocalUsage(seconds) {
  const usage = getLocalUsage();
  usage.seconds += seconds;
  saveLocalUsage(usage);
  return usage.seconds;
}

// Listen for recording events to refresh global usage
ipcRenderer.on('recording-complete', function(event, data) {
  console.log('📊 Recording complete event received:', data);
  
  // Add to local usage tracking
  const duration = data?.duration || 0;
  if (duration > 0) {
    const totalSeconds = addLocalUsage(duration);
    console.log(`📊 Local usage updated: +${duration}s, total: ${totalSeconds}s`);
    
    // Update the UI immediately with local data
    if (globalUsageStats && currentAuthState.isAuthenticated) {
      const userPlan = currentAuthState.subscription?.plan || currentAuthState.user?.plan || 'free';
      const limitSeconds = PLAN_LIMITS[userPlan] || PLAN_LIMITS['free'];
      
      globalUsageStats = {
        free_seconds_used: totalSeconds,
        free_seconds_limit: limitSeconds,
        free_seconds_remaining: limitSeconds === -1 ? -1 : Math.max(0, limitSeconds - totalSeconds),
        percentage_used: limitSeconds === -1 ? 0 : Math.min(100, (totalSeconds / limitSeconds) * 100),
        reset_period: 'daily',
        is_limit_reached: limitSeconds !== -1 && totalSeconds >= limitSeconds,
        plan: userPlan
      };
      
      updateGlobalUsageDisplay(globalUsageStats);
    }
  }
  
  // Also try to fetch from backend (may have updated data)
  setTimeout(fetchGlobalUsageStats, 1000);
});

// Listen for usage reported from main process
ipcRenderer.on('usage-reported', function(event, data) {
  console.log('📊 Usage reported from main process:', data);
  // Refresh usage stats immediately
  fetchGlobalUsageStats();
});

// Initialize on page load - but wait for authentication
document.addEventListener('DOMContentLoaded', function() {
  // Don't initialize usage tracking immediately - wait for authentication
  console.log('📊 DOM loaded, waiting for authentication before initializing usage tracking...');
});

// Also initialize after a short delay (in case DOMContentLoaded already fired)
setTimeout(initGlobalUsageTracking, 500);

// Payment modal functions
function showPaymentInstructions(paymentData) {
  console.log('🔍 showPaymentInstructions called with:', paymentData);
  console.log('🔍 QR code check:', {
    'paymentInstructions.qr_code': paymentData.paymentInstructions?.qr_code,
    'qr_code_url': paymentData.qr_code_url,
    'condition': !!(paymentData.paymentInstructions?.qr_code || paymentData.qr_code_url)
  });
  
  // Create payment instructions modal
  const modal = document.createElement('div');
  modal.className = 'payment-modal';
  modal.innerHTML = `
    <div class="payment-modal-content">
      <div class="payment-header">
        <h2>💰 Complete Your Payment</h2>
        <span class="close-modal">&times;</span>
      </div>
      
      <div class="payment-details">
        <div class="plan-info">
          <h3>${paymentData.plan?.name || 'Plan'} Subscription</h3>
          <p class="plan-price">$${paymentData.plan?.price || 'N/A'} USD</p>
        </div>
        
        <div class="payment-instructions">
          <h4>Send Payment To:</h4>
          <div class="payment-address">
            <label>Payment Address:</label>
            <div class="address-container">
              <input type="text" value="${paymentData.paymentAddress}" readonly class="payment-address-input">
              <button class="copy-address-btn" data-address="${paymentData.paymentAddress}">Copy</button>
            </div>
          </div>
          
          <div class="payment-amount">
            <label>Exact Amount:</label>
            <div class="amount-container">
              <input type="text" value="${paymentData.paymentAmount} ${paymentData.paymentCoin?.toUpperCase()}" readonly class="payment-amount-input">
              <button class="copy-amount-btn" data-amount="${paymentData.paymentAmount}">Copy Amount</button>
            </div>
          </div>
          
          <div class="payment-network">
            <label>Network:</label>
            <span class="network-info">${paymentData.paymentInstructions?.network || 'BEP20 (Binance Smart Chain)'}</span>
          </div>
          
          ${(paymentData.paymentInstructions?.qr_base64 || paymentData.paymentInstructions?.qr_code || paymentData.qr_code_url) ? `
          <div class="payment-qr">
            <label>QR Code:</label>
            <div class="qr-container">
              <img src="${paymentData.paymentInstructions?.qr_base64 || paymentData.paymentInstructions?.qr_code || paymentData.qr_code_url}" alt="Payment QR Code" class="qr-code-image" 
                   onerror="console.error('QR code failed to load:', this.src); this.parentElement.innerHTML='<p style=\\'color: #999; font-size: 14px;\\'>QR code failed to load</p>';">
            </div>
          </div>
          ` : `
          <div class="payment-qr">
            <label>QR Code:</label>
            <div class="qr-container">
              <p style="color: #999; font-size: 14px;">QR code not available</p>
              <p style="color: #666; font-size: 12px;">Debug: qr_base64=${paymentData.paymentInstructions?.qr_base64 ? 'present' : 'missing'}, qr_code=${paymentData.paymentInstructions?.qr_code ? 'present' : 'missing'}, qr_code_url=${paymentData.qr_code_url ? 'present' : 'missing'}</p>
            </div>
          </div>
          `}
        </div>
        
        <div class="payment-warnings">
          <div class="warning-item">
            ⚠️ Send the EXACT amount shown above
          </div>
          <div class="warning-item">
            ⚠️ Use ${paymentData.paymentInstructions?.network || 'BEP20'} network only
          </div>
          <div class="warning-item">
            ⚠️ Payment will be confirmed automatically
          </div>
        </div>
        
        <div class="payment-status">
          <p>Order ID: <code>${paymentData.orderId}</code></p>
          <p class="status-text">Waiting for payment...</p>
        </div>
        
        <div class="payment-actions">
          <button class="btn-primary check-status-btn" data-order-id="${paymentData.orderId}">Check Payment Status</button>
          <button class="btn-secondary close-modal-btn">Close</button>
        </div>
      </div>
    </div>
  `;
  
  // Add modal styles if not already added
  if (!document.getElementById('payment-modal-styles')) {
    const style = document.createElement('style');
    style.id = 'payment-modal-styles';
    style.textContent = `
      .payment-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      }
      
      .payment-modal-content {
        background: #1a1a1a;
        border-radius: 12px;
        padding: 24px;
        max-width: 500px;
        width: 90%;
        max-height: 90vh;
        overflow-y: auto;
        border: 1px solid #333;
      }
      
      .payment-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        border-bottom: 1px solid #333;
        padding-bottom: 16px;
      }
      
      .payment-header h2 {
        margin: 0;
        color: #fff;
      }
      
      .close-modal {
        font-size: 24px;
        cursor: pointer;
        color: #999;
      }
      
      .close-modal:hover {
        color: #fff;
      }
      
      .plan-info {
        text-align: center;
        margin-bottom: 24px;
        padding: 16px;
        background: #2a2a2a;
        border-radius: 8px;
      }
      
      .plan-info h3 {
        margin: 0 0 8px 0;
        color: #60a5fa;
      }
      
      .plan-price {
        font-size: 24px;
        font-weight: bold;
        color: #10b981;
        margin: 0;
      }
      
      .payment-instructions {
        margin-bottom: 20px;
      }
      
      .payment-instructions h4 {
        color: #fff;
        margin-bottom: 16px;
      }
      
      .payment-address, .payment-amount, .payment-network {
        margin-bottom: 16px;
      }
      
      .payment-address label, .payment-amount label, .payment-network label {
        display: block;
        color: #ccc;
        margin-bottom: 4px;
        font-size: 14px;
      }
      
      .address-container, .amount-container {
        display: flex;
        gap: 8px;
      }
      
      .payment-address-input, .payment-amount-input {
        flex: 1;
        padding: 8px 12px;
        background: #333;
        border: 1px solid #555;
        border-radius: 4px;
        color: #fff;
        font-family: monospace;
        font-size: 12px;
      }
      
      .copy-address-btn, .copy-amount-btn {
        padding: 8px 12px;
        background: #60a5fa;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }
      
      .copy-address-btn:hover, .copy-amount-btn:hover {
        background: #3b82f6;
      }
      
      .network-info {
        color: #10b981;
        font-weight: bold;
      }
      
      .payment-qr {
        margin-bottom: 16px;
        text-align: center;
      }
      
      .qr-container {
        margin-top: 8px;
      }
      
      .qr-code-image {
        max-width: 200px;
        height: auto;
        border: 2px solid #333;
        border-radius: 8px;
        background: white;
        padding: 8px;
      }
      
      .payment-warnings {
        background: #fef3cd;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      
      .warning-item {
        color: #92400e;
        margin-bottom: 8px;
        font-size: 14px;
      }
      
      .warning-item:last-child {
        margin-bottom: 0;
      }
      
      .payment-status {
        background: #2a2a2a;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 20px;
      }
      
      .payment-status p {
        margin: 0 0 8px 0;
        color: #ccc;
      }
      
      .payment-status code {
        background: #333;
        padding: 2px 6px;
        border-radius: 4px;
        font-family: monospace;
        color: #60a5fa;
      }
      
      .status-text {
        color: #fbbf24 !important;
        font-weight: bold;
      }
      
      .payment-actions {
        display: flex;
        gap: 12px;
        justify-content: center;
      }
      
      .btn-primary, .btn-secondary {
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
      }
      
      .btn-primary {
        background: #10b981;
        color: white;
      }
      
      .btn-primary:hover {
        background: #059669;
      }
      
      .btn-secondary {
        background: #6b7280;
        color: white;
      }
      
      .btn-secondary:hover {
        background: #4b5563;
      }
    `;
    
    document.head.appendChild(style);
  }
  
  document.body.appendChild(modal);
  
  // Add event listeners for buttons
  const copyAddressBtn = modal.querySelector('.copy-address-btn');
  const copyAmountBtn = modal.querySelector('.copy-amount-btn');
  const checkStatusBtn = modal.querySelector('.check-status-btn');
  const closeBtn = modal.querySelector('.close-modal-btn');
  
  copyAddressBtn.addEventListener('click', () => {
    const address = copyAddressBtn.getAttribute('data-address');
    copyPaymentAddress(address);
  });
  
  copyAmountBtn.addEventListener('click', () => {
    const amount = copyAmountBtn.getAttribute('data-amount');
    copyPaymentAmount(amount);
  });
  
  checkStatusBtn.addEventListener('click', () => {
    const orderId = checkStatusBtn.getAttribute('data-order-id');
    checkPaymentStatus(orderId);
  });
  
  closeBtn.addEventListener('click', closePaymentModal);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closePaymentModal();
    }
  });
  
  // Close modal when clicking X
  modal.querySelector('.close-modal').addEventListener('click', closePaymentModal);
}

function copyPaymentAddress(address) {
  navigator.clipboard.writeText(address).then(() => {
    alert('✅ Payment address copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    alert('❌ Failed to copy to clipboard');
  });
}

function copyPaymentAmount(amount) {
  navigator.clipboard.writeText(amount).then(() => {
    alert('✅ Payment amount copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    alert('❌ Failed to copy to clipboard');
  });
}

function closePaymentModal() {
  const modal = document.querySelector('.payment-modal');
  if (modal) {
    modal.remove();
  }
}

function checkPaymentStatus(orderId) {
  console.log('🔍 Checking payment status for order:', orderId);
  ipcRenderer.send('check-crypto-payment', orderId);
}

// Listen for payment status updates
ipcRenderer.on('crypto-payment-status', (_, statusData) => {
  console.log('📊 Payment status update:', statusData);
  
  const statusText = document.querySelector('.status-text');
  if (statusText) {
    if (statusData.status === 'completed') {
      statusText.textContent = '✅ Payment confirmed! Subscription activated.';
      statusText.style.color = '#10b981';
      
      // Close modal after 3 seconds
      setTimeout(() => {
        closePaymentModal();
        alert('🎉 Subscription activated successfully!');
      }, 3000);
    } else if (statusData.status === 'confirming') {
      statusText.textContent = '⏳ Payment received, confirming...';
      statusText.style.color = '#fbbf24';
    } else {
      statusText.textContent = 'Waiting for payment...';
      statusText.style.color = '#fbbf24';
    }
  }
});