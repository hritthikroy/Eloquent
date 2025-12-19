// Check if running in Electron
const isElectron = typeof require !== 'undefined';
let API_BASE = 'http://localhost:3000/api';
let authToken = '';

console.log('User Management window loaded');
console.log('Is Electron:', isElectron);

if (isElectron) {
  const { ipcRenderer } = require('electron');
  
  console.log('Requesting auth token from main process...');
  
  // Get auth token from Electron
  ipcRenderer.invoke('get-auth-token').then(token => {
    console.log('Auth token response:', token ? 'Token received' : 'No token');
    if (!token) {
      console.log('No token received, trying development mode fallback...');
      authToken = 'dev-token';
      showAlert('Using development mode authentication', 'success');
      loadUsers();
      return;
    }
    authToken = token;
    console.log('Auth token received, loading users...');
    loadUsers();
  }).catch(error => {
    console.error('Failed to get auth token:', error);
    
    // Always fallback to development mode for user management
    console.log('Auth error occurred, falling back to development mode with dev-token...');
    authToken = 'dev-token';
    showAlert('Using development mode authentication (fallback)', 'success');
    loadUsers();
  });
} else {
  // Running in browser, use localStorage
  authToken = localStorage.getItem('access_token');
  if (!authToken) {
    showAlert('Not authenticated. Please log in.', 'error');
  } else {
    loadUsers();
  }
}

let allUsers = [];

async function loadUsers() {
  const loadingContainer = document.getElementById('loadingContainer');
  const usersContainer = document.getElementById('usersContainer');
  
  loadingContainer.classList.remove('hidden');
  usersContainer.classList.add('hidden');

  try {
    console.log('Making request to:', `${API_BASE}/admin/users`);
    console.log('Auth token available:', !!authToken);
    console.log('Auth token value:', authToken);
    
    if (!authToken) {
      throw new Error('No authentication token available');
    }
    
    const response = await fetch(`${API_BASE}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      
      if (response.status === 401) {
        throw new Error('Unauthorized - Please sign in again or check admin permissions');
      } else if (response.status === 403) {
        throw new Error('Forbidden - Admin access required');
      } else {
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }
    }

    const data = await response.json();
    console.log('Users data received:', data);
    allUsers = data.users || [];
    
    renderUsers(allUsers);
    
    loadingContainer.classList.add('hidden');
    usersContainer.classList.remove('hidden');
  } catch (error) {
    console.error('Error loading users:', error);
    showAlert('Failed to load users: ' + error.message, 'error');
    loadingContainer.classList.add('hidden');
  }
}

function renderUsers(users) {
  const tbody = document.getElementById('usersTable');
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: rgba(255, 255, 255, 0.5);">No users found</td></tr>';
    return;
  }

  tbody.innerHTML = users.map(user => {
    const usageLimit = getUsageLimit(user.plan);
    const usagePercent = usageLimit === '∞' ? 0 : Math.min(100, (user.usage_current_month / usageLimit) * 100);
    const usageClass = usagePercent > 90 ? 'danger' : usagePercent > 75 ? 'warning' : '';

    return `
      <tr>
        <td>
          <div class="user-info">
            <div class="user-avatar">${getInitials(user.email)}</div>
            <div class="user-details">
              <div class="user-name">${user.name || 'Unknown'}</div>
              <div class="user-email">${user.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge plan-${user.plan}">${user.plan}</span></td>
        <td><span class="badge role-${user.role}">${user.role}</span></td>
        <td>
          <div>
            <span style="font-size: 13px;">${user.usage_current_month || 0} / ${usageLimit} min</span>
            <div class="usage-bar">
              <div class="usage-fill ${usageClass}" style="width: ${usagePercent}%"></div>
            </div>
          </div>
        </td>
        <td><span class="badge status-${user.subscription_status}">${user.subscription_status}</span></td>
        <td style="color: rgba(255, 255, 255, 0.7); font-size: 13px;">
          ${user.last_login ? formatDate(user.last_login) : 'Never'}
        </td>
        <td>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-success btn-small" data-action="edit" data-user-id="${user.id}">Edit Plan</button>
            <button class="btn btn-danger btn-small" data-action="delete" data-user-id="${user.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Search and filter
function initializeEventListeners() {
  document.getElementById('searchInput').addEventListener('input', (e) => {
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
}

async function editUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  const newPlan = prompt(
    `Change plan for ${user.email}\n\nCurrent plan: ${user.plan}\n\nEnter new plan:`,
    user.plan
  );

  if (!newPlan || newPlan === user.plan) return;

  const validPlans = ['free', 'starter', 'pro', 'unlimited', 'enterprise'];
  if (!validPlans.includes(newPlan)) {
    showAlert('Invalid plan. Valid options: ' + validPlans.join(', '), 'error');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}/plan`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        plan: newPlan,
        subscription_status: newPlan === 'free' ? 'none' : 'active',
        subscription_end_date: newPlan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      })
    });

    if (!response.ok) throw new Error('Failed to update plan');

    showAlert(`Plan updated to ${newPlan} successfully!`, 'success');
    loadUsers();
  } catch (error) {
    showAlert('Failed to update plan: ' + error.message, 'error');
  }
}

async function deleteUser(userId) {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;

  if (!confirm(`Delete user ${user.email}?\n\nThis action cannot be undone.`)) return;

  try {
    const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    if (!response.ok) throw new Error('Failed to delete user');

    showAlert('User deleted successfully!', 'success');
    loadUsers();
  } catch (error) {
    showAlert('Failed to delete user: ' + error.message, 'error');
  }
}

function showAlert(message, type) {
  const container = document.getElementById('alertContainer');
  const alert = document.createElement('div');
  alert.className = `alert alert-${type}`;
  alert.textContent = message;
  
  container.innerHTML = '';
  container.appendChild(alert);
  
  setTimeout(() => alert.remove(), 5000);
}

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

function forceDevMode() {
  console.log('Forcing development mode...');
  authToken = 'dev-token';
  showAlert('Forced development mode - using dev-token', 'success');
  loadUsers();
}

// Add event listeners to replace onclick handlers
document.addEventListener('DOMContentLoaded', () => {
  // Initialize search and filter listeners
  initializeEventListeners();
  
  // Refresh button
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadUsers);
  }
  
  // Force dev mode button
  const forceDevModeBtn = document.getElementById('forceDevModeBtn');
  if (forceDevModeBtn) {
    forceDevModeBtn.addEventListener('click', forceDevMode);
  }
});

// Add event delegation for dynamically created buttons
document.addEventListener('click', (e) => {
  if (e.target.matches('button[data-action="edit"]')) {
    const userId = e.target.getAttribute('data-user-id');
    editUser(userId);
  } else if (e.target.matches('button[data-action="delete"]')) {
    const userId = e.target.getAttribute('data-user-id');
    deleteUser(userId);
  }
});