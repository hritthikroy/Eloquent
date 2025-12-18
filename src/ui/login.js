const { ipcRenderer } = require('electron');

function showError(message) {
  const el = document.getElementById('error-message');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('success-message').style.display = 'none';
}

function showSuccess(message) {
  const el = document.getElementById('success-message');
  el.textContent = message;
  el.style.display = 'block';
  document.getElementById('error-message').style.display = 'none';
}

function setLoading(loading) {
  const btn = document.getElementById('google-btn');
  const btnText = btn.querySelector('.btn-text');
  const loadingEl = btn.querySelector('.loading');
  
  if (loading) {
    btnText.style.display = 'none';
    loadingEl.style.display = 'flex';
    btn.disabled = true;
  } else {
    btnText.style.display = 'inline';
    loadingEl.style.display = 'none';
    btn.disabled = false;
  }
}

async function signInWithGoogle() {
  console.log('🖱️ Sign-in button clicked!');
  setLoading(true);
  
  try {
    console.log('📡 Calling auth-google IPC...');
    const result = await ipcRenderer.invoke('auth-google');
    console.log('📡 IPC result:', result);
    
    if (result.success) {
      if (result.isDevelopment) {
        showSuccess('Development mode activated! Redirecting...');
      } else {
        showSuccess('Sign in successful! Redirecting...');
      }
      setTimeout(() => {
        ipcRenderer.send('auth-complete', result);
      }, 500);
    } else {
      handleAuthError(result.error);
    }
  } catch (error) {
    console.error('Sign in error:', error);
    handleAuthError(error.message || 'Unexpected error occurred');
  } finally {
    setLoading(false);
  }
}

function handleAuthError(errorMessage) {
  // Standardized error handling
  const errorMap = {
    'your-project.supabase.co': 'Google Sign-in not configured. Please set up Supabase credentials.',
    'your-anon-key': 'Google Sign-in not configured. Please set up Supabase credentials.',
    'timeout': 'Connection timeout. Please check your internet connection.',
    'network': 'Network error. Please check your internet connection.',
    'Invalid API key': 'Invalid configuration. Please check your setup.',
    'not configured': 'Authentication not properly configured.',
    'connection': 'Unable to connect. Please try again.'
  };

  let displayError = errorMessage || 'Sign in failed';
  
  // Find matching error pattern
  for (const [pattern, message] of Object.entries(errorMap)) {
    if (displayError.toLowerCase().includes(pattern.toLowerCase())) {
      displayError = message;
      break;
    }
  }

  showError(displayError);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for the Google button
  document.getElementById('google-btn').addEventListener('click', signInWithGoogle);

  // Listen for Google auth callback
  ipcRenderer.on('google-auth-result', (_, result) => {
    setLoading(false);
    if (result.success) {
      showSuccess('Sign in successful! Redirecting...');
      setTimeout(() => {
        ipcRenderer.send('auth-complete', result);
      }, 500);
    } else {
      showError(result.error || 'Sign in failed');
    }
  });
});