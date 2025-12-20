const { ipcRenderer } = require('electron');

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


// History Management
let historyData = [];

function loadHistory() {
  ipcRenderer.send('get-history');
}

// PERFORMANCE BOOST: Optimized history rendering with virtual scrolling concepts
function displayHistory(history = historyData, searchTerm = '') {
  const historyList = document.getElementById('historyList');
  const emptyHistory = document.getElementById('emptyHistory');

  console.log('Displaying history:', history.length, 'items, search:', searchTerm);

  // PERFORMANCE BOOST: Use DocumentFragment for batch DOM updates
  const fragment = document.createDocumentFragment();

  // Filter by search term
  let filtered = history;
  if (searchTerm) {
    // PERFORMANCE BOOST: Use more efficient filtering
    const lowerSearchTerm = searchTerm.toLowerCase();
    filtered = history.filter(item =>
      item.text.toLowerCase().includes(lowerSearchTerm) ||
      (item.originalText && item.originalText.toLowerCase().includes(lowerSearchTerm))
    );
  }

  console.log('Filtered history:', filtered.length, 'items');

  if (filtered.length === 0) {
    historyList.innerHTML = '';
    emptyHistory.style.display = 'block';
    return;
  }

  emptyHistory.style.display = 'none';
  
  // PERFORMANCE BOOST: Limit rendering to first 50 items for speed
  const itemsToRender = filtered.slice(0, 50);
  
  historyList.innerHTML = itemsToRender.map(item => {
    const date = new Date(item.timestamp);
    const timeAgo = getTimeAgo(date);
    const fullDate = date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const isAI = item.mode === 'rewrite';
    const modeBadge = isAI
      ? '<span class="mode-badge ai-badge">✨ AI Enhanced</span>'
      : '<span class="mode-badge standard-badge">🎤 Standard</span>';

    return `
      <div class="history-item" data-item-id="${item.id}">
        <div class="history-header">
          <div class="history-meta">
            ${modeBadge}
            <span class="history-time" title="${fullDate}">${timeAgo}</span>
            ${item.duration ? `<span class="history-duration">${item.duration}s</span>` : ''}
          </div>
          <div class="history-actions">
            <button class="history-btn copy-btn" data-item-id="${item.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy
            </button>
            <button class="history-btn delete-btn" data-item-id="${item.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Delete
            </button>
          </div>
        </div>
        <div class="history-text">${escapeHtml(item.text)}</div>
        ${isAI && item.originalText && item.originalText !== item.text ? `
          <details class="original-text-details">
            <summary class="original-text-summary">📝 Show original transcription</summary>
            <div class="original-text-content">${escapeHtml(item.originalText)}</div>
          </details>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Add event listeners for history buttons
  setTimeout(() => {
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const itemId = this.getAttribute('data-item-id');
        copyToClipboard(itemId);
      });
      
      // Add hover effects
      btn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(59, 130, 246, 0.25)';
        this.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        this.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(59, 130, 246, 0.15)';
        this.style.borderColor = 'rgba(59, 130, 246, 0.3)';
        this.style.transform = 'scale(1)';
      });
    });
    
    // Delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const itemId = this.getAttribute('data-item-id');
        deleteHistoryItem(itemId);
      });
      
      // Add hover effects
      btn.addEventListener('mouseenter', function() {
        this.style.background = 'rgba(255, 59, 48, 0.25)';
        this.style.borderColor = 'rgba(255, 59, 48, 0.5)';
        this.style.transform = 'scale(1.05)';
      });
      btn.addEventListener('mouseleave', function() {
        this.style.background = 'rgba(255, 59, 48, 0.15)';
        this.style.borderColor = 'rgba(255, 59, 48, 0.3)';
        this.style.transform = 'scale(1)';
      });
    });
    
    // History card hover effects
    document.querySelectorAll('.history-card').forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-2px)';
        this.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.25)';
      });
      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.1)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.15)';
      });
    });
    
    // Original text summary hover effects
    document.querySelectorAll('.original-text-summary').forEach(summary => {
      summary.addEventListener('mouseenter', function() {
        this.style.color = '#333';
      });
      summary.addEventListener('mouseleave', function() {
        this.style.color = '#666';
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function copyToClipboard(id) {
  const item = historyData.find(h => h.id == id);
  if (item) {
    navigator.clipboard.writeText(item.text).then(() => {
      // Find the specific button by data attribute
      const copyBtn = document.querySelector(`button[data-item-id="${id}"]`);
      if (copyBtn) {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '✅ Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 1500);
      }
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy text to clipboard');
    });
  }
}

function deleteHistoryItem(id) {
  if (confirm('Delete this transcription?')) {
    ipcRenderer.send('delete-history-item', id);
  }
}

function clearAllHistory() {
  if (confirm('Clear all history? This cannot be undone.')) {
    ipcRenderer.send('clear-history');
  }
}

// Search functionality
const searchInput = document.getElementById('historySearch');
if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    displayHistory(historyData, e.target.value);
  });
}

// Listen for history updates
ipcRenderer.on('history-data', (_, history) => {
  console.log('Received history data:', history ? history.length : 0, 'items');
  historyData = history || []; // Ensure history is always an array
  displayHistory(historyData);

  // Update the most recent transcription display
  updateLastTranscriptionDisplay(historyData);
});

// Also listen for history-updated event for real-time updates
ipcRenderer.on('history-updated', (_, history) => {
  console.log('Received history-updated event:', history ? history.length : 0, 'items');
  historyData = history || []; // Ensure history is always an array
  displayHistory(historyData);

  // Update the most recent transcription display
  updateLastTranscriptionDisplay(historyData);
});

// Update the most recent transcription display
function updateLastTranscriptionDisplay(history) {
  if (history && history.length > 0) {
    const latest = history[0]; // Most recent is at index 0
    const textElement = document.getElementById('lastTranscriptionText');
    const timeElement = document.getElementById('lastTranscriptionTime');
    const copyButton = document.getElementById('copyLastTranscription');

    if (textElement && latest.text) {
      textElement.innerHTML = escapeHtml(latest.text);
      // Store the raw text for copying
      textElement.setAttribute('data-raw-text', latest.text);
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
      alert('Failed to copy text to clipboard');
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
  
  // Prevent double-clicks
  const signInBtn = document.querySelector('.sidebar-item[data-action="google-signin"]');
  if (signInBtn) {
    signInBtn.style.pointerEvents = 'none';
    signInBtn.style.opacity = '0.6';
    signInBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="currentColor" class="spin-animation">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none" stroke-dasharray="31.4" stroke-dashoffset="10"/>
      </svg>
      Signing in...
    `;
    
    // Re-enable after 5 seconds as fallback
    setTimeout(() => {
      if (signInBtn && !currentAuthState.isAuthenticated) {
        signInBtn.style.pointerEvents = 'auto';
        signInBtn.style.opacity = '1';
        resetSignInButton(signInBtn);
      }
    }, 5000);
  }
  
  try {
    ipcRenderer.send('initiate-google-signin');
  } catch (error) {
    console.error('Error initiating Google sign-in:', error);
    if (signInBtn) {
      signInBtn.style.pointerEvents = 'auto';
      signInBtn.style.opacity = '1';
      resetSignInButton(signInBtn);
    }
    showNotification('❌ Sign In Failed', 'Please try again');
  }
}

function resetSignInButton(btn) {
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
    Google Sign In
  `;
  btn.setAttribute('data-action', 'google-signin');
}

// Plan management functions
function subscribeToPlan(planType) {
  ipcRenderer.send('subscribe-to-plan', planType);
}

function managePlan() {
  ipcRenderer.send('manage-subscription');
}

// Listen for authentication status updates (initial load)
ipcRenderer.on('auth-status', (_, authData) => {
  console.log('📊 Auth status received:', authData?.isAuthenticated ? 'authenticated' : 'not authenticated');
  
  if (authData.isAuthenticated && authData.user) {
    updateAuthState(authData);
  }
  // Don't auto-initiate sign-in - let user click the button
});

// INSTANT FRONTEND UPDATE: Listen for real-time auth updates with debouncing
ipcRenderer.on('auth-updated', (_, authData) => {
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
    
    if (authData.isAuthenticated && authData.user) {
      // Only show notification if state actually changed
      const wasAuthenticated = currentAuthState.isAuthenticated;
      updateAuthState(authData);
      
      if (!wasAuthenticated) {
        showNotification('✅ Signed In', `Welcome, ${authData.user.name || authData.user.email}!`);
      }
    } else if (!authData.isAuthenticated && currentAuthState.isAuthenticated) {
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
  
  // Check admin access when auth state changes
  setTimeout(checkAdminAccess, 100);
}

// Listen for subscription status updates
ipcRenderer.on('subscription-status', (_, subscriptionData) => {
  updatePlanUI(subscriptionData);
});

// Reset UI to signed-out state
function resetToSignedOutUI() {
  const userMenuItem = document.querySelector('.sidebar-item[data-action="user-menu"]');
  if (userMenuItem) {
    resetSignInButton(userMenuItem);
    userMenuItem.setAttribute('data-action', 'google-signin');
  }
  
  // Hide user menu if open
  hideUserMenu();
}

// Update authentication UI
function updateAuthUI(user) {
  if (!user) return;
  
  const updateUI = () => {
    // Find the sign-in button by either action type
    let authButton = document.querySelector('.sidebar-item[data-action="google-signin"]') ||
                     document.querySelector('.sidebar-item[data-action="user-menu"]');
    
    // Fallback: find by text content
    if (!authButton) {
      const sidebarItems = document.querySelectorAll('.sidebar-item');
      for (let item of sidebarItems) {
        if (item.textContent.includes('Google Sign In') || item.textContent.includes(user.name) || item.textContent.includes(user.email)) {
          authButton = item;
          break;
        }
      }
    }
    
    if (authButton) {
      const displayName = user.name || user.email.split('@')[0];
      const isAdmin = user.role === 'admin' || user.email === 'hritthikin@gmail.com';
      
      authButton.innerHTML = `
        <div class="user-avatar" style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; color: white;">
          ${displayName.charAt(0).toUpperCase()}
        </div>
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${displayName}</span>
        ${isAdmin ? '<span style="font-size: 10px; background: rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; color: #c4b5fd;">Admin</span>' : ''}
        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 16px; height: 16px; opacity: 0.6;">
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      `;
      authButton.setAttribute('data-action', 'user-menu');
      authButton.style.pointerEvents = 'auto';
      authButton.style.opacity = '1';
    }
  };
  
  // Try immediately and with a small delay for DOM readiness
  updateUI();
  setTimeout(updateUI, 100);
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
  // If menu already visible, hide it
  if (userMenuVisible) {
    hideUserMenu();
    return;
  }
  
  const user = currentAuthState.user;
  if (!user) {
    console.log('No user found in currentAuthState');
    return;
  }
  
  // Remove any existing menu
  hideUserMenu();
  
  const isAdmin = user.role === 'admin' || user.email === 'hritthikin@gmail.com';
  
  // Create dropdown menu
  const menu = document.createElement('div');
  menu.id = 'user-dropdown-menu';
  menu.style.cssText = `
    position: fixed;
    left: 290px;
    top: 50%;
    transform: translateY(-50%);
    background: linear-gradient(145deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 16px;
    padding: 8px;
    min-width: 220px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    z-index: 10001;
  `;
  
  // Create header
  const header = document.createElement('div');
  header.style.cssText = 'padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); margin-bottom: 8px;';
  header.innerHTML = `
    <div style="font-size: 15px; font-weight: 600; color: white; margin-bottom: 4px;">${user.name || 'User'}</div>
    <div style="font-size: 13px; color: rgba(255, 255, 255, 0.6); overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
  `;
  menu.appendChild(header);
  
  // Admin Panel button (if admin)
  if (isAdmin) {
    const adminItem = createMenuItem('Admin Panel', 'M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z', '#c4b5fd');
    adminItem.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      console.log('Admin Panel clicked');
      hideUserMenu();
      openAdminPanel();
    });
    menu.appendChild(adminItem);
    
    const divider1 = document.createElement('div');
    divider1.style.cssText = 'height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;';
    menu.appendChild(divider1);
  }
  
  // Settings button
  const settingsItem = createMenuItem('Settings', 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z');
  settingsItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Settings clicked');
    hideUserMenu();
    showSection('settings');
  });
  menu.appendChild(settingsItem);
  
  // Subscription button
  const subscriptionItem = createMenuItem('Subscription', 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z');
  subscriptionItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Subscription clicked');
    hideUserMenu();
    showSection('plans');
  });
  menu.appendChild(subscriptionItem);
  
  // Divider
  const divider2 = document.createElement('div');
  divider2.style.cssText = 'height: 1px; background: rgba(255, 255, 255, 0.1); margin: 8px 0;';
  menu.appendChild(divider2);
  
  // Sign Out button
  const signoutItem = createMenuItem('Sign Out', 'M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z', '#fca5a5');
  signoutItem.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('Sign Out clicked');
    handleSignOut();
  });
  menu.appendChild(signoutItem);
  
  document.body.appendChild(menu);
  userMenuVisible = true;
  
  // Close menu when clicking outside (with delay to prevent immediate close)
  setTimeout(() => {
    document.addEventListener('click', handleOutsideClick);
  }, 150);
}

function createMenuItem(text, iconPath, color = 'rgba(255, 255, 255, 0.9)') {
  const item = document.createElement('div');
  item.style.cssText = `
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    color: ${color};
    transition: all 0.15s ease;
  `;
  
  item.innerHTML = `
    <svg viewBox="0 0 24 24" fill="currentColor" style="width: 18px; height: 18px; opacity: 0.7;">
      <path d="${iconPath}"/>
    </svg>
    ${text}
  `;
  
  item.addEventListener('mouseenter', function() {
    this.style.background = color === '#fca5a5' ? 'rgba(239, 68, 68, 0.15)' : 
                            color === '#c4b5fd' ? 'rgba(168, 85, 247, 0.15)' : 
                            'rgba(255, 255, 255, 0.1)';
  });
  
  item.addEventListener('mouseleave', function() {
    this.style.background = 'transparent';
  });
  
  return item;
}

function hideUserMenu() {
  const menu = document.getElementById('user-dropdown-menu');
  if (menu) {
    menu.remove();
  }
  userMenuVisible = false;
  document.removeEventListener('click', handleOutsideClick);
}

function handleOutsideClick(e) {
  const menu = document.getElementById('user-dropdown-menu');
  const userButton = document.querySelector('.sidebar-item[data-action="user-menu"]');
  
  if (menu && !menu.contains(e.target) && userButton && !userButton.contains(e.target)) {
    hideUserMenu();
  }
}

function handleSignOut() {
  hideUserMenu();
  
  // Show confirmation
  const confirmed = confirm('Are you sure you want to sign out?');
  if (confirmed) {
    ipcRenderer.send('sign-out');
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
ipcRenderer.send('check-auth-status');
ipcRenderer.send('check-subscription-status');

// Strategy 2: DOM ready check
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Dashboard DOM loaded');
  
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
  console.log('🔧 Opening admin panel...');
  ipcRenderer.send('open-admin-panel');
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
