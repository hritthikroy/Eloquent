#!/usr/bin/env node

// Debug script to test protocol URL handling
const { app } = require('electron');

console.log('🔍 Protocol URL Debug Tool\n');

// Test protocol registration
console.log('1. Testing protocol registration...');
const isRegistered = app.isDefaultProtocolClient('eloquent');
console.log('Protocol registered:', isRegistered);

if (!isRegistered) {
  console.log('Attempting to register protocol...');
  const registered = app.setAsDefaultProtocolClient('eloquent');
  console.log('Registration result:', registered);
}

// Test URL parsing
console.log('\n2. Testing URL parsing...');
const testUrls = [
  'eloquent://auth/success?data=%7B%22success%22%3Atrue%2C%22access_token%22%3A%22test_token%22%7D',
  'eloquent://auth/success?access_token=test_token&refresh_token=test_refresh',
  'eloquent://auth/callback#access_token=test_token&refresh_token=test_refresh'
];

testUrls.forEach((url, index) => {
  console.log(`\nTest URL ${index + 1}:`, url);
  
  try {
    if (url.includes('?data=')) {
      const dataParam = url.split('?data=')[1];
      const authData = JSON.parse(decodeURIComponent(dataParam));
      console.log('Parsed data:', authData);
    } else {
      const urlObj = new URL(url.replace('eloquent://', 'https://'));
      const accessToken = urlObj.searchParams.get('access_token') || 
                         (urlObj.hash ? new URLSearchParams(urlObj.hash.substring(1)).get('access_token') : null);
      console.log('Access token:', accessToken);
    }
  } catch (error) {
    console.error('Parse error:', error.message);
  }
});

console.log('\n✅ Protocol debug completed!');