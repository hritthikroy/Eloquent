#!/usr/bin/env node

// Production Mode Validator
// This script checks if your environment is properly configured for production

const fs = require('fs');
const path = require('path');

console.log('🔍 Eloquent Production Mode Validator');
console.log('=====================================');
console.log('');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('❌ .env file not found');
  console.log('💡 Run: ./setup-production.sh to create one');
  process.exit(1);
}

// Load environment variables
require('dotenv').config();

const checks = [
  {
    name: 'Supabase URL',
    key: 'SUPABASE_URL',
    validate: (value) => {
      if (!value) return { valid: false, message: 'Not set' };
      if (value.includes('your-project.supabase.co')) return { valid: false, message: 'Using placeholder URL' };
      if (!value.startsWith('https://')) return { valid: false, message: 'Must start with https://' };
      if (!value.includes('.supabase.co')) return { valid: false, message: 'Must be a Supabase URL' };
      return { valid: true, message: 'Valid Supabase URL' };
    }
  },
  {
    name: 'Supabase Anon Key',
    key: 'SUPABASE_ANON_KEY',
    validate: (value) => {
      if (!value) return { valid: false, message: 'Not set' };
      if (value === 'your-anon-key') return { valid: false, message: 'Using placeholder key' };
      if (!value.startsWith('eyJ')) return { valid: false, message: 'Invalid JWT format' };
      if (value.length < 100) return { valid: false, message: 'Key too short' };
      return { valid: true, message: 'Valid anon key' };
    }
  },
  {
    name: 'Groq API Key',
    key: 'GROQ_API_KEY_1',
    validate: (value) => {
      if (!value) return { valid: false, message: 'Not set' };
      if (value.includes('your_api_key_here')) return { valid: false, message: 'Using placeholder key' };
      if (!value.startsWith('gsk_')) return { valid: false, message: 'Invalid Groq key format' };
      return { valid: true, message: 'Valid Groq API key' };
    }
  }
];

let allValid = true;

console.log('Checking configuration...');
console.log('');

checks.forEach(check => {
  const value = process.env[check.key];
  const result = check.validate(value);
  
  const status = result.valid ? '✅' : '❌';
  console.log(`${status} ${check.name}: ${result.message}`);
  
  if (!result.valid) {
    allValid = false;
  }
});

console.log('');

if (allValid) {
  console.log('🎉 All checks passed! Your app is configured for production mode.');
  console.log('');
  console.log('🚀 Start the app with: npm start');
  console.log('');
  console.log('Expected behavior:');
  console.log('  - No "Development mode" messages in console');
  console.log('  - Google sign-in redirects to real Google OAuth');
  console.log('  - Real user authentication and data storage');
} else {
  console.log('⚠️  Some configuration issues found.');
  console.log('');
  console.log('🔧 To fix:');
  console.log('  1. Run: ./setup-production.sh');
  console.log('  2. Follow PRODUCTION_SETUP.md guide');
  console.log('  3. Edit .env with your real credentials');
  console.log('');
  console.log('📚 Need help? Check PRODUCTION_SETUP.md for detailed instructions');
}

console.log('');