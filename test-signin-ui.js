#!/usr/bin/env node

// Test script to simulate the exact UI sign-in flow
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const authService = require('./src/services/auth-bridge');

let testWindow = null;

// Mock the IPC handler exactly as in main.js
ipcMain.handle('auth-google', async () => {
  console.log('🔍 IPC Handler: auth-google called');
  
  try {
    // Get OAuth URL from Supabase
    const authResult = await authService.signInWithGoogle();
    console.log('🔍 Auth result:', authResult);
    
    if (!authResult.success) {
      console.log('❌ Auth failed:', authResult.error);
      return authResult;
    }

    // Handle development mode directly
    if (authResult.isDevelopment) {
      console.log('🔧 Development mode - simulating successful authentication');
      
      // Simulate successful authentication
      const devResult = await authService.handleOAuthCallback({
        access_token: 'dev-token',
        refresh_token: 'dev-refresh-token'
      });
      
      console.log('🔍 Dev result:', devResult);
      return devResult;
    }

    return authResult;
  } catch (error) {
    console.error('❌ IPC Handler error:', error);
    return { success: false, error: error.message };
  }
});

async function testSignInUI() {
  console.log('🧪 TESTING SIGN-IN UI FLOW');
  console.log('==========================');
  
  await app.whenReady();
  
  // Create test window
  testWindow = new BrowserWindow({
    width: 500,
    height: 700,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load the login page
  const loginPath = path.join(__dirname, 'src', 'ui', 'login.html');
  console.log('📄 Loading login page:', loginPath);
  
  await testWindow.loadFile(loginPath);
  
  // Inject test script to simulate button click
  await testWindow.webContents.executeJavaScript(`
    console.log('🔍 Testing button click simulation...');
    
    // Check if button exists
    const button = document.getElementById('google-btn');
    console.log('🔍 Button found:', !!button);
    
    if (button) {
      console.log('🔍 Button text:', button.textContent);
      console.log('🔍 Button disabled:', button.disabled);
      
      // Simulate click
      console.log('🖱️ Simulating button click...');
      button.click();
    } else {
      console.error('❌ Button not found!');
    }
  `);
  
  // Wait a bit for the click to process
  setTimeout(() => {
    console.log('✅ Test completed. Check the output above for any errors.');
    app.quit();
  }, 3000);
}

app.on('ready', testSignInUI);

app.on('window-all-closed', () => {
  app.quit();
});