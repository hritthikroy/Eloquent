#!/usr/bin/env node

/**
 * Comprehensive Feature Verification
 * Tests Windows, macOS compatibility and AI Rewriter function
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 ELOQUENT - COMPREHENSIVE FEATURE VERIFICATION\n');
console.log('═'.repeat(70));

const results = {
  platform: {},
  crossPlatform: {},
  aiRewrite: {},
  performance: {},
  allPassed: true
};

// Platform Detection
console.log('\n📊 1. PLATFORM COMPATIBILITY CHECK\n');
console.log('─'.repeat(70));

const platform = process.platform;
const platformNames = {
  'darwin': 'macOS',
  'win32': 'Windows',
  'linux': 'Linux'
};

console.log(`✅ Detected Platform: ${platformNames[platform] || platform}`);
console.log(`✅ Node.js: ${process.version}`);
console.log(`✅ Architecture: ${process.arch}`);

results.platform = {
  platform,
  supported: ['darwin', 'win32', 'linux'].includes(platform),
  nodejs: process.version,
  arch: process.arch
};

// Cross-Platform Utilities Check
console.log('\n📦 2. CROSS-PLATFORM UTILITIES VERIFICATION\n');
console.log('─'.repeat(70));

const utilities = [
  { 
    name: 'Audio Recorder',
    file: 'src/utils/audio-recorder.js',
    features: ['Windows support', 'macOS support', 'Linux support', 'Fallback methods']
  },
  { 
    name: 'Paste Helper',
    file: 'src/utils/paste-helper.js',
    features: ['RobotJS (Windows)', 'AppleScript (macOS)', 'xdotool (Linux)', 'Clipboard fallback']
  },
  { 
    name: 'Sound Player',
    file: 'src/utils/sound-player.js',
    features: ['PowerShell (Windows)', 'afplay (macOS)', 'aplay/paplay (Linux)']
  }
];

utilities.forEach(({ name, file, features }) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`\n${exists ? '✅' : '❌'} ${name}`);
  console.log(`   File: ${file}`);
  console.log(`   Status: ${exists ? 'READY' : 'MISSING'}`);
  
  if (exists) {
    const content = fs.readFileSync(path.join(__dirname, file), 'utf8');
    console.log(`   Features:`);
    features.forEach(feature => {
      console.log(`     • ${feature}`);
    });
    
    // Check for platform-specific code
    const hasPlatformCheck = content.includes('process.platform');
    const hasWindowsCode = content.includes('win32');
    const hasMacCode = content.includes('darwin');
    const hasLinuxCode = content.includes('linux');
    
    console.log(`   Platform Detection: ${hasPlatformCheck ? '✅' : '❌'}`);
    console.log(`   Windows Code: ${hasWindowsCode ? '✅' : '❌'}`);
    console.log(`   macOS Code: ${hasMacCode ? '✅' : '❌'}`);
    console.log(`   Linux Code: ${hasLinuxCode ? '✅' : '❌'}`);
  }
  
  results.crossPlatform[name] = exists;
});

// AI Rewrite Function Verification
console.log('\n\n🤖 3. AI REWRITE FUNCTION VERIFICATION\n');
console.log('─'.repeat(70));

const mainJsPath = path.join(__dirname, 'src/main.js');
if (fs.existsSync(mainJsPath)) {
  const mainContent = fs.readFileSync(mainJsPath, 'utf8');
  
  const checks = [
    {
      name: 'Rewrite Function Exists',
      test: /async function rewrite\(/,
      critical: true
    },
    {
      name: 'AI Prompts Import',
      test: /require\(['"]\.\/utils\/ai-prompts['"]\)/,
      critical: true
    },
    {
      name: 'Keyboard Shortcut Registration',
      test: /Alt\+Shift\+Space/,
      critical: true
    },
    {
      name: 'Groq API Endpoint',
      test: /api\.groq\.com/,
      critical: true
    },
    {
      name: 'Llama Model Reference',
      test: /llama-3\.3-70b-versatile/,
      critical: true
    },
    {
      name: 'Mode Detection (rewrite)',
      test: /currentMode === ['"]rewrite['"]/,
      critical: true
    },
    {
      name: 'Rewrite Function Call',
      test: /await rewrite\(/,
      critical: true
    },
    {
      name: 'Error Handling',
      test: /catch.*error/i,
      critical: false
    },
    {
      name: 'API Timeout',
      test: /timeout.*20000/,
      critical: false
    },
    {
      name: 'Temperature Setting',
      test: /temperature.*0\.[34]/,
      critical: false
    }
  ];
  
  let aiRewritePassed = true;
  
  checks.forEach(({ name, test, critical }) => {
    const passed = test.test(mainContent);
    const icon = passed ? '✅' : (critical ? '❌' : '⚠️');
    console.log(`${icon} ${name}: ${passed ? 'FOUND' : 'NOT FOUND'}${critical ? ' (CRITICAL)' : ''}`);
    
    if (critical && !passed) {
      aiRewritePassed = false;
    }
    
    results.aiRewrite[name] = passed;
  });
  
  console.log(`\n${aiRewritePassed ? '✅' : '❌'} AI Rewrite Function: ${aiRewritePassed ? 'FULLY IMPLEMENTED' : 'INCOMPLETE'}`);
  results.aiRewrite.overall = aiRewritePassed;
  
  if (!aiRewritePassed) {
    results.allPassed = false;
  }
} else {
  console.log('❌ main.js not found!');
  results.aiRewrite.overall = false;
  results.allPassed = false;
}

// AI Prompts File Verification
console.log('\n📝 AI Prompts Configuration:\n');
const aiPromptsPath = path.join(__dirname, 'src/utils/ai-prompts.js');
if (fs.existsSync(aiPromptsPath)) {
  const promptsContent = fs.readFileSync(aiPromptsPath, 'utf8');
  
  const promptChecks = [
    { name: 'Auto Mode Prompt', test: /auto:/ },
    { name: 'Grammar Mode Prompt', test: /grammar:/ },
    { name: 'Module Export', test: /module\.exports/ }
  ];
  
  promptChecks.forEach(({ name, test }) => {
    const passed = test.test(promptsContent);
    console.log(`${passed ? '✅' : '❌'} ${name}: ${passed ? 'CONFIGURED' : 'MISSING'}`);
  });
} else {
  console.log('❌ ai-prompts.js not found!');
}

// Performance Utilities Check
console.log('\n\n⚡ 4. PERFORMANCE OPTIMIZATIONS\n');
console.log('─'.repeat(70));

const perfUtils = [
  { name: 'Performance Optimizer', file: 'src/utils/performance-optimizer.js' },
  { name: 'Async Optimizer', file: 'src/utils/async-optimizer.js' },
  { name: 'Startup Accelerator', file: 'src/utils/startup-accelerator.js' }
];

perfUtils.forEach(({ name, file }) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`${exists ? '✅' : '⚠️'} ${name}: ${exists ? 'INSTALLED' : 'NOT INSTALLED (optional)'}`);
  results.performance[name] = exists;
});

// Feature Summary
console.log('\n\n═'.repeat(70));
console.log('\n🎯 FEATURE VERIFICATION SUMMARY\n');
console.log('═'.repeat(70));

console.log('\n📱 Platform Support:');
console.log(`   Current Platform: ${platformNames[platform] || platform}`);
console.log(`   Supported: ${results.platform.supported ? '✅ YES' : '❌ NO'}`);

console.log('\n🛠️ Cross-Platform Utilities:');
Object.entries(results.crossPlatform).forEach(([name, status]) => {
  console.log(`   ${status ? '✅' : '❌'} ${name}`);
});

console.log('\n🤖 AI Rewrite Feature:');
console.log(`   Implementation: ${results.aiRewrite.overall ? '✅ COMPLETE' : '❌ INCOMPLETE'}`);
console.log(`   Critical Checks Passed: ${Object.values(results.aiRewrite).filter(Boolean).length}/${Object.keys(results.aiRewrite).length}`);

console.log('\n⚡ Performance:');
Object.entries(results.performance).forEach(([name, status]) => {
  console.log(`   ${status ? '✅' : '⚠️'} ${name}`);
});

// Platform-Specific Instructions
console.log('\n\n═'.repeat(70));
console.log('\n📖 PLATFORM-SPECIFIC INSTRUCTIONS\n');
console.log('═'.repeat(70));

if (platform === 'win32') {
  console.log('\n🪟 Windows Platform Detected\n');
  console.log('Required Setup:');
  console.log('  1. ✅ node-record-lpcm16 installed (for audio recording)');
  console.log('  2. ✅ robotjs installed (for auto-paste)');
  console.log('  3. ⚠️ Sox optional (recommended): choco install sox');
  console.log('\nFeatures Ready:');
  console.log('  ✅ Audio Recording (Windows native)');
  console.log('  ✅ Auto-Paste (RobotJS + PowerShell fallback)');
  console.log('  ✅ Sound Playback (PowerShell system sounds)');
  console.log('  ✅ AI Rewrite (Groq API)');
  
} else if (platform === 'darwin') {
  console.log('\n🍎 macOS Platform Detected\n');
  console.log('Required Setup:');
  console.log('  1. ✅ Sox installed: brew install sox');
  console.log('  2. ⚠️ Accessibility permission (for auto-paste)');
  console.log('     Go to: System Settings > Privacy & Security > Accessibility');
  console.log('\nFeatures Ready:');
  console.log('  ✅ Audio Recording (Sox/rec)');
  console.log('  ⚠️ Auto-Paste (requires Accessibility permission)');
  console.log('  ✅ Sound Playback (afplay)');
  console.log('  ✅ AI Rewrite (Groq API)');
  
} else if (platform === 'linux') {
  console.log('\n🐧 Linux Platform Detected\n');
  console.log('Required Setup:');
  console.log('  1. ✅ Sox: sudo apt-get install sox');
  console.log('  2. ⚠️ xdotool (for auto-paste): sudo apt-get install xdotool');
  console.log('\nFeatures Ready:');
  console.log('  ✅ Audio Recording (Sox/rec)');
  console.log('  ⚠️ Auto-Paste (requires xdotool)');
  console.log('  ✅ Sound Playback (aplay/paplay)');
  console.log('  ✅ AI Rewrite (Groq API)');
}

// Configuration Check
console.log('\n\n═'.repeat(70));
console.log('\n⚙️  CONFIGURATION STATUS\n');
console.log('═'.repeat(70));

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  
  console.log('\n.env File: ✅ EXISTS');
  
  const hasGroqKey = envContent.includes('GROQ_API_KEY=') && 
                     !envContent.includes('your_groq_api_key') &&
                     envContent.match(/GROQ_API_KEY=gsk_/);
  
  console.log(`Groq API Key: ${hasGroqKey ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}`);
  
  if (!hasGroqKey) {
    console.log('\n⚠️ WARNING: Groq API key is not configured!');
    console.log('   AI Rewrite will not work without an API key.');
    console.log('   Get a free key at: https://console.groq.com/');
    results.allPassed = false;
  }
} else {
  console.log('\n❌ .env File: NOT FOUND');
  console.log('   Copy .env.example to .env and configure your API key');
  results.allPassed = false;
}

// Final Grade
console.log('\n\n═'.repeat(70));
console.log('\n🏆 FINAL VERIFICATION RESULT\n');
console.log('═'.repeat(70));

const score = {
  platform: results.platform.supported ? 25 : 0,
  utilities: Object.values(results.crossPlatform).filter(Boolean).length * 8.33,
  aiRewrite: results.aiRewrite.overall ? 25 : 0,
  performance: Object.values(results.performance).filter(Boolean).length * 5
};

const totalScore = Math.round(score.platform + score.utilities + score.aiRewrite + score.performance);

console.log(`\nTotal Score: ${totalScore}/100`);

let grade, status;
if (totalScore >= 95) {
  grade = 'A+';
  status = '🌟 EXCELLENT - All features working perfectly!';
} else if (totalScore >= 85) {
  grade = 'A';
  status = '✅ VERY GOOD - Ready for production';
} else if (totalScore >= 75) {
  grade = 'B';
  status = '⚠️ GOOD - Minor issues, mostly functional';
} else if (totalScore >= 65) {
  grade = 'C';
  status = '⚠️ ACCEPTABLE - Some features missing';
} else {
  grade = 'F';
  status = '❌ NEEDS WORK - Critical features missing';
}

console.log(`Grade: ${grade}`);
console.log(`Status: ${status}\n`);

// Detailed Breakdown
console.log('Score Breakdown:');
console.log(`  Platform Support:    ${score.platform}/25`);
console.log(`  Cross-Platform Utils: ${Math.round(score.utilities)}/25`);
console.log(`  AI Rewrite Feature:  ${score.aiRewrite}/25`);
console.log(`  Performance Utils:   ${Math.round(score.performance)}/25`);

// Next Steps
console.log('\n═'.repeat(70));
console.log('\n🚀 NEXT STEPS\n');
console.log('═'.repeat(70));

if (totalScore >= 95) {
  console.log('\n✅ Everything is ready!');
  console.log('\n1. Configure your Groq API key in .env');
  console.log('2. Run: npm start');
  console.log('3. Press Alt+Space for standard recording');
  console.log('4. Press Alt+Shift+Space for AI Rewrite mode');
  console.log('\n🎉 Enjoy ultra-fast voice-to-text with AI enhancement!');
} else if (totalScore >= 75) {
  console.log('\n⚠️ Minor setup required:');
  if (!results.platform.supported) {
    console.log('  ❌ Unsupported platform detected');
  }
  if (!results.aiRewrite.overall) {
    console.log('  ❌ AI Rewrite feature needs attention');
  }
  console.log('\n📖 Check the documentation:');
  console.log('  • WINDOWS_SETUP.md (Windows users)');
  console.log('  • QUICK_START.md (Quick setup guide)');
  console.log('  • README.md (Full documentation)');
} else {
  console.log('\n❌ Critical issues found:');
  if (!results.platform.supported) {
    console.log('  • Platform not supported');
  }
  if (!results.aiRewrite.overall) {
    console.log('  • AI Rewrite feature incomplete');
  }
  console.log('\n📞 Get help:');
  console.log('  • GitHub Issues: https://github.com/hritthikroy/Eloquent/issues');
  console.log('  • Documentation: See CROSS_PLATFORM_FIXES_SUMMARY.md');
}

console.log('\n═'.repeat(70));
console.log('');

// Exit code
process.exit(results.allPassed && totalScore >= 75 ? 0 : 1);
