#!/bin/bash

# Eloquent Deployment Script
# This script helps you deploy to GitHub with automated builds

set -e

echo "🚀 Eloquent Deployment Script"
echo "================================"
echo ""

# Check if git is initialized
if [ ! -d .git ]; then
    echo "❌ Git repository not initialized"
    echo "Run: git init"
    exit 1
fi

# Get current version from package.json
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo "📦 Current version: v$CURRENT_VERSION"
echo ""

# Ask for version bump
echo "Select version bump:"
echo "1) Patch (2.0.0 -> 2.0.1) - Bug fixes"
echo "2) Minor (2.0.0 -> 2.1.0) - New features"
echo "3) Major (2.0.0 -> 3.0.0) - Breaking changes"
echo "4) Keep current version"
echo ""
read -p "Enter choice (1-4): " VERSION_CHOICE

case $VERSION_CHOICE in
    1)
        npm version patch --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo "✅ Bumped to v$NEW_VERSION"
        ;;
    2)
        npm version minor --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo "✅ Bumped to v$NEW_VERSION"
        ;;
    3)
        npm version major --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        echo "✅ Bumped to v$NEW_VERSION"
        ;;
    4)
        NEW_VERSION=$CURRENT_VERSION
        echo "✅ Keeping v$NEW_VERSION"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""

# Get commit message
read -p "Enter commit message: " COMMIT_MESSAGE
if [ -z "$COMMIT_MESSAGE" ]; then
    COMMIT_MESSAGE="Release v$NEW_VERSION"
fi

echo ""
echo "📝 Summary:"
echo "  Version: v$NEW_VERSION"
echo "  Message: $COMMIT_MESSAGE"
echo ""
read -p "Continue? (y/n): " CONFIRM

if [ "$CONFIRM" != "y" ]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔨 Building locally to verify..."
npm run build:mac

if [ $? -ne 0 ]; then
    echo "❌ Build failed! Fix errors before deploying."
    exit 1
fi

echo "✅ Build successful!"
echo ""

# Git operations
echo "📤 Committing changes..."
git add .
git commit -m "$COMMIT_MESSAGE"

echo "🏷️  Creating tag v$NEW_VERSION..."
git tag "v$NEW_VERSION"

echo "⬆️  Pushing to GitHub..."
git push origin main
git push origin "v$NEW_VERSION"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🎉 GitHub Actions will now:"
echo "   1. Build the Mac app"
echo "   2. Create DMG and ZIP files"
echo "   3. Create a GitHub Release"
echo ""
echo "📦 Check progress at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/actions"
echo ""
echo "🎁 Release will be available at:"
echo "   https://github.com/$(git config --get remote.origin.url | sed 's/.*github.com[:/]\(.*\)\.git/\1/')/releases/tag/v$NEW_VERSION"
