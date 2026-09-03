/**
 * Conversation & Connection Audit Tool
 * 
 * Analyzes conversation history for:
 * - Connection glitches
 * - State persistence issues
 * - Context loss
 * - Memory synchronization problems
 * - Agent interaction bugs
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 CONVERSATION & CONNECTION AUDIT');
console.log('='.repeat(70));
console.log('');

const bugs = [];
const warnings = [];

function reportBug(category, issue, severity = 'HIGH') {
  bugs.push({ category, issue, severity, timestamp: Date.now() });
  console.error(`🐛 BUG [${severity}]: ${category}`);
  console.error(`   ${issue}\n`);
}

function reportWarning(category, issue) {
  warnings.push({ category, issue, timestamp: Date.now() });
  console.warn(`⚠️  WARNING: ${category}`);
  console.warn(`   ${issue}\n`);
}

// Test 1: Check for Agent State Persistence Issues
console.log('📋 Test 1: Agent State Persistence');
try {
  const agentBrainFile = path.join(__dirname, '../agent-brain-memory.json');
  
  if (!fs.existsSync(agentBrainFile)) {
    reportWarning('Agent Memory', 'agent-brain-memory.json not found - agents may lose context between sessions');
  } else {
    const content = fs.readFileSync(agentBrainFile, 'utf-8');
    const memory = JSON.parse(content);
    
    console.log(`✅ Agent memory file exists: ${Object.keys(memory).length} entries`);
    
    // Check for corruption
    if (JSON.stringify(memory).includes('undefined')) {
      reportBug('Memory Corruption', 'Agent memory contains undefined values', 'MEDIUM');
    }
  }
} catch (error) {
  reportBug('Agent Memory', `Failed to read agent memory: ${error.message}`, 'HIGH');
}

// Test 2: Check Jarvis Manager for Connection Issues
console.log('\n📋 Test 2: Jarvis Manager Connection Handling');
try {
  const jarvisFile = path.join(__dirname, '../src/utils/jarvis-manager.js');
  
  if (fs.existsSync(jarvisFile)) {
    const content = fs.readFileSync(jarvisFile, 'utf-8');
    
    // Check for proper error handling
    const hasErrorHandling = content.includes('catch') && content.includes('error');
    const hasReconnectLogic = content.includes('reconnect') || content.includes('retry');
    const hasTimeoutHandling = content.includes('timeout');
    
    if (!hasErrorHandling) {
      reportBug('Error Handling', 'jarvis-manager.js missing comprehensive error handling', 'HIGH');
    } else {
      console.log('✅ Error handling present');
    }
    
    if (!hasReconnectLogic) {
      reportWarning('Reconnection', 'No automatic reconnection logic detected in jarvis-manager');
    } else {
      console.log('✅ Reconnection logic present');
    }
    
    if (!hasTimeoutHandling) {
      reportWarning('Timeout', 'No timeout handling detected - may hang on network issues');
    } else {
      console.log('✅ Timeout handling present');
    }
    
    // Check for conversation history limits
    const hasHistoryLimit = content.includes('maxTurns') || content.includes('slice(');
    if (!hasHistoryLimit) {
      reportBug('Memory Growth', 'No conversation history limit - will grow indefinitely!', 'HIGH');
    } else {
      console.log('✅ Conversation history limit present');
    }
  } else {
    reportBug('Missing File', 'jarvis-manager.js not found!', 'CRITICAL');
  }
} catch (error) {
  reportBug('Jarvis Manager', `Failed to analyze: ${error.message}`, 'HIGH');
}

// Test 3: Check for Backend Connection Issues
console.log('\n📋 Test 3: Backend Connection Configuration');
try {
  const envFile = path.join(__dirname, '../.env');
  
  if (!fs.existsSync(envFile)) {
    reportBug('Configuration', '.env file missing - backend connection will fail!', 'CRITICAL');
  } else {
    const content = fs.readFileSync(envFile, 'utf-8');
    
    // Check for required variables
    const required = [
      'GROQ_API_KEY',
      'GEMINI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'BACKEND_URL'
    ];
    
    const missing = [];
    required.forEach(key => {
      if (!content.includes(key) || content.includes(`${key}=your-`) || content.includes(`${key}=""`)) {
        missing.push(key);
      }
    });
    
    if (missing.length > 0) {
      reportBug('Configuration', `Missing or unconfigured environment variables: ${missing.join(', ')}`, 'HIGH');
    } else {
      console.log('✅ All required environment variables configured');
    }
    
    // Check for localhost vs production URLs
    if (content.includes('localhost') || content.includes('127.0.0.1')) {
      console.log('ℹ️  Using localhost for development');
    }
  }
} catch (error) {
  reportBug('Environment', `Failed to check .env: ${error.message}`, 'HIGH');
}

// Test 4: Check for Audio Recording Glitches
console.log('\n📋 Test 4: Audio Recording Connection');
try {
  const audioRecorderFile = path.join(__dirname, '../src/utils/audio-recorder.js');
  
  if (fs.existsSync(audioRecorderFile)) {
    const content = fs.readFileSync(audioRecorderFile, 'utf-8');
    
    // Check for proper cleanup
    const hasCleanup = content.includes('stopRecording') && content.includes('kill');
    const hasErrorRecovery = content.includes('catch') && content.includes('error');
    
    if (!hasCleanup) {
      reportBug('Audio Cleanup', 'No proper process cleanup in audio-recorder', 'MEDIUM');
    } else {
      console.log('✅ Audio cleanup present');
    }
    
    if (!hasErrorRecovery) {
      reportBug('Audio Error', 'No error recovery in audio recording', 'MEDIUM');
    } else {
      console.log('✅ Audio error recovery present');
    }
  }
} catch (error) {
  reportWarning('Audio Recorder', `Could not analyze audio-recorder.js: ${error.message}`);
}

// Test 5: Check for Network Request Timeouts
console.log('\n📋 Test 5: Network Request Configuration');
try {
  const mainFile = path.join(__dirname, '../src/main.js');
  
  if (fs.existsSync(mainFile)) {
    const content = fs.readFileSync(mainFile, 'utf-8');
    
    // Check for axios timeout configuration
    const hasAxiosTimeout = content.includes('timeout:') && content.includes('axios');
    const hasFetchTimeout = content.includes('AbortController') || content.includes('signal');
    
    if (!hasAxiosTimeout && !hasFetchTimeout) {
      reportBug('Network Timeout', 'No network request timeouts configured - requests may hang indefinitely!', 'HIGH');
    } else {
      console.log('✅ Network timeouts configured');
    }
    
    // Check for retry logic
    const hasRetry = content.includes('retry') || content.includes('attempt');
    if (!hasRetry) {
      reportWarning('Network Retry', 'No retry logic for failed network requests');
    } else {
      console.log('✅ Retry logic present');
    }
  }
} catch (error) {
  reportWarning('Main File', `Could not analyze main.js: ${error.message}`);
}

// Test 6: Check for Session State Management
console.log('\n📋 Test 6: Session State Persistence');
try {
  const userDataPath = path.join(__dirname, '../userData');
  
  if (!fs.existsSync(userDataPath)) {
    reportWarning('User Data', 'userData directory not found - session state may be lost');
  } else {
    const files = fs.readdirSync(userDataPath);
    console.log(`✅ userData directory exists with ${files.length} files`);
    
    // Check for state files
    const hasStateFile = files.some(f => f.includes('state') || f.includes('session'));
    if (!hasStateFile) {
      reportWarning('State File', 'No state persistence files found in userData');
    }
  }
} catch (error) {
  reportWarning('User Data', `Could not check userData: ${error.message}`);
}

// Test 7: Check for Conversation History Recording
console.log('\n📋 Test 7: Conversation Recording & Playback');
try {
  const jarvisConfig = path.join(__dirname, '../jarvis-config.json');
  
  if (fs.existsSync(jarvisConfig)) {
    const content = fs.readFileSync(jarvisConfig, 'utf-8');
    const config = JSON.parse(content);
    
    console.log(`✅ Jarvis config exists`);
    
    // Check for conversation history settings
    if (config.conversationHistory) {
      console.log(`✅ Conversation history settings found`);
    } else {
      reportWarning('History Config', 'No conversation history configuration');
    }
  } else {
    reportWarning('Jarvis Config', 'jarvis-config.json not found');
  }
} catch (error) {
  reportWarning('Jarvis Config', `Could not check jarvis-config.json: ${error.message}`);
}

// Test 8: Check for Connection Recovery Mechanisms
console.log('\n📋 Test 8: Connection Recovery & Resilience');
try {
  const files = [
    '../src/main.js',
    '../src/utils/jarvis-manager.js',
    '../src/services/memory-bridge-client.ts'
  ];
  
  let hasAutoReconnect = false;
  let hasConnectionMonitoring = false;
  let hasOfflineHandling = false;
  
  files.forEach(file => {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      if (content.includes('autoReconnect') || content.includes('reconnect')) {
        hasAutoReconnect = true;
      }
      
      if (content.includes('online') || content.includes('offline') || content.includes('connection')) {
        hasConnectionMonitoring = true;
      }
      
      if (content.includes('offline') && content.includes('queue')) {
        hasOfflineHandling = true;
      }
    }
  });
  
  if (!hasAutoReconnect) {
    reportBug('Connection Recovery', 'No automatic reconnection mechanism found!', 'HIGH');
  } else {
    console.log('✅ Auto-reconnect mechanism present');
  }
  
  if (!hasConnectionMonitoring) {
    reportWarning('Connection Monitoring', 'No connection state monitoring detected');
  } else {
    console.log('✅ Connection monitoring present');
  }
  
  if (!hasOfflineHandling) {
    reportWarning('Offline Mode', 'No offline request queuing detected');
  } else {
    console.log('✅ Offline handling present');
  }
} catch (error) {
  reportWarning('Recovery Check', `Could not analyze recovery mechanisms: ${error.message}`);
}

// Test 9: Check for Video/Screen Recording Integration
console.log('\n📋 Test 9: Screen Recording & Video Integration');
try {
  const screenShareFile = path.join(__dirname, '../src/utils/screen-share-manager.js');
  
  if (fs.existsSync(screenShareFile)) {
    const content = fs.readFileSync(screenShareFile, 'utf-8');
    
    // Check for recording functionality
    const hasRecording = content.includes('record') || content.includes('capture');
    const hasVideoProcessing = content.includes('video') || content.includes('frame');
    const hasErrorHandling = content.includes('catch') && content.includes('error');
    
    if (!hasRecording) {
      reportWarning('Screen Recording', 'No recording capability detected in screen-share-manager');
    } else {
      console.log('✅ Screen recording capability present');
    }
    
    if (!hasVideoProcessing) {
      reportWarning('Video Processing', 'No video processing detected');
    } else {
      console.log('✅ Video processing present');
    }
    
    if (!hasErrorHandling) {
      reportBug('Screen Share Error', 'No error handling in screen-share-manager', 'MEDIUM');
    } else {
      console.log('✅ Screen share error handling present');
    }
  } else {
    reportWarning('Screen Share', 'screen-share-manager.js not found - video features may not work');
  }
} catch (error) {
  reportWarning('Screen Share', `Could not analyze screen-share-manager: ${error.message}`);
}

// Test 10: Check for Agent Context Loss Between Turns
console.log('\n📋 Test 10: Agent Context Continuity');
try {
  const jarvisFile = path.join(__dirname, '../src/utils/jarvis-manager.js');
  
  if (fs.existsSync(jarvisFile)) {
    const content = fs.readFileSync(jarvisFile, 'utf-8');
    
    // Check for context preservation
    const hasContextTracking = content.includes('conversationHistory') || content.includes('context');
    const hasMemoryPersistence = content.includes('saveMemory') || content.includes('loadMemory');
    const hasSessionManagement = content.includes('session');
    
    if (!hasContextTracking) {
      reportBug('Context Loss', 'No conversation context tracking - agents will lose context between turns!', 'CRITICAL');
    } else {
      console.log('✅ Context tracking present');
    }
    
    if (!hasMemoryPersistence) {
      reportBug('Memory Loss', 'No memory persistence - agent memory lost on restart!', 'HIGH');
    } else {
      console.log('✅ Memory persistence present');
    }
    
    if (!hasSessionManagement) {
      reportWarning('Session Management', 'No session management detected');
    } else {
      console.log('✅ Session management present');
    }
  }
} catch (error) {
  reportBug('Context Check', `Failed to check context continuity: ${error.message}`, 'HIGH');
}

// Final Report
setTimeout(() => {
  console.log('\n' + '='.repeat(70));
  console.log('🏁 CONVERSATION & CONNECTION AUDIT COMPLETE');
  console.log('='.repeat(70));
  console.log('');
  
  console.log(`🐛 Bugs Found: ${bugs.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log('');
  
  if (bugs.length > 0) {
    console.log('📋 BUG REPORT:');
    console.log('');
    
    const critical = bugs.filter(b => b.severity === 'CRITICAL');
    const high = bugs.filter(b => b.severity === 'HIGH');
    const medium = bugs.filter(b => b.severity === 'MEDIUM');
    
    if (critical.length > 0) {
      console.log(`🔴 CRITICAL BUGS (${critical.length}):`);
      critical.forEach((bug, i) => {
        console.log(`  ${i + 1}. [${bug.category}] ${bug.issue}`);
      });
      console.log('');
    }
    
    if (high.length > 0) {
      console.log(`🟠 HIGH PRIORITY BUGS (${high.length}):`);
      high.forEach((bug, i) => {
        console.log(`  ${i + 1}. [${bug.category}] ${bug.issue}`);
      });
      console.log('');
    }
    
    if (medium.length > 0) {
      console.log(`🟡 MEDIUM PRIORITY BUGS (${medium.length}):`);
      medium.forEach((bug, i) => {
        console.log(`  ${i + 1}. [${bug.category}] ${bug.issue}`);
      });
      console.log('');
    }
  }
  
  if (warnings.length > 0) {
    console.log('⚠️  WARNINGS:');
    console.log('');
    warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. [${warn.category}] ${warn.issue}`);
    });
    console.log('');
  }
  
  if (bugs.length === 0 && warnings.length === 0) {
    console.log('🎉 NO CONNECTION ISSUES FOUND!');
    console.log('✅ All conversation and connection systems working correctly.');
  } else {
    console.log('⚠️  RECOMMENDATION: Address critical and high priority issues');
    console.log('📝 Check the detailed report above for specific fixes needed');
  }
  
  console.log('');
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    bugs,
    warnings,
    summary: {
      totalBugs: bugs.length,
      critical: bugs.filter(b => b.severity === 'CRITICAL').length,
      high: bugs.filter(b => b.severity === 'HIGH').length,
      medium: bugs.filter(b => b.severity === 'MEDIUM').length,
      warnings: warnings.length
    }
  };
  
  try {
    fs.writeFileSync(
      path.join(__dirname, '../CONVERSATION_AUDIT_REPORT.json'),
      JSON.stringify(report, null, 2)
    );
    console.log('📄 Detailed report saved to: CONVERSATION_AUDIT_REPORT.json');
  } catch (e) {
    console.error('Failed to save report:', e.message);
  }
  
  process.exit(bugs.filter(b => b.severity === 'CRITICAL').length > 0 ? 1 : 0);
}, 500);
