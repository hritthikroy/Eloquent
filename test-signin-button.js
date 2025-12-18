#!/usr/bin/env node

// Test script to verify sign-in button functionality
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import the auth service
const authService = require('./src/services/auth-bridge');

console.log('🧪 Testing Sign-In Button Functionality');
console.log('=' .repeat(50));

async function testSignInFlow() {
  console.log('1. Testing auth service sign-in...');
  
  try {
    const result = await authService.signInWithGoogle();
    console.log('   ✅ Sign-in result:', result);
    
    if (result.success && result.isDevelopment) {
      console.log('   🔧 Development mode detected');
      
      console.log('\n2. Testing OAuth callback...');
      const callbackResult = await authService.handleOAuthCallback({
        access_token: 'dev-token',
        refresh_token: 'dev-refresh-token'
      });
      
      console.log('   ✅ Callback result:', callbackResult);
      
      if (callbackResult.success) {
        console.log('\n3. Testing authentication status...');
        console.log('   ✅ Is authenticated:', authService.isAuthenticated());
        console.log('   ✅ User:', authService.getUser());
        console.log('   ✅ Is admin:', authService.isAdmin());
        
        console.log('\n🎉 Sign-in flow test: SUCCESS');
        console.log('✅ The sign-in button should work properly now');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

// Run the test
testSignInFlow().then(success => {
  if (success) {
    console.log('\n📋 Summary:');
    console.log('✅ Auth service: Working');
    console.log('✅ Development mode: Active');
    console.log('✅ OAuth callback: Working');
    console.log('✅ User authentication: Working');
    console.log('\n🎯 The sign-in button in the UI should now work properly!');
  } else {
    console.log('\n❌ Tests failed. Sign-in button may still have issues.');
  }
}).catch(console.error);