#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing dashboard CSP violations...');

// Read the dashboard.html file
let dashboardContent = fs.readFileSync('dashboard.html', 'utf8');

// Fix 1: Remove onclick from sidebar navigation
dashboardContent = dashboardContent.replace(
  /onclick="showSection\('([^']+)'\)"/g,
  'data-section="$1"'
);

// Fix 2: Remove onclick from clear all button
dashboardContent = dashboardContent.replace(
  /onclick="clearAllHistory\(\)"/g,
  'class="btn clear-all-btn"'
);

// Fix 3: Remove onfocus/onblur from search input
dashboardContent = dashboardContent.replace(
  /onfocus="[^"]*"/g,
  ''
);
dashboardContent = dashboardContent.replace(
  /onblur="[^"]*"/g,
  ''
);

// Fix 4: Remove onclick from toggle switches
dashboardContent = dashboardContent.replace(
  /onclick="this\.classList\.toggle\('active'\)"/g,
  ''
);

// Fix 5: Remove onclick from save settings button
dashboardContent = dashboardContent.replace(
  /onclick="saveSettings\(\)"/g,
  'id="saveSettingsBtn"'
);

// Fix 6: Remove onmouseover/onmouseout from buttons (these will be handled by CSS)
dashboardContent = dashboardContent.replace(
  /onmouseover="[^"]*"/g,
  ''
);
dashboardContent = dashboardContent.replace(
  /onmouseout="[^"]*"/g,
  ''
);

// Write the fixed content back
fs.writeFileSync('dashboard.html', dashboardContent);

console.log('✅ Dashboard CSP violations fixed!');
console.log('📝 Next steps:');
console.log('1. The navigation, history, and settings should now work');
console.log('2. Check browser console - CSP errors should be gone');
console.log('3. Test all functionality to ensure everything works');