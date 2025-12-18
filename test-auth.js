// Quick test script to verify auth service works correctly
const authService = require('./auth-service');

console.log('🧪 Testing Auth Service...');
console.log('================================');

// Test development mode detection
console.log('Development mode:', authService.isDevelopmentMode);
console.log('Supabase URL:', authService.supabaseUrl);
console.log('Is authenticated:', authService.isAuthenticated());

// Test user info
const user = authService.getUser();
console.log('User:', user);

// Test subscription
const subscription = authService.getSubscription();
console.log('Subscription:', subscription);

// Test usage
const usage = authService.getUsage();
console.log('Usage:', usage);

// Test Google sign-in
authService.signInWithGoogle().then(result => {
  console.log('Google sign-in result:', result);
}).catch(error => {
  console.error('Google sign-in error:', error);
});

console.log('✅ Test completed');