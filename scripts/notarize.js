// Notarization script for macOS app distribution
const { notarize } = require('@electron/notarize');
const path = require('path');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  // Skip notarization in development
  if (process.env.SKIP_NOTARIZE === 'true') {
    console.log('Skipping notarization (SKIP_NOTARIZE=true)');
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  console.log(`Notarizing ${appPath}...`);

  try {
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    });
    
    console.log('✅ Notarization complete!');
  } catch (error) {
    console.error('❌ Notarization failed:', error);
    throw error;
  }
};