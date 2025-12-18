#!/usr/bin/env node

// Full Integration Test Suite for Eloquent
// Tests frontend, backend, authentication, and API endpoints

const axios = require('axios');
const fs = require('fs');
const path = require('path');

console.log('🧪 Eloquent Full Integration Test Suite');
console.log('=======================================');
console.log('');

// Load environment variables
require('dotenv').config();

const CONFIG = {
  backendURL: process.env.ELOQUENT_API_URL || 'https://agile-basin-06335-9109082620ce.herokuapp.com',
  supabaseURL: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_ANON_KEY,
  groqAPIKey: process.env.GROQ_API_KEY_1
};

let testResults = {
  passed: 0,
  failed: 0,
  total: 0
};

function logTest(name, passed, message = '') {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${name}: ${message}`);
  }
}

async function testBackendHealth() {
  console.log('🏥 Testing Backend Health...');
  try {
    const response = await axios.get(`${CONFIG.backendURL}/health`, { timeout: 5000 });
    logTest('Backend Health Check', response.status === 200 && response.data.status === 'ok');
  } catch (error) {
    logTest('Backend Health Check', false, error.message);
  }
}

async function testAPIEndpoints() {
  console.log('🌐 Testing API Endpoints...');
  
  const endpoints = [
    { method: 'GET', path: '/health', expectStatus: 200 },
    { method: 'POST', path: '/api/auth/google', expectStatus: 400 }, // Should fail without proper data
    { method: 'GET', path: '/api/subscriptions/status', expectStatus: 401 }, // Should fail without auth
  ];

  for (const endpoint of endpoints) {
    try {
      const config = { 
        method: endpoint.method.toLowerCase(),
        url: `${CONFIG.backendURL}${endpoint.path}`,
        timeout: 5000,
        validateStatus: () => true // Don't throw on non-2xx status
      };

      const response = await axios(config);
      const passed = response.status === endpoint.expectStatus;
      logTest(`${endpoint.method} ${endpoint.path}`, passed, 
        passed ? '' : `Expected ${endpoint.expectStatus}, got ${response.status}`);
    } catch (error) {
      logTest(`${endpoint.method} ${endpoint.path}`, false, error.message);
    }
  }
}

async function testEnvironmentConfig() {
  console.log('⚙️ Testing Environment Configuration...');
  
  // Test required environment variables
  const requiredVars = [
    { name: 'ELOQUENT_API_URL', value: CONFIG.backendURL },
    { name: 'SUPABASE_URL', value: CONFIG.supabaseURL },
    { name: 'SUPABASE_ANON_KEY', value: CONFIG.supabaseKey },
    { name: 'GROQ_API_KEY_1', value: CONFIG.groqAPIKey }
  ];

  for (const envVar of requiredVars) {
    const isSet = envVar.value && envVar.value !== '' && !envVar.value.includes('your-');
    logTest(`Environment Variable: ${envVar.name}`, isSet, 
      isSet ? '' : 'Not set or using placeholder value');
  }
}

async function testFileStructure() {
  console.log('📁 Testing File Structure...');
  
  const requiredFiles = [
    'main.js',
    'auth-service.js',
    'package.json',
    '.env',
    'backend-go/main.go',
    'backend-go/go.mod'
  ];

  for (const file of requiredFiles) {
    const exists = fs.existsSync(path.join(__dirname, file));
    logTest(`File exists: ${file}`, exists);
  }
}

async function testDependencies() {
  console.log('📦 Testing Dependencies...');
  
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const requiredDeps = ['electron', '@supabase/supabase-js', 'axios', 'dotenv'];
    
    for (const dep of requiredDeps) {
      const hasDevDep = packageJson.devDependencies && packageJson.devDependencies[dep];
      const hasDep = packageJson.dependencies && packageJson.dependencies[dep];
      logTest(`Dependency: ${dep}`, hasDevDep || hasDep);
    }
  } catch (error) {
    logTest('Package.json parsing', false, error.message);
  }
}

async function testProductionReadiness() {
  console.log('🚀 Testing Production Readiness...');
  
  // Check if using production URLs
  const isProdBackend = CONFIG.backendURL.includes('herokuapp.com') || 
                       CONFIG.backendURL.includes('your-domain.com');
  logTest('Production Backend URL', isProdBackend);
  
  // Check if using real Supabase
  const isProdSupabase = CONFIG.supabaseURL && 
                        CONFIG.supabaseURL.includes('.supabase.co') && 
                        !CONFIG.supabaseURL.includes('your-project');
  logTest('Production Supabase URL', isProdSupabase);
  
  // Check if using real API keys
  const hasRealGroqKey = CONFIG.groqAPIKey && 
                        CONFIG.groqAPIKey.startsWith('gsk_') && 
                        !CONFIG.groqAPIKey.includes('your_api_key');
  logTest('Real Groq API Key', hasRealGroqKey);
}

async function runAllTests() {
  console.log('Starting comprehensive integration tests...\n');
  
  await testFileStructure();
  console.log('');
  
  await testDependencies();
  console.log('');
  
  await testEnvironmentConfig();
  console.log('');
  
  await testBackendHealth();
  console.log('');
  
  await testAPIEndpoints();
  console.log('');
  
  await testProductionReadiness();
  console.log('');
  
  // Summary
  console.log('📊 Test Results Summary');
  console.log('======================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
  console.log('');
  
  if (testResults.failed === 0) {
    console.log('🎉 All tests passed! Your integration is working correctly.');
    console.log('');
    console.log('🚀 Ready for production deployment!');
    console.log('   - Frontend: Electron app with all dependencies');
    console.log('   - Backend: Go API deployed on Heroku');
    console.log('   - Database: Supabase configured');
    console.log('   - Authentication: Ready for OAuth flow');
  } else {
    console.log('⚠️ Some tests failed. Please review the issues above.');
    console.log('');
    console.log('🔧 Common fixes:');
    console.log('   - Run: ./setup-production.sh');
    console.log('   - Edit .env with real credentials');
    console.log('   - Check network connectivity');
    console.log('   - Verify Heroku deployment status');
  }
  
  console.log('');
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error('❌ Test suite failed:', error.message);
  process.exit(1);
});