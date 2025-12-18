#!/bin/bash

echo "🚀 Deploying OAuth Fix to Heroku"
echo "================================"

# Navigate to backend directory
cd backend-go

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: backend-go is not a git repository"
    echo "💡 You need to deploy from the backend-go directory that has git initialized"
    exit 1
fi

# Check if heroku remote exists
if ! git remote | grep -q heroku; then
    echo "❌ Error: No heroku remote found"
    echo "💡 Add heroku remote with: heroku git:remote -a your-app-name"
    exit 1
fi

# Show current status
echo "📊 Current git status:"
git status --short

# Add and commit changes
echo "📝 Committing OAuth callback changes..."
git add .
git commit -m "Add OAuth callback handler for production"

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Add this URL to Supabase Auth settings:"
echo "   https://agile-basin-06335-9109082620ce.herokuapp.com/api/auth/callback"
echo ""
echo "2. In Supabase Dashboard > Authentication > URL Configuration:"
echo "   - Site URL: https://agile-basin-06335-9109082620ce.herokuapp.com"
echo "   - Redirect URLs: Add the callback URL above"
echo ""
echo "3. Test the OAuth flow in your Electron app"