#!/usr/bin/env node

// Debug script to test sign-in button functionality
const authService = require('./src/services/auth-bridge');

async function debugSignIn() {
  console.log('🔍 DEBUGGING SIGN-IN BUTTON ISSUE');
  console.log('================================');
  
  try {
    console.log('1. Testing auth service initialization...');
    console.log('   Auth service loaded:', !!authService);
    console.log('   Methods available:', Object.getOwnPropertyNames(Object.getPrototypeOf(authService)));
    
    console.log('\n2. Testing signInWithGoogle method...');
    const result = await authService.signInWithGoogle();
    console.log('   Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n3. Testing OAuth callback simulation...');
      const callbackResult = await authService.handleOAuthCallback({
        access_token: 'test-token',
        refresh_token: 'test-refresh'
      });
      console.log('   Callback result:', JSON.stringify(callbackResult, null, 2));
      
      console.log('\n4. Testing authentication status...');
      const isAuth = await authService.isAuthenticated();
      console.log('   Is authenticated:', isAuth);
      
      if (isAuth) {
        const user = await authService.getCurrentUser();
        console.log('   Current user:', JSON.stringify(user, null, 2));
      }
    }
    
    console.log('\n✅ DIAGNOSIS COMPLETE');
    console.log('================================');
    
    if (result.success) {
      console.log('🎉 Sign-in functionality appears to be working correctly!');
      console.log('');
      console.log('If the button still doesn\'t work in the UI, the issue might be:');
      console.log('1. Frontend JavaScript error (check browser console)');
      console.log('2. IPC communication issue between renderer and main process');
      console.log('3. Button event listener not properly attached');
      console.log('4. CSS/HTML preventing button clicks');
    } else {
      console.log('❌ Sign-in functionality has issues:');
      console.log('   Error:', result.error);
    }
    
  } catch (error) {
    console.error('❌ CRITICAL ERROR during debugging:');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
  }
}

debugSignIn();