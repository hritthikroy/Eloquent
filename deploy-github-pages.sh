#!/bin/bash

# Eloquent GitHub Pages Deployment Script
# Automates the process of deploying to GitHub Pages

echo "🚀 Eloquent GitHub Pages Deployment"
echo "==================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the EloquentElectron directory"
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "❌ Git is not installed. Please install Git first."
    exit 1
fi

# Check if GitHub CLI is installed (optional)
if command -v gh &> /dev/null; then
    echo "✅ GitHub CLI found - we can create the repo automatically"
    GH_CLI_AVAILABLE=true
else
    echo "💡 GitHub CLI not found - you'll need to create the repo manually"
    GH_CLI_AVAILABLE=false
fi

echo ""
echo "📦 Preparing distribution files..."

# Ensure distribution directory exists and is up to date
if [ ! -d "distribution" ]; then
    echo "Creating distribution directory..."
    ./quick-launch.sh
fi

cd distribution

# Check if git repo is initialized
if [ ! -d ".git" ]; then
    echo "Initializing git repository..."
    git init
    git add .
    git commit -m "Initial Eloquent v2.1.0 release"
fi

echo ""
echo "🔧 Repository Setup"
echo "=================="

if [ "$GH_CLI_AVAILABLE" = true ]; then
    echo "Creating GitHub repository using GitHub CLI..."
    
    # Check if user is logged in to GitHub CLI
    if ! gh auth status &> /dev/null; then
        echo "🔐 Please log in to GitHub CLI first:"
        gh auth login
    fi
    
    # Create repository
    REPO_NAME="eloquent-download"
    echo "Creating repository: $REPO_NAME"
    
    if gh repo create "$REPO_NAME" --public --description "Eloquent - Professional Voice-to-Text for macOS" --homepage "https://$(gh api user --jq .login).github.io/$REPO_NAME"; then
        echo "✅ Repository created successfully"
        
        # Add remote and push
        git remote add origin "https://github.com/$(gh api user --jq .login)/$REPO_NAME.git"
        git branch -M main
        git push -u origin main
        
        # Enable GitHub Pages
        echo "🌐 Enabling GitHub Pages..."
        gh api repos/$(gh api user --jq .login)/$REPO_NAME/pages -X POST -f source.branch=main -f source.path=/
        
        GITHUB_USERNAME=$(gh api user --jq .login)
        PAGES_URL="https://$GITHUB_USERNAME.github.io/$REPO_NAME"
        
        echo ""
        echo "🎉 Deployment Complete!"
        echo "======================"
        echo "📱 Repository: https://github.com/$GITHUB_USERNAME/$REPO_NAME"
        echo "🌐 Live Site: $PAGES_URL"
        echo ""
        echo "⏱️  GitHub Pages may take 5-10 minutes to become available"
        echo "🔄 Check deployment status at: https://github.com/$GITHUB_USERNAME/$REPO_NAME/deployments"
        
    else
        echo "❌ Failed to create repository. You may need to create it manually."
        MANUAL_SETUP=true
    fi
else
    MANUAL_SETUP=true
fi

if [ "$MANUAL_SETUP" = true ]; then
    echo ""
    echo "📋 Manual Setup Instructions"
    echo "============================"
    echo ""
    echo "1. 🌐 Go to GitHub.com and create a new repository:"
    echo "   - Repository name: eloquent-download"
    echo "   - Description: Eloquent - Professional Voice-to-Text for macOS"
    echo "   - Make it Public"
    echo "   - Don't initialize with README (we have files already)"
    echo ""
    echo "2. 📤 Push your files:"
    echo "   git remote add origin https://github.com/YOUR_USERNAME/eloquent-download.git"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    echo "3. 🌐 Enable GitHub Pages:"
    echo "   - Go to repository Settings"
    echo "   - Scroll to 'Pages' section"
    echo "   - Source: Deploy from a branch"
    echo "   - Branch: main"
    echo "   - Folder: / (root)"
    echo "   - Click Save"
    echo ""
    echo "4. 🔗 Your site will be available at:"
    echo "   https://YOUR_USERNAME.github.io/eloquent-download"
    echo ""
fi

echo ""
echo "📊 Distribution Package Contents:"
echo "================================"
ls -lh

echo ""
echo "🎯 Next Steps:"
echo "=============="
echo "1. ⏱️  Wait 5-10 minutes for GitHub Pages to deploy"
echo "2. 🧪 Test your download page"
echo "3. 📱 Share the URL with beta testers"
echo "4. 📊 Monitor downloads and feedback"
echo ""

echo "💡 Pro Tips:"
echo "============"
echo "- Test the download links work correctly"
echo "- Ask beta users to try both DMG and ZIP"
echo "- Monitor your Heroku backend for API usage"
echo "- Collect feedback via email or GitHub issues"
echo ""

echo "🚀 Happy launching!"