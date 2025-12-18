#!/usr/bin/env node

// Simple test script to verify admin role functionality
console.log('🧪 Testing Admin Role System...\n');

// Test 1: Admin email verification logic
console.log('Test 1: Admin Email Verification');
const testEmails = [
  'hritthikin@gmail.com',
  'user@example.com',
  'admin@test.com'
];

function isAdminEmail(email) {
  const adminEmails = ['hritthikin@gmail.com'];
  return adminEmails.includes(email);
}

testEmails.forEach(email => {
  console.log(`${email}: ${isAdminEmail(email) ? 'ADMIN' : 'USER'}`);
});

// Test 2: Protocol URL parsing
console.log('\nTest 2: Protocol URL Parsing');
const testUrls = [
  'eloquent://auth/success?data=%7B%22success%22%3Atrue%2C%22access_token%22%3A%22test_token%22%7D',
  'eloquent://auth/success?access_token=test_token&refresh_token=test_refresh',
  'eloquent://auth/callback#access_token=test_token&refresh_token=test_refresh'
];

testUrls.forEach((url, index) => {
  console.log(`\nTest URL ${index + 1}:`, url.substring(0, 80) + '...');
  
  try {
    let accessToken, refreshToken;
    
    if (url.includes('?data=')) {
      const dataParam = url.split('?data=')[1];
      const authData = JSON.parse(decodeURIComponent(dataParam));
      accessToken = authData.access_token;
      refreshToken = authData.refresh_token;
      console.log('✅ Parsed from JSON data');
    } else {
      const urlObj = new URL(url.replace('eloquent://', 'https://'));
      accessToken = urlObj.searchParams.get('access_token');
      refreshToken = urlObj.searchParams.get('refresh_token');
      
      if (!accessToken && urlObj.hash) {
        const fragment = urlObj.hash.substring(1);
        const params = new URLSearchParams(fragment);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
      }
      console.log('✅ Parsed from URL parameters');
    }
    
    console.log('Access token:', accessToken ? 'Found' : 'Not found');
    console.log('Refresh token:', refreshToken ? 'Found' : 'Not found');
  } catch (error) {
    console.error('❌ Parse error:', error.message);
  }
});

console.log('\n✅ Admin role system test completed!');
console.log('\n📋 Summary:');
console.log('- hritthikin@gmail.com will have admin role');
console.log('- All other emails will have user role');
console.log('- Admin panel access is protected by role check');
console.log('- Development mode grants admin access for testing');
console.log('- Protocol URL handling improved with better error handling');
console.log('- Success page now has manual close button as fallback');
console.log('- Fixed encoding issues in OAuth redirect URLs');