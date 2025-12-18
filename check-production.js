#!/usr/bin/env node

// Quick Production Mode Checker
// Run this anytime to check if your app is configured for production

const fs = require('fs');

console.log('🔍 Production Mode Status Check');
console.log('===============================');
console.log('');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('❌ No .env file found');
  console.log('💡 Run: ./configure-production.sh to set up');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

// Quick checks
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const groqKey = process.env.GROQ_API_KEY_1;

let isProduction = true;
let issues = [];

// Check Supabase URL
if (!supabaseUrl || supabaseUrl.includes('your-project.supabase.co')) {
  isProduction = false;
  issues.push('Supabase URL not configured');
}

// Check Supabase Key
if (!supabaseKey || supabaseKey === 'your-anon-key') {
  isProduction = false;
  issues.push('Supabase anon key not configured');
}

// Check Groq Key
if (!groqKey || groqKey.includes('your_api_key_here')) {
  isProduction = false;
  issues.push('Groq API key not configured');
}

if (isProduction) {
  console.log('✅ PRODUCTION MODE ENABLED');
  console.log('');
  console.log('🎯 Your app will use:');
  console.log('   • Real Google OAuth authentication');
  console.log('   • Supabase user management');
  console.log('   • Groq AI transcription');
  console.log('');
  console.log('🚀 Start with: npm start');
} else {
  console.log('🔧 DEVELOPMENT MODE ACTIVE');
  console.log('');
  console.log('❌ Issues found:');
  issues.forEach(issue => console.log(`   • ${issue}`));
  console.log('');
  console.log('🔧 To enable production mode:');
  console.log('   1. Run: ./configure-production.sh');
  console.log('   2. Or manually edit .env file');
  console.log('   3. See QUICK_PRODUCTION_SETUP.md for help');
}

console.log('');