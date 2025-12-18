#!/usr/bin/env node

// Test script to verify production OAuth configuration
const axios = require('axios');
require('dotenv').config();

async function testProductionOAuth() {
  console.log('🧪 Testing Production OAuth Configuration');
  console.log('=====================================');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const redirectUrl = process.env.OAUTH_REDIRECT_URL;
  const backendUrl = process.env.ELOQUENT_API_URL;
  
  console.log('📋 Configuration:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Supabase Key: ${supabaseKey ? supabaseKey.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`   Redirect URL: ${redirectUrl}`);
  console.log(`   Backend URL: ${backendUrl}`);
  console.log('');
  
  // Test 1: Check if Supabase is accessible
  console.log('🔍 Test 1: Supabase Connectivity');
  try {
    const response = await axios.get(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    });
    console.log('   ✅ Supabase is accessible');
  } catch (error) {
    console.log('   ❌ Supabase connection failed:', error.message);
    return;
  }
  
  // Test 2: Check if backend is accessible
  console.log('🔍 Test 2: Backend Connectivity');
  try {
    const response = await axios.get(`${backendUrl}/health`);
    console.log('   ✅ Backend is accessible');
    console.log('   📊 Backend status:', response.data);
  } catch (error) {
    console.log('   ❌ Backend connection failed:', error.message);
    return;
  }
  
  // Test 3: Check OAuth callback endpoint
  console.log('🔍 Test 3: OAuth Callback Endpoint');
  try {
    const response = await axios.get(`${backendUrl}/api/auth/callback`);
    console.log('   ✅ OAuth callback endpoint is accessible');
  } catch (error) {
    if (error.response?.status === 200) {
      console.log('   ✅ OAuth callback endpoint is accessible');
    } else {
      console.log('   ⚠️ OAuth callback returned:', error.response?.status || error.message);
    }
  }
  
  // Test 4: Generate OAuth URL
  console.log('🔍 Test 4: Generate OAuth URL');
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent'
        }
      }
    });
    
    if (error) throw error;
    
    console.log('   ✅ OAuth URL generated successfully');
    console.log('   🔗 OAuth URL:', data.url);
    console.log('');
    console.log('🎉 All tests passed! Your production OAuth should work.');
    console.log('');
    console.log('📝 Next steps:');
    console.log('   1. Make sure these URLs are added to Supabase Auth settings:');
    console.log(`      - ${redirectUrl}`);
    console.log('   2. Deploy your backend with the OAuth callback handler');
    console.log('   3. Test the full OAuth flow in your Electron app');
    
  } catch (error) {
    console.log('   ❌ OAuth URL generation failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check your Supabase credentials');
    console.log('   2. Verify Google OAuth is enabled in Supabase');
    console.log('   3. Ensure redirect URL is whitelisted in Supabase');
  }
}

// Run the test
testProductionOAuth().catch(console.error);