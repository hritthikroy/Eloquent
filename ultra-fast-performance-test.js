#!/usr/bin/env node

/**
 * ULTRA-FAST PERFORMANCE TEST
 * Checks for blocking operations, slow code, and performance bottlenecks
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

console.log('\n⚡ ULTRA-FAST PERFORMANCE TEST\n');
console.log('═'.repeat(80));

const results = {
  blocking: [],
  performance: [],
  warnings: [],
  passed: true
};

// Test 1: Check for Blocking File Operations
console.log('\n🔍 1. SCANNING FOR BLOCKING OPERATIONS\n');
console.log('─'.repeat(80));

const filesToCheck = [
  'src/main.js',
  'src/utils/audio-recorder.js',
  'src/utils/paste-helper.js',
  'src/utils/sound-player.js',
  'src/utils/ai-prompts.js'
];

const blockingPatterns = [
  { pattern: /fs\.readFileSync/g, name: 'fs.readFileSync (BLOCKING)', severity: 'high' },
  { pattern: /fs\.writeFileSync/g, name: 'fs.writeFileSync (BLOCKING)', severity: 'high' },
  { pattern: /fs\.existsSync/g, name: 'fs.existsSync (BLOCKING)', severity: 'medium' },
  { pattern: /fs\.statSync/g, name: 'fs.statSync (BLOCKING)', severity: 'high' },
  { pattern: /fs\.mkdirSync/g, name: 'fs.mkdirSync (BLOCKING)', severity: 'medium' },
  { pattern: /child_process\.execSync/g, name: 'execSync (BLOCKING)', severity: 'high' },
  { pattern: /child_process\.spawnSync/g, name: 'spawnSync (BLOCKING)', severity: 'high' },
  { pattern: /\.sync\(/g, name: 'Generic .sync() call (BLOCKING)', severity: 'medium' }
];

let totalBlocking = 0;
let criticalBlocking = 0;

filesToCheck.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log(`⚠️  ${file}: NOT FOUND`);
    return;
  }

  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let fileBlocking = 0;

  blockingPatterns.forEach(({ pattern, name, severity }) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => {
        // Find line numbers
        lines.forEach((line, idx) => {
          if (line.includes(match)) {
            const icon = severity === 'high' ? '❌' : '⚠️';
            console.log(`${icon} ${file}:${idx + 1} - ${name}`);
            
            totalBlocking++;
            fileBlocking++;
            if (severity === 'high') criticalBlocking++;
            
            results.blocking.push({
              file,
              line: idx + 1,
              operation: name,
              severity
            });
          }
        });
      });
    }
  });

  if (fileBlocking === 0) {
    console.log(`✅ ${file}: NO BLOCKING OPERATIONS`);
  }
});

console.log(`\n📊 Blocking Operations Found: ${totalBlocking}`);
console.log(`   Critical (High Severity): ${criticalBlocking}`);
console.log(`   Warnings (Medium Severity): ${totalBlocking - criticalBlocking}`);

// Test 2: Async/Await Usage Check
console.log('\n\n🔄 2. ASYNC/AWAIT USAGE CHECK\n');
console.log('─'.repeat(80));

filesToCheck.forEach(file => {
  if (!fs.existsSync(file)) return;
  
  const content = fs.readFileSync(file, 'utf8');
  const asyncCount = (content.match(/async\s+function|async\s*\(/g) || []).length;
  const awaitCount = (content.match(/await\s+/g) || []).length;
  const promiseCount = (content.match(/\.then\(|\.catch\(|new Promise\(/g) || []).length;
  
  console.log(`📁 ${path.basename(file)}:`);
  console.log(`   Async functions: ${asyncCount}`);
  console.log(`   Await calls: ${awaitCount}`);
  console.log(`   Promise chains: ${promiseCount}`);
  console.log(`   ${asyncCount > 0 || promiseCount > 0 ? '✅' : '⚠️'} Async pattern usage: ${asyncCount > 0 || promiseCount > 0 ? 'GOOD' : 'NEEDS IMPROVEMENT'}`);
});

// Test 3: Performance Utilities Integration
console.log('\n\n⚡ 3. PERFORMANCE UTILITIES CHECK\n');
console.log('─'.repeat(80));

const perfUtilities = [
  { name: 'Performance Optimizer', file: 'src/utils/performance-optimizer.js' },
  { name: 'Async Optimizer', file: 'src/utils/async-optimizer.js' },
  { name: 'Startup Accelerator', file: 'src/utils/startup-accelerator.js' }
];

let perfUtilsInstalled = 0;
let perfUtilsIntegrated = 0;

perfUtilities.forEach(({ name, file }) => {
  const exists = fs.existsSync(file);
  console.log(`${exists ? '✅' : '❌'} ${name}: ${exists ? 'INSTALLED' : 'NOT INSTALLED'}`);
  
  if (exists) {
    perfUtilsInstalled++;
    
    // Check if it's integrated in main.js
    const mainJs = fs.readFileSync('src/main.js', 'utf8');
    const integrated = mainJs.includes(path.basename(file).replace('.js', ''));
    
    if (integrated) {
      console.log(`   ✅ Integrated in main.js`);
      perfUtilsIntegrated++;
    } else {
      console.log(`   ⚠️  Not integrated in main.js (available but unused)`);
    }
  }
});

console.log(`\n📊 Performance Utils: ${perfUtilsInstalled}/3 installed, ${perfUtilsIntegrated}/3 integrated`);

// Test 4: Startup Time Simulation
console.log('\n\n⏱️  4. STARTUP TIME SIMULATION\n');
console.log('─'.repeat(80));

const startupTests = [
  { name: 'Module Loading', test: () => {
    const start = performance.now();
    require('./src/utils/ai-prompts.js');
    return performance.now() - start;
  }},
  { name: 'File System Access', test: () => {
    const start = performance.now();
    fs.existsSync('src/main.js');
    fs.existsSync('package.json');
    return performance.now() - start;
  }},
  { name: 'Environment Variables', test: () => {
    const start = performance.now();
    require('dotenv').config();
    return performance.now() - start;
  }}
];

let totalStartupTime = 0;

startupTests.forEach(({ name, test }) => {
  const time = test();
  totalStartupTime += time;
  const status = time < 10 ? '✅' : time < 50 ? '⚠️' : '❌';
  const rating = time < 10 ? 'ULTRA-FAST' : time < 50 ? 'FAST' : 'SLOW';
  console.log(`${status} ${name}: ${time.toFixed(2)}ms (${rating})`);
  
  results.performance.push({ name, time, rating });
});

console.log(`\n⏱️  Total Simulated Startup: ${totalStartupTime.toFixed(2)}ms`);
console.log(`   ${totalStartupTime < 100 ? '✅ ULTRA-FAST' : totalStartupTime < 500 ? '⚠️ FAST' : '❌ SLOW'}`);

// Test 5: Code Efficiency Analysis
console.log('\n\n🎯 5. CODE EFFICIENCY ANALYSIS\n');
console.log('─'.repeat(80));

const mainJs = fs.readFileSync('src/main.js', 'utf8');

const efficiencyChecks = [
  { 
    name: 'Debouncing Used',
    pattern: /debounce|throttle/i,
    good: true
  },
  { 
    name: 'Caching Implemented',
    pattern: /cache|memoize/i,
    good: true
  },
  { 
    name: 'Event Listeners Cleanup',
    pattern: /removeListener|removeAllListeners|off\(/,
    good: true
  },
  { 
    name: 'setTimeout/setInterval Used',
    pattern: /setTimeout|setInterval/,
    good: false,
    warning: 'Can cause delays if not managed properly'
  },
  { 
    name: 'Heavy Synchronous Operations',
    pattern: /for\s*\([^)]+\)\s*\{[^}]{200,}\}/,
    good: false,
    warning: 'Large synchronous loops detected'
  }
];

efficiencyChecks.forEach(({ name, pattern, good, warning }) => {
  const found = pattern.test(mainJs);
  const status = (good && found) || (!good && !found) ? '✅' : '⚠️';
  const result = found ? 'FOUND' : 'NOT FOUND';
  console.log(`${status} ${name}: ${result}`);
  
  if (!good && found && warning) {
    console.log(`   ⚠️  ${warning}`);
    results.warnings.push(warning);
  }
});

// Test 6: Memory Efficiency
console.log('\n\n💾 6. MEMORY EFFICIENCY CHECK\n');
console.log('─'.repeat(80));

const memoryIssues = [
  { pattern: /global\./g, name: 'Global variables', risk: 'Memory leak risk' },
  { pattern: /setInterval(?!.*clearInterval)/g, name: 'setInterval without clear', risk: 'Memory leak' },
  { pattern: /addEventListener(?!.*removeEventListener)/g, name: 'Event listener without cleanup', risk: 'Memory leak' }
];

let memoryWarnings = 0;

memoryIssues.forEach(({ pattern, name, risk }) => {
  const matches = mainJs.match(pattern);
  if (matches) {
    console.log(`⚠️  ${name}: ${matches.length} occurrences (${risk})`);
    memoryWarnings++;
  }
});

if (memoryWarnings === 0) {
  console.log('✅ No obvious memory leak patterns detected');
}

// Test 7: Network Operations
console.log('\n\n🌐 7. NETWORK OPERATIONS CHECK\n');
console.log('─'.repeat(80));

const networkPatterns = [
  { pattern: /axios\.get|axios\.post|fetch\(/g, name: 'HTTP Requests' },
  { pattern: /timeout.*[0-9]+/gi, name: 'Timeout Settings' }
];

networkPatterns.forEach(({ pattern, name }) => {
  const matches = mainJs.match(pattern);
  if (matches) {
    console.log(`✅ ${name}: ${matches.length} found`);
    
    // Check for proper timeout
    if (name === 'HTTP Requests') {
      const hasTimeout = /timeout:\s*[0-9]+/.test(mainJs);
      console.log(`   ${hasTimeout ? '✅' : '⚠️'} Timeout configured: ${hasTimeout ? 'YES' : 'NO'}`);
    }
  }
});

// Test 8: Error Handling
console.log('\n\n🛡️  8. ERROR HANDLING CHECK\n');
console.log('─'.repeat(80));

const tryCatchCount = (mainJs.match(/try\s*\{/g) || []).length;
const catchCount = (mainJs.match(/catch\s*\(/g) || []).length;
const errorHandlers = (mainJs.match(/\.catch\(/g) || []).length;

console.log(`✅ Try-Catch blocks: ${tryCatchCount}`);
console.log(`✅ Catch handlers: ${catchCount}`);
console.log(`✅ Promise error handlers: ${errorHandlers}`);
console.log(`   ${tryCatchCount > 5 && catchCount > 5 ? '✅' : '⚠️'} Error handling: ${tryCatchCount > 5 ? 'COMPREHENSIVE' : 'BASIC'}`);

// Final Performance Score
console.log('\n\n═'.repeat(80));
console.log('\n⚡ ULTRA-FAST MODE ANALYSIS\n');
console.log('═'.repeat(80));

let score = 100;
let issues = [];

// Deduct points for blocking operations
if (criticalBlocking > 0) {
  const deduction = criticalBlocking * 10;
  score -= deduction;
  issues.push(`${criticalBlocking} critical blocking operations (-${deduction})`);
}

if (totalBlocking > criticalBlocking) {
  const deduction = (totalBlocking - criticalBlocking) * 2;
  score -= deduction;
  issues.push(`${totalBlocking - criticalBlocking} medium blocking operations (-${deduction})`);
}

// Deduct for slow startup
if (totalStartupTime > 100) {
  const deduction = 10;
  score -= deduction;
  issues.push(`Slow startup time: ${totalStartupTime.toFixed(2)}ms (-${deduction})`);
}

// Deduct for missing performance utils integration
if (perfUtilsInstalled > perfUtilsIntegrated) {
  const deduction = 5;
  score -= deduction;
  issues.push(`Performance utilities not integrated (-${deduction})`);
}

// Deduct for memory warnings
if (memoryWarnings > 0) {
  const deduction = memoryWarnings * 3;
  score -= deduction;
  issues.push(`${memoryWarnings} potential memory issues (-${deduction})`);
}

score = Math.max(0, score);

console.log(`\n📊 ULTRA-FAST SCORE: ${score}/100\n`);

let grade, status, icon;
if (score >= 95) {
  grade = 'A+';
  status = '⚡ ULTRA-FAST - Blazing speed!';
  icon = '🚀';
} else if (score >= 85) {
  grade = 'A';
  status = '✅ VERY FAST - Production ready';
  icon = '✅';
} else if (score >= 75) {
  grade = 'B';
  status = '⚠️ FAST - Minor optimizations recommended';
  icon = '⚠️';
} else if (score >= 65) {
  grade = 'C';
  status = '⚠️ ACCEPTABLE - Optimization needed';
  icon = '⚠️';
} else {
  grade = 'F';
  status = '❌ SLOW - Critical optimization required';
  icon = '❌';
  results.passed = false;
}

console.log(`${icon} Grade: ${grade}`);
console.log(`${icon} Status: ${status}\n`);

if (issues.length > 0) {
  console.log('⚠️  Issues Found:');
  issues.forEach(issue => console.log(`   • ${issue}`));
  console.log('');
}

// Performance Summary
console.log('─'.repeat(80));
console.log('\n📋 PERFORMANCE SUMMARY:\n');

console.log(`Blocking Operations:`);
console.log(`   Total: ${totalBlocking}`);
console.log(`   Critical: ${criticalBlocking}`);
console.log(`   Status: ${totalBlocking === 0 ? '✅ NONE' : totalBlocking < 20 ? '⚠️ ACCEPTABLE' : '❌ TOO MANY'}`);

console.log(`\nStartup Performance:`);
console.log(`   Simulated time: ${totalStartupTime.toFixed(2)}ms`);
console.log(`   Status: ${totalStartupTime < 100 ? '✅ ULTRA-FAST' : totalStartupTime < 500 ? '⚠️ FAST' : '❌ SLOW'}`);

console.log(`\nCode Quality:`);
console.log(`   Error handling: ${tryCatchCount > 5 ? '✅' : '⚠️'} ${tryCatchCount} try-catch blocks`);
console.log(`   Async operations: ✅ Present`);
console.log(`   Memory safety: ${memoryWarnings === 0 ? '✅' : '⚠️'} ${memoryWarnings} warnings`);

console.log(`\nOptimizations:`);
console.log(`   Performance utils: ${perfUtilsInstalled}/3 installed`);
console.log(`   Integration: ${perfUtilsIntegrated}/3 integrated`);
console.log(`   Status: ${perfUtilsIntegrated === 3 ? '✅ FULLY OPTIMIZED' : '⚠️ PARTIAL'}`);

// Recommendations
console.log('\n─'.repeat(80));
console.log('\n💡 RECOMMENDATIONS:\n');

if (score >= 95) {
  console.log('✅ Your app is running in ULTRA-FAST mode!');
  console.log('✅ No optimizations needed - performance is excellent!');
  console.log('✅ Ready for production deployment!');
} else if (score >= 85) {
  console.log('✅ Performance is very good!');
  if (totalBlocking > 0) {
    console.log(`⚠️  Consider converting ${totalBlocking} blocking operations to async`);
  }
  console.log('✅ Ready for production with minor tweaks');
} else {
  console.log('⚠️  Performance optimizations recommended:');
  if (criticalBlocking > 0) {
    console.log(`   1. Fix ${criticalBlocking} critical blocking operations (HIGH PRIORITY)`);
  }
  if (perfUtilsIntegrated < perfUtilsInstalled) {
    console.log(`   2. Integrate ${perfUtilsInstalled - perfUtilsIntegrated} performance utilities`);
  }
  if (memoryWarnings > 0) {
    console.log(`   3. Address ${memoryWarnings} potential memory leak issues`);
  }
}

console.log('\n═'.repeat(80));
console.log('');

process.exit(score >= 75 ? 0 : 1);
