const { ipcRenderer } = require('electron');

// State management
let allUsers = [];
let selectedUsers = new Set();
let refreshInterval = null;
let autoRefreshEnabled = true;

// Load admin data on startup
document.addEventListener('DOMContentLoaded', async () => {
  // Verify admin access on page load
  try {
    const hasAccess = await ipcRenderer.invoke('admin-verify-access');
    if (!hasAccess) {
      document.body.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; text-align: center;">
          <h1 style="color: #ef4444; margin-bottom: 20px;">🚫 Access Denied</h1>
          <p style="color: #ffffff; margin-bottom: 30px;">You do not have permission to access the admin panel.</p>
          <button id="closeWindow1" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Close Window</button>
        </div>
      `;
      document.getElementById('closeWindow1').addEventListener('click', () => window.close());
      return;
    }
  } catch (error) {
    console.error('Failed to verify admin access:', error);
    document.body.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; text-align: center;">
        <h1 style="color: #ef4444; margin-bottom: 20px;">❌ Error</h1>
        <p style="color: #ffffff; margin-bottom: 30px;">Failed to verify admin access: ${error.message}</p>
        <button id="closeWindow2" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; cursor: pointer;">Close Window</button>
      </div>
    `;
    document.getElementById('closeWindow2').addEventListener('click', () => window.close());
    return;
  }

  // Initialize admin panel
  try {
    await loadAdminConfig();
    await loadAdminData();
    await loadUsers();
    await loadApiRequests();
    
    // Add event listeners for static elements
    addStaticEventListeners();
    
    // Start auto-refresh with better control
    startAutoRefresh();
    
    console.log('✅ Admin panel initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize admin panel:', error);
    showAlert('Failed to initialize admin panel: ' + error.message, 'error');
  }
});

// API Configuration Form
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('apiConfigForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveBtn = document.getElementById('saveConfigText');
    const loading = document.getElementById('saveConfigLoading');
    
    saveBtn.classList.add('hidden');
    loading.classList.remove('hidden');
    
    const config = {
      masterApiKey: document.getElementById('masterApiKey').value,
      dailyLimit: parseInt(document.getElementById('dailyLimit').value),
      rateLimitPerUser: parseInt(document.getElementById('rateLimitPerUser').value)
    };
    
    try {
      await ipcRenderer.invoke('admin-save-config', config);
      showAlert('Configuration saved successfully!', 'success');
      
      // Reload admin data to reflect changes
      loadAdminData();
    } catch (error) {
      showAlert('Failed to save configuration: ' + error.message, 'error');
    } finally {
      saveBtn.classList.remove('hidden');
      loading.classList.add('hidden');
    }
  });
});

// Load admin configuration into form
async function loadAdminConfig() {
  try {
    const config = await ipcRenderer.invoke('admin-get-config');
    
    // Safely set form values with null checks
    const masterApiKeyEl = document.getElementById('masterApiKey');
    const dailyLimitEl = document.getElementById('dailyLimit');
    const rateLimitPerUserEl = document.getElementById('rateLimitPerUser');
    
    if (masterApiKeyEl) masterApiKeyEl.value = config.masterApiKey || '';
    if (dailyLimitEl) dailyLimitEl.value = config.dailyLimit || 1000;
    if (rateLimitPerUserEl) rateLimitPerUserEl.value = config.rateLimitPerUser || 100;
    
    console.log('✅ Admin configuration loaded into form');
  } catch (error) {
    console.error('Failed to load admin configuration:', error);
    showAlert('Failed to load configuration: ' + error.message, 'error');
  }
}

// Get access token from Electron main process
async function getAccessToken() {
  try {
    const token = await ipcRenderer.invoke('get-auth-token');
    if (!token) {
      // Development mode fallback
      console.log('No token received, using development mode fallback');
      return 'dev-token';
    }
    return token;
  } catch (error) {
    console.error('Failed to get access token:', error);
    
    // Always fallback to development mode for admin panel
    console.log('Auth error occurred, falling back to development mode');
    return 'dev-token';
  }
}

// Load admin dashboard data
async function loadAdminData() {
  try {
    console.log('📊 Loading admin data...');
    const token = await getAccessToken();
    console.log('🔑 Got access token:', token ? 'Available' : 'None');
    
    // Check if backend is running first
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
      console.log('❌ Backend not running');
      showAlert('Backend is not running. Please start the backend server first.', 'error');
      showBackendInstructions();
      return;
    }
    
    console.log('📊 Fetching admin stats...');
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'GET',
      endpoint: '/api/admin/stats'
    });
    
    console.log('📊 Admin stats result:', result);
    
    if (!result.success) {
      if (result.status === 404) {
        // Stats endpoint not found
        console.log('Stats endpoint not found');
        showAlert('Admin stats endpoint not available. Please check backend configuration.', 'error');
        return;
      }
      
      if (result.status === 403) {
        showAlert('Access denied: Admin privileges required. Please sign in with an admin account.', 'error');
        return;
      }
      
      throw new Error(`HTTP ${result.status}: ${result.error}`);
    }
    
    const stats = result.data;
    updateStatsDisplay(stats);
    
    console.log('✅ Admin stats loaded successfully');
  } catch (error) {
    console.error('Failed to load admin data:', error);
    
    // Provide helpful error messages
    let errorMessage = 'Failed to load admin statistics';
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - backend may not be running';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Cannot connect to backend - ensure it\'s running on port 3000';
    } else if (error.message.includes('Access denied')) {
      errorMessage = 'Access denied: Please sign in with an admin account (hritthikin@gmail.com)';
    } else {
      errorMessage += ': ' + error.message;
    }
    
    showAlert(errorMessage, 'error');
  }
}

// Helper function to update stats display
function updateStatsDisplay(stats) {
  const totalRequestsEl = document.getElementById('totalRequests');
  const activeUsersEl = document.getElementById('activeUsers');
  const apiUsageEl = document.getElementById('apiUsage');
  const successRateEl = document.getElementById('successRate');
  
  if (totalRequestsEl) totalRequestsEl.textContent = stats.total_requests || 0;
  if (activeUsersEl) activeUsersEl.textContent = stats.active_users_24h || 0;
  if (apiUsageEl) apiUsageEl.textContent = Math.round(stats.api_usage_percent || 0) + '%';
  if (successRateEl) successRateEl.textContent = Math.round(stats.success_rate || 0) + '%';
}

// Check if backend is running
async function checkBackendHealth() {
  try {
    console.log('🔍 Checking backend health...');
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'GET',
      endpoint: '/health'
    });
    
    console.log('🔍 Health check result:', JSON.stringify(result, null, 2));
    console.log('🔍 Health check details - success:', result.success, 'status:', result.status, 'data:', result.data);
    
    // Accept any successful response (2xx status codes)
    if (result.success || (result.status >= 200 && result.status < 300)) {
      console.log('✅ Backend is healthy');
      return true;
    }
    
    // Also check if we got valid health data even if success flag is wrong
    if (result.data && result.data.status === 'ok') {
      console.log('✅ Backend is healthy (data check)');
      return true;
    }
    
    // 429 means backend IS running, just rate limited - treat as healthy
    if (result.status === 429) {
      console.log('✅ Backend is running (rate limited, but responsive)');
      return true;
    }
    
    console.log('❌ Backend health check failed:', result);
    return false;
  } catch (error) {
    console.error('❌ Backend health check error:', error);
    return false;
  }
}

// Show backend startup instructions
function showBackendInstructions() {
  const alertContainer = document.getElementById('alertContainer');
  const instructions = document.createElement('div');
  instructions.className = 'alert alert-info';
  instructions.innerHTML = `
    <strong>🔧 Backend Server Not Running</strong><br><br>
    <strong>Quick Start Options:</strong><br>
    1. <strong>Easy:</strong> Double-click <code>start-backend.sh</code> (Mac/Linux) or <code>start-backend.bat</code> (Windows)<br>
    2. <strong>Terminal:</strong> Run <code>./start-backend.sh</code> in EloquentElectron directory<br>
    3. <strong>Manual:</strong> <code>cd backend-go && go run main.go</code><br>
    4. <strong>Full Dev:</strong> Run <code>./dev.sh</code> to start both backend and frontend<br><br>
    <strong>Note:</strong> The backend runs on port 3000. Make sure no other service is using this port.<br>
    <button id="retryConnection" class="btn btn-primary btn-small" style="margin-top: 15px;">🔄 Retry Connection</button>
    <button id="showTroubleshooting" class="btn btn-secondary btn-small" style="margin-top: 15px; margin-left: 10px;">🛠️ Troubleshooting</button>
  `;
  
  alertContainer.innerHTML = '';
  alertContainer.appendChild(instructions);
  
  document.getElementById('retryConnection').addEventListener('click', () => {
    loadAdminData();
    loadUsers();
  });
  
  document.getElementById('showTroubleshooting').addEventListener('click', showTroubleshooting);
}

// Show troubleshooting guide
function showTroubleshooting() {
  const alertContainer = document.getElementById('alertContainer');
  const troubleshooting = document.createElement('div');
  troubleshooting.className = 'alert alert-info';
  troubleshooting.innerHTML = `
    <strong>🛠️ Troubleshooting Backend Connection</strong><br><br>
    <strong>Common Issues:</strong><br>
    1. <strong>Port 3000 in use:</strong> Kill other processes using port 3000<br>
    2. <strong>Go not installed:</strong> Install Go from <a href="https://golang.org/dl/" target="_blank" style="color: #60a5fa;">golang.org</a><br>
    3. <strong>Missing .env:</strong> Copy .env.example to .env in backend-go directory<br>
    4. <strong>Permission denied:</strong> Run <code>chmod +x start-backend.sh</code><br><br>
    <strong>Check if backend is running:</strong><br>
    Open <a href="http://localhost:3000/health" target="_blank" style="color: #60a5fa;">http://localhost:3000/health</a> in browser<br>
    Should show: <code>{"status":"ok"}</code><br><br>
    <button id="backToInstructions" class="btn btn-primary btn-small" style="margin-top: 15px;">← Back to Instructions</button>
  `;
  
  alertContainer.innerHTML = '';
  alertContainer.appendChild(troubleshooting);
  
  document.getElementById('backToInstructions').addEventListener('click', showBackendInstructions);
}

// Load users
async function loadUsers() {
  try {
    const token = await getAccessToken();
    
    // Check if backend is running first
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
      showAlert('Backend is not running. Cannot load users.', 'error');
      allUsers = [];
      renderUsers(allUsers);
      return;
    }
    
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'GET',
      endpoint: '/api/admin/users'
    });
    
    clearTimeout(timeoutId);
    
    if (!result.success) {
      if (result.status === 401) {
        console.log('401 error - authentication required');
        showAlert('Authentication failed. Make sure you are signed in with an admin account.', 'error');
        allUsers = [];
        renderUsers(allUsers);
        return;
      }
      
      throw new Error(`HTTP ${result.status}: ${result.error}`);
    }
    
    const data = result.data;
    allUsers = Array.isArray(data.users) ? data.users : [];
    renderUsers(allUsers);
    
    console.log(`✅ Loaded ${allUsers.length} users successfully`);
  } catch (error) {
    console.error('Failed to load users:', error);
    
    // Provide helpful error messages and fallback
    let errorMessage = 'Failed to load users';
    if (error.name === 'AbortError') {
      errorMessage = 'Request timeout - backend may not be running';
    } else if (error.message.includes('Failed to fetch')) {
      errorMessage = 'Cannot connect to backend - ensure it\'s running on port 3000';
    } else {
      errorMessage += ': ' + error.message;
    }
    
    showAlert(errorMessage, 'error');
    
    // Show empty state when backend is not available
    allUsers = [];
    renderUsers(allUsers);
  }
}

// No mock users - admin panel requires real backend connection
function generateMockUsers() {
  return [];
}

// Render users table
function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const userId = String(user.id);
    const usagePercent = user.plan === 'unlimited' || user.plan === 'enterprise' ? 0 : 
      Math.min(100, (user.usage_current_month / getUsageLimit(user.plan)) * 100);
    const usageClass = usagePercent > 90 ? 'danger' : usagePercent > 75 ? 'warning' : '';
    
    return `
      <tr>
        <td class="checkbox-cell">
          <input type="checkbox" class="user-checkbox" data-user-id="${userId}" 
            ${selectedUsers.has(userId) ? 'checked' : ''}>
        </td>
        <td>
          <div class="user-info-cell">
            <div class="user-avatar">${getInitials(user.email)}</div>
            <div class="user-info-text">
              <div class="user-name">${user.name || 'Unknown'}</div>
              <div class="user-email">${user.email}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="plan-badge plan-${user.plan}">${user.plan}</span>
        </td>
        <td>
          <span class="role-badge role-${user.role}">${user.role}</span>
        </td>
        <td>
          <div>
            <span style="color: white; font-size: 14px;">${user.usage_current_month || 0} / ${getUsageLimit(user.plan)} min</span>
            <div class="usage-bar">
              <div class="usage-fill ${usageClass}" style="width: ${usagePercent}%"></div>
            </div>
          </div>
        </td>
        <td>
          <span class="status-badge status-${user.subscription_status === 'active' ? 'success' : user.subscription_status === 'none' ? 'pending' : 'error'}">
            ${user.subscription_status}
          </span>
        </td>
        <td style="color: rgba(255, 255, 255, 0.7); font-size: 13px;">
          ${user.last_login ? formatDate(user.last_login) : 'Never'}
        </td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary btn-small user-view-btn" data-user-id="${userId}">View</button>
            <button class="btn btn-success btn-small user-edit-btn" data-user-id="${userId}">Edit</button>
            <button class="btn btn-danger btn-small user-delete-btn" data-user-id="${userId}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Add event listeners for user action buttons
  addUserActionListeners();
}

// Helper functions
function getInitials(email) {
  return email.substring(0, 2).toUpperCase();
}

function getUsageLimit(plan) {
  const limits = {
    'free': 60,
    'starter': 180,
    'pro': 600,
    'unlimited': '∞',
    'enterprise': '∞'
  };
  return limits[plan] || 60;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Selection management
function toggleUserSelection(userId) {
  // Ensure userId is a string for consistent comparison
  const userIdStr = String(userId);
  if (selectedUsers.has(userIdStr)) {
    selectedUsers.delete(userIdStr);
  } else {
    selectedUsers.add(userIdStr);
  }
  updateBulkActions();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.user-checkbox');
  
  if (selectAll.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedUsers.add(String(cb.dataset.userId));
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
      selectedUsers.delete(String(cb.dataset.userId));
    });
  }
  
  updateBulkActions();
}

function clearSelection() {
  selectedUsers.clear();
  document.getElementById('selectAll').checked = false;
  document.querySelectorAll('.user-checkbox').forEach(cb => cb.checked = false);
  updateBulkActions();
}

function updateBulkActions() {
  const bulkActions = document.getElementById('bulkActions');
  const selectedCount = document.getElementById('selectedCount');
  
  if (selectedUsers.size > 0) {
    bulkActions.classList.remove('hidden');
    selectedCount.textContent = `${selectedUsers.size} user${selectedUsers.size > 1 ? 's' : ''} selected`;
  } else {
    bulkActions.classList.add('hidden');
  }
}

// Load API requests
async function loadApiRequests() {
  try {
    console.log('📊 Loading API requests...');
    
    // Get API requests from main process
    const requests = await ipcRenderer.invoke('admin-get-api-requests');
    
    if (!requests || !Array.isArray(requests)) {
      console.warn('No API requests data received');
      renderApiRequests([]);
      return;
    }
    
    console.log(`✅ Loaded ${requests.length} API requests`);
    renderApiRequests(requests);
  } catch (error) {
    console.error('Failed to load API requests:', error);
    showAlert('Failed to load API requests: ' + error.message, 'error');
    renderApiRequests([]);
  }
}

// Render API requests table
function renderApiRequests(requests) {
  const tbody = document.getElementById('requestsTableBody');
  
  if (!tbody) {
    console.warn('requestsTableBody element not found');
    return;
  }
  
  if (requests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">No API requests yet</td></tr>';
    return;
  }

  tbody.innerHTML = requests.map(req => {
    const statusClass = req.status === 'success' ? 'success' : 'error';
    const typeDisplay = req.type === 'whisper' ? '🎤 Whisper' : 
                       req.type === 'llama-rewrite' ? '✨ AI Rewrite' : 
                       req.type === 'llama-grammar' ? '📝 Grammar' : req.type;
    
    return `
      <tr>
        <td style="color: rgba(255, 255, 255, 0.9);">${formatTimestamp(req.timestamp)}</td>
        <td><span style="font-weight: 600; color: white;">${typeDisplay}</span></td>
        <td><span class="status-badge status-${statusClass}">${req.status}</span></td>
        <td style="color: rgba(255, 255, 255, 0.7);">${req.duration ? req.duration + 'ms' : 'N/A'}</td>
        <td style="color: rgba(255, 255, 255, 0.7);">${req.tokens || 'N/A'}</td>
        <td style="color: rgba(255, 255, 255, 0.6); font-size: 13px;">${req.userEmail || 'Anonymous'}</td>
      </tr>
    `;
  }).join('');
}

// Format timestamp for display
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Search and filter - Combined filtering logic
function applyFilters() {
  let filtered = [...allUsers];
  
  // Apply search filter
  const searchQuery = document.getElementById('userSearch')?.value.toLowerCase() || '';
  if (searchQuery) {
    filtered = filtered.filter(user => 
      user.email.toLowerCase().includes(searchQuery) || 
      (user.name && user.name.toLowerCase().includes(searchQuery))
    );
  }
  
  // Apply plan filter
  const planFilter = document.getElementById('planFilter')?.value || '';
  if (planFilter) {
    filtered = filtered.filter(user => user.plan === planFilter);
  }
  
  renderUsers(filtered);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('userSearch').addEventListener('input', applyFilters);
  document.getElementById('planFilter').addEventListener('change', applyFilters);
});

// User actions
async function viewUserDetails(userId) {
  console.log('viewUserDetails called with userId:', userId, 'type:', typeof userId);
  
  try {
    // Ensure userId is a string for consistent comparison
    const userIdStr = String(userId);
    
    // First, try to find user in local cache (works even if backend is down)
    const cachedUser = allUsers.find(u => String(u.id) === userIdStr);
    console.log('Cached user found:', cachedUser ? cachedUser.email : 'none', 'allUsers count:', allUsers.length);
    console.log('All user IDs:', allUsers.map(u => ({ id: u.id, type: typeof u.id })));
    
    // If we have a cached user, show it immediately (better UX)
    if (cachedUser) {
      const limit = getUsageLimit(cachedUser.plan);
      const numericLimit = limit === '∞' ? -1 : (typeof limit === 'number' ? limit : 60);
      
      const userData = {
        user: cachedUser,
        usage_stats: {
          current_month: cachedUser.usage_current_month || 0,
          limit: numericLimit,
          remaining: numericLimit === -1 ? -1 : Math.max(0, numericLimit - (cachedUser.usage_current_month || 0))
        },
        usage_logs: []
      };
      
      console.log('Showing modal with cached user data:', userData);
      showUserModal(userData);
      
      // Try to fetch fresh data from backend in background
      try {
        const isBackendRunning = await checkBackendHealth();
        if (isBackendRunning) {
          const result = await ipcRenderer.invoke('admin-backend-request', {
            method: 'GET',
            endpoint: `/api/admin/users/${userIdStr}`
          });
          
          if (result.success && result.data) {
            console.log('Got fresh data from backend, updating modal');
            showUserModal(result.data);
          }
        }
      } catch (bgError) {
        console.log('Background fetch failed (using cached data):', bgError.message);
      }
      
      return;
    }
    
    // No cached user - need to fetch from backend
    const isBackendRunning = await checkBackendHealth();
    console.log('Backend running:', isBackendRunning);
    
    if (!isBackendRunning) {
      showAlert('Backend is not running and user not found in cache', 'error');
      return;
    }

    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'GET',
      endpoint: `/api/admin/users/${userIdStr}`
    });
    
    if (!result.success) {
      if (result.status === 404) {
        showAlert('User not found', 'error');
        return;
      }
      throw new Error(result.error || 'Failed to fetch user details');
    }
    
    showUserModal(result.data);
  } catch (error) {
    console.error('Error loading user details:', error);
    showAlert('Failed to load user details: ' + error.message, 'error');
  }
}

function showUserModal(userData) {
  console.log('showUserModal called with:', userData);
  
  const modal = document.getElementById('userModal');
  const modalUserName = document.getElementById('modalUserName');
  const userDetailsContent = document.getElementById('userDetailsContent');
  
  if (!modal || !modalUserName || !userDetailsContent) {
    console.error('Modal elements not found');
    return;
  }
  
  // Extract user data - handle various data structures
  let user = null;
  let usageStats = { current_month: 0, limit: 60, remaining: 60 };
  
  console.log('Extracting user data from:', JSON.stringify(userData, null, 2));
  
  if (userData && userData.user) {
    user = userData.user;
    usageStats = userData.usage_stats || usageStats;
    console.log('Found user in userData.user:', user);
  } else if (userData && (userData.id || userData.email)) {
    user = userData;
    console.log('Using userData directly as user:', user);
  }
  
  if (!user) {
    console.error('No user data found in:', userData);
    modalUserName.textContent = 'Error';
    userDetailsContent.innerHTML = '<p style="color: #ef4444; padding: 20px; text-align: center;">No user data available. Please try again.</p>';
    modal.classList.remove('hidden');
    return;
  }
  
  // Store user ID for action buttons (ensure it's a string for consistency)
  const userId = String(user.id);
  
  console.log('Rendering modal for user:', user.email, 'ID:', userId);
  
  // Set title
  modalUserName.textContent = user.name || user.email || 'User Details';
  
  // Build content using DOM methods instead of innerHTML for reliability
  userDetailsContent.innerHTML = '';
  
  // Create grid container
  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;';
  
  // Account Info Card
  const accountCard = document.createElement('div');
  accountCard.style.cssText = 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px;';
  accountCard.innerHTML = `
    <h4 style="color: white; font-size: 14px; font-weight: 600; margin-bottom: 12px;">ACCOUNT INFO</h4>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Email:</strong> ${user.email || 'N/A'}</p>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Name:</strong> ${user.name || 'Not set'}</p>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Role:</strong> ${user.role || 'user'}</p>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Last Login:</strong> ${user.last_login ? formatDate(user.last_login) : 'Never'}</p>
  `;
  grid.appendChild(accountCard);
  
  // Subscription Card
  const subCard = document.createElement('div');
  subCard.style.cssText = 'background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px;';
  subCard.innerHTML = `
    <h4 style="color: white; font-size: 14px; font-weight: 600; margin-bottom: 12px;">SUBSCRIPTION</h4>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Plan:</strong> <span class="plan-badge plan-${user.plan || 'free'}">${user.plan || 'free'}</span></p>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Status:</strong> ${user.subscription_status || 'none'}</p>
    <p style="color: rgba(255,255,255,0.7); margin: 8px 0;"><strong style="color: white;">Usage:</strong> ${usageStats.current_month || 0} / ${usageStats.limit === -1 ? '∞' : usageStats.limit} min</p>
  `;
  grid.appendChild(subCard);
  
  userDetailsContent.appendChild(grid);
  
  // Action buttons
  const btnContainer = document.createElement('div');
  btnContainer.style.cssText = 'display: flex; gap: 12px; justify-content: flex-end;';
  
  const editBtn = document.createElement('button');
  editBtn.className = 'btn btn-success';
  editBtn.textContent = 'Edit Plan';
  editBtn.addEventListener('click', () => {
    console.log('Edit Plan clicked for user:', userId);
    editUserPlan(userId);
  });
  
  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn btn-primary';
  resetBtn.textContent = 'Reset Usage';
  resetBtn.addEventListener('click', () => {
    console.log('Reset Usage clicked for user:', userId);
    resetUserUsage(userId);
  });
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Delete User';
  deleteBtn.addEventListener('click', () => {
    console.log('Delete User clicked for user:', userId);
    deleteUser(userId);
  });
  
  btnContainer.appendChild(editBtn);
  btnContainer.appendChild(resetBtn);
  btnContainer.appendChild(deleteBtn);
  userDetailsContent.appendChild(btnContainer);
  
  // Show modal
  modal.classList.remove('hidden');
  console.log('Modal displayed successfully');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.classList.add('hidden');
    
    // Clear modal content to prevent memory leaks
    const userDetailsContent = document.getElementById('userDetailsContent');
    if (userDetailsContent) {
      userDetailsContent.innerHTML = '';
    }
  }
}

async function editUserPlan(userId) {
  // Ensure userId is a string for consistent comparison
  const userIdStr = String(userId);
  const user = allUsers.find(u => String(u.id) === userIdStr);
  if (!user) {
    console.error('User not found for ID:', userId);
    showAlert('User not found', 'error');
    return;
  }

  // Show edit modal
  showEditUserModal(user);
}

// Show edit user modal with form
function showEditUserModal(user) {
  const modal = document.getElementById('userModal');
  const modalUserName = document.getElementById('modalUserName');
  const userDetailsContent = document.getElementById('userDetailsContent');
  
  if (!modal || !modalUserName || !userDetailsContent) {
    console.error('Modal elements not found');
    return;
  }
  
  const userId = String(user.id);
  
  modalUserName.textContent = `Edit User: ${user.name || user.email}`;
  
  userDetailsContent.innerHTML = `
    <form id="editUserForm" style="display: flex; flex-direction: column; gap: 20px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Email</label>
          <input type="email" id="editUserEmail" value="${user.email || ''}" 
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;" readonly>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Name</label>
          <input type="text" id="editUserName" value="${user.name || ''}" placeholder="User name"
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;">
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Plan</label>
          <select id="editUserPlan" 
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;">
            <option value="free" ${user.plan === 'free' ? 'selected' : ''}>Free</option>
            <option value="starter" ${user.plan === 'starter' ? 'selected' : ''}>Starter</option>
            <option value="pro" ${user.plan === 'pro' ? 'selected' : ''}>Pro</option>
            <option value="unlimited" ${user.plan === 'unlimited' ? 'selected' : ''}>Unlimited</option>
            <option value="enterprise" ${user.plan === 'enterprise' ? 'selected' : ''}>Enterprise</option>
          </select>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Role</label>
          <select id="editUserRole" 
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;">
            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
            <option value="moderator" ${user.role === 'moderator' ? 'selected' : ''}>Moderator</option>
            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Subscription Status</label>
          <select id="editUserSubStatus" 
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;">
            <option value="none" ${user.subscription_status === 'none' ? 'selected' : ''}>None</option>
            <option value="active" ${user.subscription_status === 'active' ? 'selected' : ''}>Active</option>
            <option value="cancelled" ${user.subscription_status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
            <option value="expired" ${user.subscription_status === 'expired' ? 'selected' : ''}>Expired</option>
          </select>
        </div>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <label style="color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 600;">Current Usage (minutes)</label>
          <input type="number" id="editUserUsage" value="${user.usage_current_month || 0}" min="0"
            style="padding: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: white; font-size: 14px;">
        </div>
      </div>
      
      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 12px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
        <button type="button" class="btn btn-secondary" id="editCancelBtn" style="padding: 12px 24px;">Cancel</button>
        <button type="button" class="btn btn-danger" id="editDeleteBtn" style="padding: 12px 24px;">Delete User</button>
        <button type="submit" class="btn btn-success" id="editSaveBtn" style="padding: 12px 24px;">Save Changes</button>
      </div>
    </form>
  `;
  
  // Show modal first
  modal.classList.remove('hidden');
  
  // Add form submit handler
  const form = document.getElementById('editUserForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await saveUserChanges(userId);
    });
  }
  
  // Add cancel button handler
  const cancelBtn = document.getElementById('editCancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      closeUserModal();
    });
  }
  
  // Add delete button handler
  const deleteBtn = document.getElementById('editDeleteBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      deleteUser(userId);
    });
  }
}

// Save user changes from edit form
async function saveUserChanges(userId) {
  const userIdStr = String(userId);
  
  // Get form values
  const newPlan = document.getElementById('editUserPlan')?.value;
  const newRole = document.getElementById('editUserRole')?.value;
  const newSubStatus = document.getElementById('editUserSubStatus')?.value;
  const newName = document.getElementById('editUserName')?.value;
  const newUsage = document.getElementById('editUserUsage')?.value;
  
  // Validate required fields
  if (!newPlan || !newRole || !newSubStatus) {
    showAlert('Please fill in all required fields', 'error');
    return;
  }
  
  // Show loading state
  const saveBtn = document.getElementById('editSaveBtn');
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  
  try {
    // Check if backend is running
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
      throw new Error('Backend is not running. Please start the backend server first.');
    }
    
    // Update plan and subscription status
    const planResult = await ipcRenderer.invoke('admin-backend-request', {
      method: 'PUT',
      endpoint: `/api/admin/users/${userIdStr}/plan`,
      data: {
        plan: newPlan,
        subscription_status: newSubStatus,
        subscription_end_date: newPlan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });

    if (!planResult.success) {
      throw new Error(planResult.error || 'Failed to update plan');
    }

    // Update role if changed
    const user = allUsers.find(u => String(u.id) === userIdStr);
    if (user && newRole !== user.role) {
      const roleResult = await ipcRenderer.invoke('admin-backend-request', {
        method: 'PUT',
        endpoint: `/api/admin/users/${userIdStr}/role`,
        data: { role: newRole }
      });
      
      if (!roleResult.success) {
        console.warn('Failed to update role:', roleResult.error);
        showAlert('Plan updated but role update failed: ' + roleResult.error, 'warning');
      }
    }
    
    // Update usage if changed
    if (newUsage !== undefined && user && parseInt(newUsage) !== (user.usage_current_month || 0)) {
      const usageResult = await ipcRenderer.invoke('admin-backend-request', {
        method: 'PUT',
        endpoint: `/api/admin/users/${userIdStr}/usage`,
        data: { usage_current_month: parseInt(newUsage) || 0 }
      });
      
      if (!usageResult.success) {
        console.warn('Failed to update usage:', usageResult.error);
      }
    }

    showAlert('User updated successfully!', 'success');
    
    // Refresh data and close modal
    await loadUsers();
    closeUserModal();
    
  } catch (error) {
    console.error('Error saving user changes:', error);
    showAlert('Failed to update user: ' + error.message, 'error');
  } finally {
    // Reset button state
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  }
}

async function resetUserUsage(userId) {
  // Ensure userId is a string for consistent comparison
  const userIdStr = String(userId);
  const user = allUsers.find(u => String(u.id) === userIdStr);
  if (!user) {
    console.error('User not found for ID:', userId);
    showAlert('User not found', 'error');
    return;
  }

  // Show confirmation dialog
  const confirmed = confirm(`Reset usage for ${user.email}?\n\nThis will set their current month usage to 0.`);
  if (!confirmed) return;

  try {
    // Check if backend is running
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
      throw new Error('Backend is not running. Please start the backend server first.');
    }
    
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'POST',
      endpoint: `/api/admin/users/${userIdStr}/reset-usage`
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to reset usage');
    }

    showAlert('Usage reset successfully!', 'success');
    
    // Refresh data and close modal
    await loadUsers();
    closeUserModal();
    
  } catch (error) {
    console.error('Error resetting usage:', error);
    showAlert('Failed to reset usage: ' + error.message, 'error');
  }
}

async function deleteUser(userId) {
  // Ensure userId is a string for consistent comparison
  const userIdStr = String(userId);
  const user = allUsers.find(u => String(u.id) === userIdStr);
  if (!user) {
    console.error('User not found for ID:', userId);
    showAlert('User not found', 'error');
    return;
  }

  // Show confirmation dialog
  const confirmed = confirm(`Are you sure you want to delete ${user.email}?\n\nThis action cannot be undone.`);
  if (!confirmed) return;

  try {
    // Check if backend is running
    const isBackendRunning = await checkBackendHealth();
    if (!isBackendRunning) {
      throw new Error('Backend is not running. Please start the backend server first.');
    }
    
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'DELETE',
      endpoint: `/api/admin/users/${userIdStr}`
    });

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete user');
    }

    showAlert('User deleted successfully!', 'success');
    
    // Refresh data and close modal
    await loadUsers();
    closeUserModal();
    
  } catch (error) {
    console.error('Error deleting user:', error);
    showAlert('Failed to delete user: ' + error.message, 'error');
  }
}

// Bulk actions
async function applyBulkChanges() {
  if (selectedUsers.size === 0) {
    showAlert('No users selected', 'error');
    return;
  }

  const bulkPlan = document.getElementById('bulkPlan').value;
  const bulkRole = document.getElementById('bulkRole').value;

  if (!bulkPlan && !bulkRole) {
    showAlert('Please select at least one change to apply', 'error');
    return;
  }

  const userIds = Array.from(selectedUsers);
  const updates = {};
  
  if (bulkPlan) {
    updates.plan = bulkPlan;
    updates.subscription_status = bulkPlan === 'free' ? 'none' : 'active';
    if (bulkPlan !== 'free') {
      updates.subscription_end_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
  }
  
  if (bulkRole) {
    updates.role = bulkRole;
  }

  try {
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'PUT',
      endpoint: '/api/admin/users/bulk',
      data: {
        user_ids: userIds,
        updates: updates
      }
    });

    if (!result.success) throw new Error(result.error || 'Failed to apply bulk changes');
    showAlert(`Bulk update completed: ${result.data.results.successful} successful, ${result.data.results.failed} failed`, 'success');
    
    clearSelection();
    loadUsers();
    
    // Reset bulk action selects
    document.getElementById('bulkPlan').value = '';
    document.getElementById('bulkRole').value = '';
  } catch (error) {
    showAlert('Failed to apply bulk changes: ' + error.message, 'error');
  }
}

function refreshUsers() {
  loadUsers();
  loadApiRequests(); // Also refresh API requests
  showAlert('Data refreshed!', 'success');
}

// Close modal when clicking outside
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('userModal').addEventListener('click', (e) => {
    if (e.target.id === 'userModal') {
      closeUserModal();
    }
  });
});

// Cleanup when window is closed
window.addEventListener('beforeunload', () => {
  stopAutoRefresh();
});

// Refresh requests
function refreshRequests() {
  loadApiRequests();
  showAlert('Requests refreshed!', 'success');
}

// Clear logs
async function clearLogs() {
  if (!confirm('Are you sure you want to clear all logs?')) return;
  
  try {
    await ipcRenderer.invoke('admin-clear-logs');
    showAlert('Logs cleared successfully!', 'success');
    loadApiRequests();
  } catch (error) {
    showAlert('Failed to clear logs: ' + error.message, 'error');
  }
}

// Auto-refresh control
function startAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
  }
  
  if (autoRefreshEnabled) {
    // Refresh data every 5 minutes (less frequent to reduce API calls and avoid rate limiting)
    refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing admin data...');
      loadAdminData().catch(console.error);
      loadUsers().catch(console.error);
      loadApiRequests().catch(console.error);
    }, 300000); // 5 minutes to avoid rate limiting
    
    console.log('✅ Auto-refresh started (every 5 minutes)');
  }
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('⏹️ Auto-refresh stopped');
  }
}

function toggleAutoRefresh() {
  autoRefreshEnabled = !autoRefreshEnabled;
  
  if (autoRefreshEnabled) {
    startAutoRefresh();
    showAlert('Auto-refresh enabled (every 5 minutes)', 'success');
  } else {
    stopAutoRefresh();
    showAlert('Auto-refresh disabled', 'info');
  }
  
  // Update toggle button text if it exists
  const toggleBtn = document.getElementById('toggleAutoRefreshBtn');
  if (toggleBtn) {
    toggleBtn.textContent = autoRefreshEnabled ? 'Disable Auto-refresh' : 'Enable Auto-refresh';
  }
}

// Show alert
function showAlert(message, type) {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  
  // Handle HTML content for info alerts
  if (type === 'info' || message.includes('<')) {
    alert.innerHTML = message;
  } else {
    alert.textContent = message;
  }
  
  container.innerHTML = '';
  container.appendChild(alert);
  
  setTimeout(() => {
    alert.remove();
  }, 8000); // Longer timeout for info messages
}

// Add event listeners for static elements
function addStaticEventListeners() {
  // Refresh users button
  document.getElementById('refreshUsersBtn').addEventListener('click', refreshUsers);
  
  // Auto-refresh toggle button
  document.getElementById('toggleAutoRefreshBtn').addEventListener('click', toggleAutoRefresh);
  
  // Clear selection button
  document.getElementById('clearSelectionBtn').addEventListener('click', clearSelection);
  
  // Apply bulk changes button
  document.getElementById('applyBulkChangesBtn').addEventListener('click', applyBulkChanges);
  
  // Select all checkbox
  document.getElementById('selectAll').addEventListener('change', toggleSelectAll);
  
  // Modal close button
  document.getElementById('modalCloseBtn').addEventListener('click', closeUserModal);
  
  // Refresh requests button
  document.getElementById('refreshRequestsBtn').addEventListener('click', refreshRequests);
  
  // Clear logs button
  document.getElementById('clearLogsBtn').addEventListener('click', clearLogs);
}

// Add event listeners for user action buttons (called after rendering users)
function addUserActionListeners() {
  // User checkboxes
  document.querySelectorAll('.user-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      // Ensure userId is a string for consistent comparison
      toggleUserSelection(String(e.target.dataset.userId));
    });
  });

  // View user buttons
  document.querySelectorAll('.user-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = String(e.target.dataset.userId);
      console.log('View user button clicked for user ID:', userId);
      viewUserDetails(userId);
    });
  });

  // Edit user buttons
  document.querySelectorAll('.user-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editUserPlan(String(e.target.dataset.userId));
    });
  });

  // Delete user buttons
  document.querySelectorAll('.user-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteUser(String(e.target.dataset.userId));
    });
  });
}

// Add event listeners for modal action buttons (called when modal is shown)
function addModalActionListeners() {
  // Modal edit plan buttons
  document.querySelectorAll('.modal-edit-plan-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editUserPlan(e.target.dataset.userId);
    });
  });

  // Modal reset usage buttons
  document.querySelectorAll('.modal-reset-usage-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      resetUserUsage(e.target.dataset.userId);
    });
  });

  // Modal delete user buttons
  document.querySelectorAll('.modal-delete-user-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteUser(e.target.dataset.userId);
    });
  });
}