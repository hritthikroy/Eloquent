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
    document.getElementById('aiMode').value = config.aiMode;
    updateAIModeDescription(config.aiMode);
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
  document.getElementById('aiModeDescription').innerHTML = aiModeDescriptions[mode] || aiModeDescriptions.smart;
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


// Google Sign-in handler
function handleGoogleSignIn() {
  // Explicitly initiate Google sign-in
  console.log('🔄 User clicked Google Sign In button');
  try {
    ipcRenderer.send('initiate-google-signin');
  } catch (error) {
    console.error('Error initiating Google sign-in:', error);
  }
}

// Plan management functions
function subscribeToPlan(planType) {
  // Send plan subscription request to main process
  ipcRenderer.send('subscribe-to-plan', planType);
}

function managePlan() {
  // Open plan management interface
  ipcRenderer.send('manage-subscription');
}

// Listen for authentication status updates
ipcRenderer.on('auth-status', (_, authData) => {
  if (authData.isAuthenticated && authData.user) {
    // User is signed in, update UI
    updateAuthUI(authData.user);
  } else {
    // User is not signed in, initiate Google OAuth
    ipcRenderer.send('initiate-google-signin');
  }
});

// INSTANT FRONTEND UPDATE: Listen for real-time auth updates
ipcRenderer.on('auth-updated', (_, authData) => {
  console.log('🔄 Instant auth update received:', authData);
  if (authData.isAuthenticated && authData.user) {
    // Update UI immediately with new auth data
    updateAuthUI(authData.user);
    if (authData.subscription) {
      updatePlanUI(authData.subscription);
    }
    // Show success message
    showNotification('✅ Signed In Successfully', `Welcome, ${authData.user.email}!`);
  } else if (!authData.isAuthenticated) {
    // Handle sign out - reset UI immediately
    const googleSignInItem = document.querySelector('.sidebar-item[data-action="user-menu"]');
    if (googleSignInItem) {
      googleSignInItem.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google Sign In
      `;
      googleSignInItem.setAttribute('data-action', 'google-signin');
    }
    showNotification('👋 Signed Out', 'You have been signed out successfully');
  }
});

// Listen for subscription status updates
ipcRenderer.on('subscription-status', (_, subscriptionData) => {
  updatePlanUI(subscriptionData);
});

// Update authentication UI
function updateAuthUI(user) {
  // Wait for DOM to be ready if needed
  const updateUI = () => {
    // Try multiple selectors to find the Google Sign In button
    let googleSignInItem = document.querySelector('.sidebar-item[data-action="google-signin"]');
    
    // If not found, try finding by text content
    if (!googleSignInItem) {
      const sidebarItems = document.querySelectorAll('.sidebar-item');
      for (let item of sidebarItems) {
        if (item.textContent.includes('Google Sign In')) {
          googleSignInItem = item;
          break;
        }
      }
    }
    
    if (googleSignInItem && user) {
      googleSignInItem.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
        ${user.name || user.email}
      `;
      googleSignInItem.setAttribute('data-action', 'user-menu');
    } else if (!googleSignInItem) {
      // Try again in a moment if DOM might not be ready
      setTimeout(updateUI, 100);
    }
  };
  
  // Try immediately and also after a short delay
  updateUI();
}

// Update plan UI
function updatePlanUI(subscription) {
  const currentPlanName = document.getElementById('currentPlanName');
  const currentPlanDetails = document.getElementById('currentPlanDetails');
  
  if (currentPlanName && subscription) {
    currentPlanName.textContent = subscription.planName || 'Free Plan';
    if (currentPlanDetails) {
      currentPlanDetails.textContent = subscription.status === 'active' 
        ? `Active until ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
        : 'Limited features';
    }
  }
}

// Show user menu for signed-in users
function showUserMenu() {
  const menu = confirm('Account Options:\n\nOK - Sign Out\nCancel - Stay Signed In');
  if (menu) {
    ipcRenderer.send('sign-out');
    // Reset the Google Sign In button
    const googleSignInItem = document.querySelector('.sidebar-item[data-action="user-menu"]');
    if (googleSignInItem) {
      googleSignInItem.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google Sign In
      `;
      googleSignInItem.setAttribute('data-action', 'google-signin');
    }
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

// Check authentication status on page load - multiple strategies for reliability
// Strategy 1: Immediate check
ipcRenderer.send('check-auth-status');
ipcRenderer.send('check-subscription-status');

// Strategy 2: DOM ready check
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Dashboard DOM loaded');
  
  // Test navigation buttons
  console.log('Testing navigation buttons...');
  const navButtons = document.querySelectorAll('.sidebar-item');
  console.log('Found', navButtons.length, 'navigation buttons');
  
  // Add click event listeners for navigation
  navButtons.forEach((button, index) => {
    console.log(`Button ${index}:`, button.textContent.trim());
    
    button.addEventListener('click', function(e) {
      console.log('Button clicked:', this.textContent.trim());
      
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
  
  ipcRenderer.send('check-auth-status');
  loadHistory();
});

// Strategy 3: Backup check after DOM is fully ready
setTimeout(() => {
  ipcRenderer.send('check-auth-status');
  ipcRenderer.send('check-subscription-status');
}, 500);

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
