#!/usr/bin/env node

// Test OAuth URL generation
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function testOAuthURL() {
  console.log('🧪 Testing OAuth URL Generation');
  console.log('==============================');
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;
  const redirectUrl = process.env.OAUTH_REDIRECT_URL;
  
  console.log('📋 Configuration:');
  console.log(`   Supabase URL: ${supabaseUrl}`);
  console.log(`   Redirect URL: ${redirectUrl}`);
  console.log('');
  
  try {
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
    
    console.log('✅ OAuth URL Generated Successfully!');
    console.log('🔗 OAuth URL:');
    console.log(data.url);
    console.log('');
    console.log('🧪 Test this URL in your browser:');
    console.log(`   1. Copy the URL above`);
    console.log(`   2. Paste it in your browser`);
    console.log(`   3. Complete Google sign-in`);
    console.log(`   4. You should be redirected to: ${redirectUrl}`);
    console.log('');
    console.log('✅ If the redirect works, your OAuth is configured correctly!');
    
  } catch (error) {
    console.log('❌ Error generating OAuth URL:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check your Supabase credentials in .env');
    console.log('   2. Verify Google OAuth is enabled in Supabase dashboard');
    console.log('   3. Ensure redirect URL is whitelisted in Supabase');
  }
}

testOAuthURL().catch(console.error);