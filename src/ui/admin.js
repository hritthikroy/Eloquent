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
        // Stats endpoint not found, use mock data
        console.log('Stats endpoint not found, using mock data');
        const mockStats = {
          total_requests: 1250,
          active_users_24h: 45,
          api_usage_percent: 67.3,
          success_rate: 98.5
        };
        updateStatsDisplay(mockStats);
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
    
    console.log('🔍 Health check result:', result);
    
    if (result.success && result.status === 200) {
      console.log('✅ Backend is healthy');
      return true;
    } else {
      console.log('❌ Backend health check failed:', result);
      return false;
    }
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
        // Try with development mode authentication
        console.log('401 error, trying with admin email override...');
        showAlert('Authentication failed. Make sure you are signed in with an admin account (hritthikin@gmail.com)', 'error');
        
        // Show mock users for development
        allUsers = generateMockUsers();
        renderUsers(allUsers);
        showAlert('Showing mock data for development. Sign in with admin account for real data.', 'info');
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
    
    // Fallback: show mock users for development
    allUsers = generateMockUsers();
    renderUsers(allUsers);
    showAlert('Showing mock data due to connection error', 'info');
  }
}

// Generate mock users for development/testing
function generateMockUsers() {
  return [
    {
      id: '1',
      email: 'hritthikin@gmail.com',
      name: 'Admin User',
      role: 'admin',
      plan: 'enterprise',
      subscription_status: 'active',
      usage_current_month: 45,
      last_login: new Date().toISOString(),
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '2',
      email: 'user@example.com',
      name: 'Test User',
      role: 'user',
      plan: 'pro',
      subscription_status: 'active',
      usage_current_month: 120,
      last_login: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
    },
    {
      id: '3',
      email: 'free@example.com',
      name: 'Free User',
      role: 'user',
      plan: 'free',
      subscription_status: 'none',
      usage_current_month: 25,
      last_login: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
}

// Render users table
function renderUsers(users) {
  const tbody = document.getElementById('usersTableBody');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const usagePercent = user.plan === 'unlimited' || user.plan === 'enterprise' ? 0 : 
      Math.min(100, (user.usage_current_month / getUsageLimit(user.plan)) * 100);
    const usageClass = usagePercent > 90 ? 'danger' : usagePercent > 75 ? 'warning' : '';
    
    return `
      <tr>
        <td class="checkbox-cell">
          <input type="checkbox" class="user-checkbox" data-user-id="${user.id}" 
            ${selectedUsers.has(user.id) ? 'checked' : ''}>
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
            <button class="btn btn-primary btn-small user-view-btn" data-user-id="${user.id}">View</button>
            <button class="btn btn-success btn-small user-edit-btn" data-user-id="${user.id}">Edit</button>
            <button class="btn btn-danger btn-small user-delete-btn" data-user-id="${user.id}">Delete</button>
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
  if (selectedUsers.has(userId)) {
    selectedUsers.delete(userId);
  } else {
    selectedUsers.add(userId);
  }
  updateBulkActions();
}

function toggleSelectAll() {
  const selectAll = document.getElementById('selectAll');
  const checkboxes = document.querySelectorAll('.user-checkbox');
  
  if (selectAll.checked) {
    checkboxes.forEach(cb => {
      cb.checked = true;
      selectedUsers.add(cb.dataset.userId);
    });
  } else {
    checkboxes.forEach(cb => {
      cb.checked = false;
      selectedUsers.delete(cb.dataset.userId);
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

// Load API requests (placeholder for future implementation)
async function loadApiRequests() {
  // This would load recent API requests from the backend
  // For now, we'll focus on user management
  console.log('API request monitoring - to be implemented');
}

// Search and filter
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('userSearch').addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const filtered = allUsers.filter(user => 
      user.email.toLowerCase().includes(query) || 
      (user.name && user.name.toLowerCase().includes(query))
    );
    renderUsers(filtered);
  });

  document.getElementById('planFilter').addEventListener('change', (e) => {
    const plan = e.target.value;
    const filtered = plan ? allUsers.filter(user => user.plan === plan) : allUsers;
    renderUsers(filtered);
  });
});

// User actions
async function viewUserDetails(userId) {
  console.log('viewUserDetails called with userId:', userId, 'type:', typeof userId);
  
  try {
    // First, try to find user in local cache (works even if backend is down)
    // Convert userId to string for comparison since data-user-id is always a string
    const userIdStr = String(userId);
    const cachedUser = allUsers.find(u => String(u.id) === userIdStr);
    console.log('Cached user found:', cachedUser ? cachedUser.email : 'none', 'allUsers count:', allUsers.length);
    
    // Check if backend is running first
    const isBackendRunning = await checkBackendHealth();
    console.log('Backend running:', isBackendRunning);
    
    if (!isBackendRunning) {
      // Fallback to mock user data for development
      if (cachedUser) {
        const limit = getUsageLimit(cachedUser.plan);
        const numericLimit = limit === '∞' ? -1 : (typeof limit === 'number' ? limit : 60);
        
        const mockUserData = {
          user: cachedUser,
          usage_stats: {
            current_month: cachedUser.usage_current_month || 0,
            limit: numericLimit,
            remaining: numericLimit === -1 ? -1 : Math.max(0, numericLimit - (cachedUser.usage_current_month || 0))
          },
          usage_logs: [
            {
              created_at: new Date().toISOString(),
              type: 'transcription',
              minutes: 15,
              mode: 'real-time',
              success: true
            },
            {
              created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
              type: 'transcription',
              minutes: 30,
              mode: 'file-upload',
              success: true
            }
          ]
        };
        console.log('Showing modal with mock data:', mockUserData);
        showUserModal(mockUserData);
        showAlert('Showing mock data - backend not running', 'info');
        return;
      }
      showAlert('Backend is not running and user not found in cache', 'error');
      return;
    }

    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'GET',
      endpoint: `/api/admin/users/${userId}`
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
    
    // Try to show basic user info from cache as fallback
    const userIdStr = String(userId);
    const cachedUser = allUsers.find(u => String(u.id) === userIdStr);
    console.log('Fallback - cached user:', cachedUser ? cachedUser.email : 'none');
    
    if (cachedUser) {
      const limit = getUsageLimit(cachedUser.plan);
      const numericLimit = limit === '∞' ? -1 : (typeof limit === 'number' ? limit : 60);
      
      const fallbackData = {
        user: cachedUser,
        usage_stats: {
          current_month: cachedUser.usage_current_month || 0,
          limit: numericLimit,
          remaining: numericLimit === -1 ? -1 : Math.max(0, numericLimit - (cachedUser.usage_current_month || 0))
        },
        usage_logs: []
      };
      console.log('Showing modal with fallback data:', fallbackData);
      showUserModal(fallbackData);
      showAlert('Showing cached data - could not load latest details: ' + error.message, 'error');
    } else {
      showAlert('Failed to load user details: ' + error.message, 'error');
    }
  }
}

function showUserModal(userData) {
  const modal = document.getElementById('userModal');
  const modalUserName = document.getElementById('modalUserName');
  const userDetailsContent = document.getElementById('userDetailsContent');
  
  // Check if modal elements exist
  if (!modal || !modalUserName || !userDetailsContent) {
    console.error('Modal elements not found:', { modal: !!modal, modalUserName: !!modalUserName, userDetailsContent: !!userDetailsContent });
    showAlert('Modal elements not found - page may not be fully loaded', 'error');
    return;
  }
  
  // Show modal immediately so user sees something
  modal.classList.remove('hidden');
  
  // Debug: log the received data
  console.log('User modal data received:', userData);
  
  // Handle case where userData is null/undefined
  if (!userData) {
    console.error('No user data provided to showUserModal');
    modalUserName.textContent = 'Error';
    userDetailsContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ef4444;">
        <h3>No Data Available</h3>
        <p>User data was not provided. Please try again.</p>
        <button class="btn btn-primary" onclick="closeUserModal()">Close</button>
      </div>
    `;
    return;
  }
  
  // Validate data structure - handle both direct user object and wrapped user object
  let user, usageStats, usageLogs;
  
  if (userData.user) {
    // Backend response format
    user = userData.user;
    usageStats = userData.usage_stats || { current_month: 0, limit: 0, remaining: 0 };
    usageLogs = userData.usage_logs || [];
  } else if (userData.id || userData.email) {
    // Direct user object format (fallback)
    user = userData;
    const limit = getUsageLimit(user.plan);
    const numericLimit = limit === '∞' ? -1 : (typeof limit === 'number' ? limit : 60);
    usageStats = { 
      current_month: user.usage_current_month || 0, 
      limit: numericLimit,
      remaining: numericLimit === -1 ? -1 : Math.max(0, numericLimit - (user.usage_current_month || 0))
    };
    usageLogs = [];
  } else {
    console.error('Invalid user data structure:', userData);
    modalUserName.textContent = 'Error';
    userDetailsContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ef4444;">
        <h3>Invalid Data</h3>
        <p>The user data format is not recognized.</p>
        <pre style="text-align: left; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; font-size: 11px; overflow: auto; max-height: 200px;">${JSON.stringify(userData, null, 2)}</pre>
        <button class="btn btn-primary" onclick="closeUserModal()" style="margin-top: 16px;">Close</button>
      </div>
    `;
    return;
  }
  
  if (!user) {
    console.error('User object is null after parsing');
    modalUserName.textContent = 'Error';
    userDetailsContent.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #ef4444;">
        <h3>User Not Found</h3>
        <p>Could not extract user information from the response.</p>
        <button class="btn btn-primary" onclick="closeUserModal()">Close</button>
      </div>
    `;
    return;
  }
  
  modalUserName.textContent = user.name || user.email || 'Unknown User';
  
  // Show loading state first
  userDetailsContent.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; padding: 40px;">
      <div class="loading" style="width: 24px; height: 24px; margin-right: 12px;"></div>
      <span style="color: rgba(255, 255, 255, 0.7);">Loading user details...</span>
    </div>
  `;
  
  // Then populate with actual content
  setTimeout(() => {
    console.log('Populating modal with user data:', { user, usageStats, usageLogs });
    
    try {
      // Create a simpler, more robust modal content
      const modalContent = `
        <div class="user-detail-grid">
          <div class="user-detail-card">
            <h4>Account Information</h4>
            <div class="user-detail-item">
              <span class="user-detail-label">Email</span>
              <span class="user-detail-value">${user.email || 'N/A'}</span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Name</span>
              <span class="user-detail-value">${user.name || 'Not set'}</span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Role</span>
              <span class="user-detail-value">
                <span class="role-badge role-${user.role || 'user'}">${user.role || 'user'}</span>
              </span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Created</span>
              <span class="user-detail-value">${user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Last Login</span>
              <span class="user-detail-value">${user.last_login ? formatDate(user.last_login) : 'Never'}</span>
            </div>
          </div>
          
          <div class="user-detail-card">
            <h4>Subscription</h4>
            <div class="user-detail-item">
              <span class="user-detail-label">Plan</span>
              <span class="user-detail-value">
                <span class="plan-badge plan-${user.plan || 'free'}">${user.plan || 'free'}</span>
              </span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Status</span>
              <span class="user-detail-value">
                <span class="status-badge status-${user.subscription_status === 'active' ? 'success' : 'pending'}">
                  ${user.subscription_status || 'none'}
                </span>
              </span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">End Date</span>
              <span class="user-detail-value">${user.subscription_end_date ? new Date(user.subscription_end_date).toLocaleDateString() : 'N/A'}</span>
            </div>
          </div>
          
          <div class="user-detail-card">
            <h4>Usage Statistics</h4>
            <div class="user-detail-item">
              <span class="user-detail-label">Current Month</span>
              <span class="user-detail-value">${usageStats.current_month || 0} minutes</span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Limit</span>
              <span class="user-detail-value">${usageStats.limit === -1 ? 'Unlimited' : (usageStats.limit || 0) + ' minutes'}</span>
            </div>
            <div class="user-detail-item">
              <span class="user-detail-label">Remaining</span>
              <span class="user-detail-value">${usageStats.remaining === -1 ? 'Unlimited' : (usageStats.remaining || 0) + ' minutes'}</span>
            </div>
          </div>
        </div>
        
        <div class="user-detail-card">
          <h4>Recent Usage Logs</h4>
          <table class="api-requests-table" style="margin-top: 12px;">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Minutes</th>
                <th>Mode</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${usageLogs && usageLogs.length > 0 ? usageLogs.map(log => `
                <tr>
                  <td>${formatDate(log.created_at)}</td>
                  <td>${log.type || 'N/A'}</td>
                  <td>${log.minutes || 0}</td>
                  <td>${log.mode || 'N/A'}</td>
                  <td>
                    <span class="status-badge status-${log.success ? 'success' : 'error'}">
                      ${log.success ? 'Success' : 'Failed'}
                    </span>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center; color: rgba(255,255,255,0.5);">No usage logs found</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
          <button class="btn btn-success modal-edit-plan-btn" data-user-id="${user.id}">Edit Plan</button>
          <button class="btn btn-primary modal-reset-usage-btn" data-user-id="${user.id}">Reset Usage</button>
          <button class="btn btn-danger modal-delete-user-btn" data-user-id="${user.id}">Delete User</button>
        </div>
      `;
      
      userDetailsContent.innerHTML = modalContent;
      
      console.log('Modal content populated successfully');
      
      // Add event listeners for modal action buttons
      addModalActionListeners();
    } catch (error) {
      console.error('Error populating modal content:', error);
      userDetailsContent.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
          <h3>Error Loading User Details</h3>
          <p>Failed to display user information: ${error.message}</p>
          <p style="font-size: 12px; color: rgba(255, 255, 255, 0.5); margin-top: 10px;">
            Debug info: ${JSON.stringify({ hasUser: !!user, hasStats: !!usageStats, hasLogs: !!usageLogs })}
          </p>
          <button class="btn btn-primary" onclick="closeUserModal()">Close</button>
        </div>
      `;
    }
  }, 100); // Small delay to show loading state
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.classList.add('hidden');
  }
}

// Test function to debug modal issues
function testUserModal() {
  console.log('Testing user modal with mock data...');
  
  // First, let's check if modal elements exist
  const modal = document.getElementById('userModal');
  const modalUserName = document.getElementById('modalUserName');
  const userDetailsContent = document.getElementById('userDetailsContent');
  
  console.log('Modal elements check:', {
    modal: !!modal,
    modalUserName: !!modalUserName,
    userDetailsContent: !!userDetailsContent
  });
  
  if (!modal) {
    showAlert('Modal element not found!', 'error');
    return;
  }
  
  // Show modal with simple content first
  modal.classList.remove('hidden');
  
  if (modalUserName) {
    modalUserName.textContent = 'Test User Modal';
  }
  
  if (userDetailsContent) {
    userDetailsContent.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h3 style="color: white; margin-bottom: 20px;">Modal Test Successful!</h3>
        <p style="color: rgba(255, 255, 255, 0.7); margin-bottom: 20px;">
          This confirms the modal is working correctly.
        </p>
        <button class="btn btn-primary" onclick="closeUserModal()">Close Test</button>
      </div>
    `;
  }
  
  console.log('Test modal should now be visible');
  
  // Check if modal is actually visible
  setTimeout(() => {
    const computedStyle = window.getComputedStyle(modal);
    console.log('Modal computed display:', computedStyle.display);
    console.log('Modal classList:', modal.classList.toString());
  }, 200);
}

async function editUserPlan(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const newPlan = prompt(`Change plan for ${user.email}:\n\nCurrent: ${user.plan}\n\nEnter new plan (free, starter, pro, unlimited, enterprise):`, user.plan);
  if (!newPlan || newPlan === user.plan) return;

  const validPlans = ['free', 'starter', 'pro', 'unlimited', 'enterprise'];
  if (!validPlans.includes(newPlan)) {
    showAlert('Invalid plan. Valid options: ' + validPlans.join(', '), 'error');
    return;
  }

  try {
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'PUT',
      endpoint: `/api/admin/users/${userId}/plan`,
      data: {
        plan: newPlan,
        subscription_status: newPlan === 'free' ? 'none' : 'active',
        subscription_end_date: newPlan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
      }
    });

    if (!result.success) throw new Error(result.error || 'Failed to update plan');

    showAlert(`Plan updated to ${newPlan} successfully!`, 'success');
    loadUsers();
    closeUserModal();
  } catch (error) {
    showAlert('Failed to update plan: ' + error.message, 'error');
  }
}

async function resetUserUsage(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  if (!confirm(`Reset usage for ${user.email}?`)) return;

  try {
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'POST',
      endpoint: `/api/admin/users/${userId}/reset-usage`
    });

    if (!result.success) throw new Error(result.error || 'Failed to reset usage');

    showAlert('Usage reset successfully!', 'success');
    loadUsers();
    closeUserModal();
  } catch (error) {
    showAlert('Failed to reset usage: ' + error.message, 'error');
  }
}

async function deleteUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  if (!confirm(`Are you sure you want to delete ${user.email}?\n\nThis action cannot be undone.`)) return;

  try {
    const result = await ipcRenderer.invoke('admin-backend-request', {
      method: 'DELETE',
      endpoint: `/api/admin/users/${userId}`
    });

    if (!result.success) throw new Error(result.error || 'Failed to delete user');

    showAlert('User deleted successfully!', 'success');
    loadUsers();
    closeUserModal();
  } catch (error) {
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
  showAlert('Users refreshed!', 'success');
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
    // Refresh data every 2 minutes (less frequent to reduce API calls)
    refreshInterval = setInterval(() => {
      console.log('🔄 Auto-refreshing admin data...');
      loadAdminData().catch(console.error);
      loadApiRequests().catch(console.error);
    }, 120000); // 2 minutes instead of 30 seconds
    
    console.log('✅ Auto-refresh started (every 2 minutes)');
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
    showAlert('Auto-refresh enabled (every 2 minutes)', 'success');
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
  
  // Test modal button
  document.getElementById('testModalBtn').addEventListener('click', testUserModal);
  
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
      toggleUserSelection(e.target.dataset.userId);
    });
  });

  // View user buttons
  document.querySelectorAll('.user-view-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const userId = e.target.dataset.userId;
      console.log('View user button clicked for user ID:', userId);
      viewUserDetails(userId);
    });
  });

  // Edit user buttons
  document.querySelectorAll('.user-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      editUserPlan(e.target.dataset.userId);
    });
  });

  // Delete user buttons
  document.querySelectorAll('.user-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteUser(e.target.dataset.userId);
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