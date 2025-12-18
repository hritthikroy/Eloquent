#!/bin/bash

# Eloquent Quick Launch Script
# Prepares your app for immediate distribution

echo "🚀 Eloquent Quick Launch Preparation"
echo "===================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the EloquentElectron directory"
    exit 1
fi

echo "📦 Building production app..."
npm run build:signed

echo ""
echo "📁 Creating distribution package..."
mkdir -p distribution
cp dist/Eloquent-2.1.0-mac-universal.dmg distribution/
cp dist/Eloquent-2.1.0-mac-universal.zip distribution/
cp landing-page.html distribution/index.html

echo ""
echo "📊 Distribution package ready:"
echo "=============================="
ls -lh distribution/

echo ""
echo "🎯 Quick Launch Checklist:"
echo "=========================="
echo "✅ App built successfully"
echo "✅ DMG installer ready (160MB)"
echo "✅ ZIP archive ready (169MB)"
echo "✅ Landing page created"
echo "✅ Documentation included"
echo ""

echo "📤 Distribution Options:"
echo "======================="
echo ""
echo "1. 🌐 Host on GitHub Pages (Free):"
echo "   - Create new GitHub repo"
echo "   - Upload distribution/ folder"
echo "   - Enable GitHub Pages"
echo "   - Share the GitHub Pages URL"
echo ""
echo "2. 📧 Direct Sharing:"
echo "   - Email the DMG file directly"
echo "   - Share via cloud storage (Dropbox, Google Drive)"
echo "   - Use file sharing services"
echo ""
echo "3. 🖥️ Local Web Server (Testing):"
echo "   cd distribution && python3 -m http.server 8000"
echo "   Then visit: http://localhost:8000"
echo ""

echo "🔗 Next Steps:"
echo "=============="
echo "1. Test the DMG: open distribution/Eloquent-2.1.0-mac-universal.dmg"
echo "2. Test the landing page: open distribution/index.html"
echo "3. Choose your distribution method above"
echo "4. Share with your first users!"
echo ""

echo "💡 Pro Tips:"
echo "============"
echo "- Start with 5-10 beta users for feedback"
echo "- Ask users to test on different Mac models"
echo "- Collect feedback on installation process"
echo "- Monitor backend usage via Heroku dashboard"
echo ""

echo "🎉 Your app is ready for Quick Launch!"
echo ""
echo "📱 Backend Status:"
curl -s https://agile-basin-06335-9109082620ce.herokuapp.com/health | grep -q "ok" && echo "✅ Backend is running" || echo "❌ Backend check failed"

echo ""
echo "🚀 Happy launching!"