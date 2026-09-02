#!/usr/bin/env node

/**
 * Performance Audit Script
 * Checks for blocking operations and performance issues
 */

const fs = require('fs');
const path = require('path');

console.log('\n⚡ ELOQUENT PERFORMANCE AUDIT\n');
console.log('━'.repeat(70));

const issues = [];
const warnings = [];
const suggestions = [];

// Files to audit
const filesToAudit = [
  'src/main.js',
  'src/utils/audio-recorder.js',
  'src/utils/paste-helper.js',
  'src/utils/sound-player.js',
  'src/ui/overlay.js'
];

// Blocking patterns to detect
const blockingPatterns = [
  { pattern: /readFileSync/g, severity: 'HIGH', message: 'Synchronous file read - use async' },
  { pattern: /writeFileSync/g, severity: 'HIGH', message: 'Synchronous file write - use async' },
  { pattern: /execSync/g, severity: 'MEDIUM', message: 'Synchronous command execution' },
  { pattern: /\.wait\(/g, severity: 'HIGH', message: 'Blocking wait call' },
  { pattern: /sleep\(/g, severity: 'HIGH', message: 'Blocking sleep call' },
  { pattern: /while\s*\(true\)/g, severity: 'CRITICAL', message: 'Infinite loop detected' },
  { pattern: /for\s*\([^)]*;\s*true\s*;/g, severity: 'CRITICAL', message: 'Infinite for loop' }
];

// Performance anti-patterns
const antiPatterns = [
  { pattern: /setTimeout\([^,]+,\s*0\)/g, severity: 'LOW', message: 'setTimeout with 0 delay - use setImmediate' },
  { pattern: /new\s+Promise\(\s*\([^)]*\)\s*=>\s*{\s*setTimeout/g, severity: 'LOW', message: 'Promise with setTimeout - consider promisify' },
  { pattern: /console\.log/g, severity: 'INFO', message: 'Console.log found - consider removing in production' }
];

console.log('\n🔍 Auditing files for blocking operations...\n');

filesToAudit.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  ${file} - NOT FOUND`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  let fileIssues = 0;
  let fileWarnings = 0;

  // Check for blocking patterns
  blockingPatterns.forEach(({ pattern, severity, message }) => {
    const matches = content.match(pattern);
    if (matches) {
      lines.forEach((line, index) => {
        if (pattern.test(line)) {
          const issue = {
            file,
            line: index + 1,
            severity,
            message,
            code: line.trim()
          };

          if (severity === 'CRITICAL' || severity === 'HIGH') {
            issues.push(issue);
            fileIssues++;
          } else {
            warnings.push(issue);
            fileWarnings++;
          }
        }
      });
    }
  });

  // Check for anti-patterns
  antiPatterns.forEach(({ pattern, severity, message }) => {
    const matches = content.match(pattern);
    if (matches && severity !== 'INFO') {
      suggestions.push({
        file,
        message,
        count: matches.length
      });
    }
  });

  const status = fileIssues > 0 ? '❌' : fileWarnings > 0 ? '⚠️ ' : '✅';
  console.log(`${status} ${file} - ${fileIssues} issues, ${fileWarnings} warnings`);
});

// Performance metrics
console.log('\n' + '━'.repeat(70));
console.log('\n📊 AUDIT RESULTS\n');

console.log(`Issues Found: ${issues.length}`);
console.log(`Warnings: ${warnings.length}`);
console.log(`Suggestions: ${suggestions.length}\n`);

// Display critical issues
if (issues.length > 0) {
  console.log('🚨 CRITICAL ISSUES:\n');
  issues.forEach(issue => {
    console.log(`   File: ${issue.file}:${issue.line}`);
    console.log(`   Severity: ${issue.severity}`);
    console.log(`   Issue: ${issue.message}`);
    console.log(`   Code: ${issue.code}`);
    console.log('');
  });
}

// Display warnings
if (warnings.length > 0 && warnings.length <= 10) {
  console.log('⚠️  WARNINGS:\n');
  warnings.forEach(warning => {
    console.log(`   ${warning.file}:${warning.line} - ${warning.message}`);
  });
  console.log('');
} else if (warnings.length > 10) {
  console.log(`⚠️  ${warnings.length} warnings found (too many to display)`);
  console.log('   Most common: ' + warnings[0].message + '\n');
}

// Display suggestions
if (suggestions.length > 0) {
  console.log('💡 PERFORMANCE SUGGESTIONS:\n');
  suggestions.forEach(suggestion => {
    console.log(`   ${suggestion.file} - ${suggestion.message}`);
    console.log(`   Count: ${suggestion.count} occurrences\n`);
  });
}

// Check for async optimizations
console.log('━'.repeat(70));
console.log('\n🔧 OPTIMIZATION STATUS:\n');

const optimizationFiles = [
  { file: 'src/utils/performance-optimizer.js', desc: 'Performance Optimizer' },
  { file: 'src/utils/async-optimizer.js', desc: 'Async Optimizer' },
  { file: 'src/utils/startup-accelerator.js', desc: 'Startup Accelerator' }
];

optimizationFiles.forEach(({ file, desc }) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✅' : '❌'} ${desc}: ${exists ? 'Installed' : 'Missing'}`);
});

// Check utilities
console.log('\n━'.repeat(70));
console.log('\n🛠️  UTILITY STATUS:\n');

const utilities = [
  { file: 'src/utils/audio-recorder.js', desc: 'Audio Recorder (Cross-platform)' },
  { file: 'src/utils/paste-helper.js', desc: 'Paste Helper (Cross-platform)' },
  { file: 'src/utils/sound-player.js', desc: 'Sound Player (Cross-platform)' }
];

utilities.forEach(({ file, desc }) => {
  const exists = fs.existsSync(path.join(__dirname, file));
  console.log(`   ${exists ? '✅' : '❌'} ${desc}: ${exists ? 'Ready' : 'Missing'}`);
});

// Final score
console.log('\n━'.repeat(70));
console.log('\n🎯 PERFORMANCE SCORE:\n');

const totalIssues = issues.length + warnings.length;
let score = 100;
score -= issues.length * 10; // -10 per critical issue
score -= warnings.length * 2; // -2 per warning
score = Math.max(0, score);

let grade = 'F';
if (score >= 90) grade = 'A+';
else if (score >= 85) grade = 'A';
else if (score >= 80) grade = 'B+';
else if (score >= 75) grade = 'B';
else if (score >= 70) grade = 'C+';
else if (score >= 65) grade = 'C';
else if (score >= 60) grade = 'D';

console.log(`   Score: ${score}/100`);
console.log(`   Grade: ${grade}`);

if (score >= 90) {
  console.log(`   Status: 🌟 EXCELLENT - Ultra-fast performance!`);
} else if (score >= 75) {
  console.log(`   Status: ✅ GOOD - Performance is acceptable`);
} else if (score >= 60) {
  console.log(`   Status: ⚠️  NEEDS IMPROVEMENT - Optimize blocking operations`);
} else {
  console.log(`   Status: ❌ POOR - Critical performance issues found`);
}

// Recommendations
console.log('\n━'.repeat(70));
console.log('\n📋 RECOMMENDATIONS:\n');

if (issues.length > 0) {
  console.log('   1. Fix all critical blocking operations immediately');
  console.log('   2. Convert synchronous file operations to async');
  console.log('   3. Use Performance Optimizer utility for file I/O');
}

if (warnings.length > 5) {
  console.log('   4. Review and optimize warning-level issues');
  console.log('   5. Use Async Optimizer for command execution');
}

console.log('   6. Use Startup Accelerator to defer non-critical operations');
console.log('   7. Implement caching for frequently accessed files');
console.log('   8. Use setImmediate instead of setTimeout(0)');
console.log('   9. Batch multiple operations where possible');
console.log('   10. Profile with Chrome DevTools for bottlenecks\n');

console.log('━'.repeat(70));

// Exit code
if (issues.length > 0) {
  console.log('\n❌ Audit failed: Critical issues found\n');
  process.exit(1);
} else if (score < 75) {
  console.log('\n⚠️  Audit passed with warnings\n');
  process.exit(0);
} else {
  console.log('\n✅ Audit passed: Performance is excellent!\n');
  process.exit(0);
}
