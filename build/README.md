# Build Assets

This folder contains assets needed for building the macOS app.

## Required Files

### icon.icns (Required)
- App icon in ICNS format
- Recommended size: 1024x1024
- Currently using default Electron icon

To create your own:
1. Design a 1024x1024 PNG icon
2. Use the iconutil script in BUILD_GUIDE.md
3. Place the resulting icon.icns here

### background.png (Optional)
- DMG installer background image
- Size: 540x380 pixels
- Currently using default background

### entitlements.mac.plist (Included)
- macOS permissions configuration
- Already configured for microphone and automation access
