#!/usr/bin/env node

// Eloquent Dependencies Checker
// Verifies all required dependencies are installed and configured

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Eloquent Dependencies Checker');
console.log('================================\n');

let allGood = true;

// Check Node.js version
function checkNodeVersion() {
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
        console.log(`✅ Node.js ${nodeVersion} (required: 18+)`);
    } else {
        console.log(`❌ Node.js ${nodeVersion} (required: 18+)`);
        console.log('   Please update Node.js: https://nodejs.org/');
        allGood = false;
    }
}

// Check Go installation
function checkGo() {
    try {
        const goVersion = execSync('go version', { encoding: 'utf8' }).trim();
        const versionMatch = goVersion.match(/go(\d+\.\d+)/);
        if (versionMatch) {
            const version = parseFloat(versionMatch[1]);
            if (version >= 1.21) {
                console.log(`✅ ${goVersion} (required: 1.21+)`);
            } else {
                console.log(`❌ ${goVersion} (required: 1.21+)`);
                console.log('   Please update Go: https://golang.org/dl/');
                allGood = false;
            }
        } else {
            console.log(`✅ Go installed: ${goVersion}`);
        }
    } catch (error) {
        console.log('❌ Go not found');
        console.log('   Please install Go 1.21+: https://golang.org/dl/');
        allGood = false;
    }
}

// Check npm dependencies
function checkNpmDependencies() {
    if (fs.existsSync('node_modules')) {
        console.log('✅ npm dependencies installed');
    } else {
        console.log('❌ npm dependencies not installed');
        console.log('   Run: npm install');
        allGood = false;
    }
}

// Check Go dependencies
function checkGoDependencies() {
    const goModPath = path.join('backend-go', 'go.mod');
    const goSumPath = path.join('backend-go', 'go.sum');
    
    if (fs.existsSync(goModPath)) {
        if (fs.existsSync(goSumPath)) {
            console.log('✅ Go dependencies installed');
        } else {
            console.log('❌ Go dependencies not installed');
            console.log('   Run: cd backend-go && go mod tidy');
            allGood = false;
        }
    } else {
        console.log('❌ Go module not found');
        console.log('   backend-go/go.mod is missing');
        allGood = false;
    }
}

// Check configuration
function checkConfiguration() {
    if (fs.existsSync('.env')) {
        const envContent = fs.readFileSync('.env', 'utf8');
        
        // Check for Groq API key
        const hasGroqKey = envContent.includes('gsk_');
        if (hasGroqKey) {
            console.log('✅ Groq API key configured');
        } else {
            console.log('⚠️  Groq API key not configured');
            console.log('   Get one at: https://console.groq.com');
        }
        
        // Check for Supabase configuration
        const hasSupabase = envContent.includes('supabase.co') && !envContent.includes('your-project');
        if (hasSupabase) {
            console.log('✅ Supabase configured');
        } else {
            console.log('⚠️  Supabase not configured (will use development mode)');
            console.log('   Configure at: https://supabase.com/dashboard');
        }
    } else {
        console.log('⚠️  .env file not found (will use development mode)');
        console.log('   Run: ./setup-production.sh to configure');
    }
}

// Check macOS specific tools
function checkMacOSTools() {
    if (process.platform === 'darwin') {
        try {
            execSync('which sox', { stdio: 'ignore' });
            console.log('✅ sox audio tool installed');
        } catch (error) {
            console.log('❌ sox audio tool not found');
            console.log('   Install with: brew install sox');
            allGood = false;
        }
        
        try {
            execSync('which tccutil', { stdio: 'ignore' });
            console.log('✅ tccutil permissions tool available');
        } catch (error) {
            console.log('⚠️  tccutil not available (macOS permissions management limited)');
        }
    } else {
        console.log('⚠️  Not running on macOS (some features may not work)');
    }
}

// Check optional tools
function checkOptionalTools() {
    console.log('\n📦 Optional Tools:');
    
    try {
        execSync('which brew', { stdio: 'ignore' });
        console.log('✅ Homebrew installed');
    } catch (error) {
        console.log('⚠️  Homebrew not installed (recommended for macOS)');
        console.log('   Install at: https://brew.sh/');
    }
    
    try {
        execSync('which git', { stdio: 'ignore' });
        console.log('✅ Git installed');
    } catch (error) {
        console.log('⚠️  Git not installed');
    }
}

// Run all checks
console.log('🔧 Core Dependencies:');
checkNodeVersion();
checkGo();
checkNpmDependencies();
checkGoDependencies();

console.log('\n⚙️  Configuration:');
checkConfiguration();

console.log('\n🖥️  System Tools:');
checkMacOSTools();

checkOptionalTools();

console.log('\n' + '='.repeat(40));

if (allGood) {
    console.log('🎉 All required dependencies are ready!');
    console.log('\nNext steps:');
    console.log('1. Start development: ./start-dev.sh');
    console.log('2. Or configure production: ./setup-production.sh');
} else {
    console.log('❌ Some dependencies need attention.');
    console.log('\nPlease install missing dependencies and run this check again.');
}

console.log('\n📚 For help, see: QUICKSTART.md');

process.exit(allGood ? 0 : 1);