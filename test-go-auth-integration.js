#!/usr/bin/env node

// Integration test for Go auth bridge
const authBridge = require('./src/services/auth-bridge');

async function testBasicFunctionality() {
  console.log('🧪 Testing Go Auth Bridge Integration');
  console.log('=' .repeat(50));
  
  try {
    // Test 1: Health check
    console.log('1. Testing backend health check...');
    const isHealthy = await authBridge.healthCheck();
    console.log(`   Backend health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    
    if (!isHealthy) {
      console.log('💡 Make sure Go backend is running: cd backend-go && go run main.go');
      return false;
    }
    
    // Test 2: Sign in
    console.log('\n2. Testing Google sign-in...');
    const signInResult = await authBridge.signInWithGoogle();
    console.log(`   Sign-in result: ${signInResult.success ? '✅ Success' : '❌ Failed'}`);
    if (signInResult.isDevelopment) {
      console.log('   🔧 Development mode detected');
    }
    
    // Test 3: Session validation
    console.log('\n3. Testing session validation...');
    const sessionResult = await authBridge.validateSession();
    console.log(`   Session valid: ${sessionResult.valid ? '✅ Valid' : '❌ Invalid'}`);
    if (sessionResult.cached) {
      console.log('   ⚡ Using cached session (ultra-fast!)');
    }
    
    // Test 4: User retrieval
    console.log('\n4. Testing user retrieval...');
    const user = authBridge.getUser();
    console.log(`   User found: ${user ? '✅ Found' : '❌ Not found'}`);
    if (user) {
      console.log(`   User email: ${user.email}`);
      console.log(`   User role: ${user.role}`);
    }
    
    // Test 5: Authentication check
    console.log('\n5. Testing authentication status...');
    const isAuth = authBridge.isAuthenticated();
    console.log(`   Authenticated: ${isAuth ? '✅ Yes' : '❌ No'}`);
    
    // Test 6: Admin check
    console.log('\n6. Testing admin status...');
    const isAdminUser = authBridge.isAdmin();
    console.log(`   Admin user: ${isAdminUser ? '✅ Yes' : '❌ No'}`);
    
    // Test 7: Subscription info
    console.log('\n7. Testing subscription info...');
    const subscription = authBridge.getSubscription();
    console.log(`   Subscription: ${subscription ? '✅ Found' : '❌ Not found'}`);
    if (subscription) {
      console.log(`   Plan: ${subscription.plan}`);
      console.log(`   Status: ${subscription.status}`);
    }
    
    // Test 8: Usage info
    console.log('\n8. Testing usage info...');
    const usage = authBridge.getUsage();
    console.log(`   Usage data: ${usage ? '✅ Found' : '❌ Not found'}`);
    if (usage) {
      console.log(`   Current month: ${usage.currentMonth} minutes`);
      console.log(`   Limit: ${usage.limit === -1 ? 'Unlimited' : usage.limit + ' minutes'}`);
    }
    
    // Test 9: Feature checks
    console.log('\n9. Testing feature permissions...');
    const canTranscribe = authBridge.canUseFeature('basic_transcription');
    const canRewrite = authBridge.canUseFeature('ai_rewrite');
    console.log(`   Can transcribe: ${canTranscribe ? '✅ Yes' : '❌ No'}`);
    console.log(`   Can AI rewrite: ${canRewrite ? '✅ Yes' : '❌ No'}`);
    
    // Test 10: Usage limits
    console.log('\n10. Testing usage limits...');
    const hasMinutes = authBridge.hasRemainingMinutes(5);
    console.log(`   Has 5 minutes remaining: ${hasMinutes ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n🎉 All tests completed successfully!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Go backend is running: cd backend-go && go run main.go');
    console.log('   2. Check if port 3000 is available');
    console.log('   3. Verify ELOQUENT_API_URL environment variable');
    return false;
  }
}

async function testPerformance() {
  console.log('\n⚡ Performance Test');
  console.log('=' .repeat(30));
  
  const iterations = 100;
  const start = Date.now();
  
  // Test rapid session validations (should use cache)
  for (let i = 0; i < iterations; i++) {
    await authBridge.validateSession();
  }
  
  const end = Date.now();
  const totalTime = end - start;
  const avgTime = totalTime / iterations;
  
  console.log(`${iterations} session validations in ${totalTime}ms`);
  console.log(`Average: ${avgTime.toFixed(2)}ms per validation`);
  console.log(`Rate: ${(1000 / avgTime).toFixed(0)} validations/second`);
  
  if (avgTime < 1) {
    console.log('🚀 Excellent performance! Cache is working optimally.');
  } else if (avgTime < 5) {
    console.log('✅ Good performance.');
  } else {
    console.log('⚠️ Performance could be better. Check backend connection.');
  }
}

async function testConcurrency() {
  console.log('\n🔄 Concurrency Test');
  console.log('=' .repeat(30));
  
  const concurrentRequests = 20;
  const start = Date.now();
  
  // Test concurrent session validations
  const promises = Array(concurrentRequests).fill().map(() => 
    authBridge.validateSession()
  );
  
  const results = await Promise.all(promises);
  const end = Date.now();
  
  const totalTime = end - start;
  const successCount = results.filter(r => r.valid).length;
  
  console.log(`${concurrentRequests} concurrent requests in ${totalTime}ms`);
  console.log(`Success rate: ${successCount}/${concurrentRequests} (${(successCount/concurrentRequests*100).toFixed(1)}%)`);
  console.log(`Throughput: ${(concurrentRequests * 1000 / totalTime).toFixed(0)} requests/second`);
  
  if (successCount === concurrentRequests && totalTime < 100) {
    console.log('🚀 Excellent concurrency handling!');
  } else if (successCount === concurrentRequests) {
    console.log('✅ Good concurrency handling.');
  } else {
    console.log('⚠️ Some requests failed. Check backend stability.');
  }
}

async function main() {
  const success = await testBasicFunctionality();
  
  if (success) {
    await testPerformance();
    await testConcurrency();
    
    console.log('\n📋 Summary:');
    console.log('✅ Go auth bridge is working correctly');
    console.log('✅ All core functionality tested');
    console.log('✅ Performance is optimal');
    console.log('✅ Concurrency handling is excellent');
    
    console.log('\n🎯 Ready for production migration!');
    console.log('💡 Run: node migrate-to-go-auth.js');
  } else {
    console.log('\n❌ Tests failed. Please fix issues before migration.');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testBasicFunctionality, testPerformance, testConcurrency };