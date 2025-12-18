# 🚀 GitHub Pages Deployment Guide for Eloquent

Complete step-by-step guide to deploy your Eloquent app download page on GitHub Pages (100% FREE).

## 📋 Prerequisites

- GitHub account (free)
- Git installed on your Mac
- Your Eloquent app already built (✅ You have this!)

## 🎯 Quick Deploy (Automated)

### Option A: Using GitHub CLI (Easiest)

1. **Install GitHub CLI** (if not already installed):
   ```bash
   brew install gh
   ```

2. **Run the deployment script**:
   ```bash
   ./deploy-github-pages.sh
   ```

3. **Follow the prompts** - the script will:
   - Create the GitHub repository
   - Push your files
   - Enable GitHub Pages
   - Give you the live URL

4. **Wait 5-10 minutes** for GitHub Pages to deploy

5. **Visit your site**: `https://YOUR_USERNAME.github.io/eloquent-download`

---

## 📝 Manual Setup (Step-by-Step)

### Step 1: Create GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the **"+"** icon (top right) → **"New repository"**
3. Fill in the details:
   - **Repository name**: `eloquent-download`
   - **Description**: `Eloquent - Professional Voice-to-Text for macOS`
   - **Visibility**: ✅ Public (required for free GitHub Pages)
   - **Initialize**: ❌ Don't check any boxes (we have files already)
4. Click **"Create repository"**

### Step 2: Push Your Files

1. **Copy the repository URL** from GitHub (looks like: `https://github.com/YOUR_USERNAME/eloquent-download.git`)

2. **Open Terminal** and navigate to the distribution folder:
   ```bash
   cd EloquentElectron/distribution
   ```

3. **Add the remote repository**:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/eloquent-download.git
   ```
   *(Replace YOUR_USERNAME with your actual GitHub username)*

4. **Push your files**:
   ```bash
   git branch -M main
   git push -u origin main
   ```

5. **Enter your GitHub credentials** when prompted

### Step 3: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click **"Settings"** (top menu)
3. Scroll down to **"Pages"** in the left sidebar
4. Under **"Source"**:
   - Branch: Select **"main"**
   - Folder: Select **"/ (root)"**
5. Click **"Save"**

### Step 4: Get Your Live URL

1. After saving, GitHub will show your site URL:
   ```
   https://YOUR_USERNAME.github.io/eloquent-download
   ```

2. **Wait 5-10 minutes** for the first deployment

3. **Visit the URL** to see your live download page!

---

## 🎨 Customization Options

### Update Your Landing Page

1. Edit `distribution/index.html` locally
2. Commit and push changes:
   ```bash
   cd EloquentElectron/distribution
   git add index.html
   git commit -m "Update landing page"
   git push
   ```
3. Changes appear in 1-2 minutes

### Add Custom Domain (Optional)

1. Buy a domain (e.g., `eloquent-app.com`)
2. In GitHub Pages settings, add your custom domain
3. Update DNS records at your domain registrar
4. Enable HTTPS (automatic with GitHub Pages)

---

## 🧪 Testing Your Deployment

### Test Checklist

- [ ] Landing page loads correctly
- [ ] DMG download link works
- [ ] ZIP download link works
- [ ] Page looks good on mobile
- [ ] All features listed correctly
- [ ] System requirements visible

### Test Downloads

1. **Click the DMG download button**
   - File should download (160MB)
   - Should be named: `Eloquent-2.1.0-mac-universal.dmg`

2. **Click the ZIP download button**
   - File should download (169MB)
   - Should be named: `Eloquent-2.1.0-mac-universal.zip`

3. **Test installation**
   - Open the DMG
   - Drag to Applications
   - Launch and verify it works

---

## 📊 Monitoring Your Launch

### GitHub Insights

1. Go to your repository
2. Click **"Insights"** tab
3. View:
   - Traffic (page views)
   - Clones (downloads)
   - Popular content

### Backend Monitoring

Monitor your Heroku backend:
```bash
# Check backend status
curl https://agile-basin-06335-9109082620ce.herokuapp.com/health

# View logs
heroku logs --tail --app agile-basin-06335

# Check dyno status
heroku ps --app agile-basin-06335
```

---

## 🔄 Updating Your App

### Release New Version

1. **Build new version**:
   ```bash
   cd EloquentElectron
   npm run build:signed
   ```

2. **Update distribution**:
   ```bash
   cp dist/Eloquent-2.1.0-mac-universal.dmg distribution/
   cp dist/Eloquent-2.1.0-mac-universal.zip distribution/
   ```

3. **Update version in index.html**:
   - Change version numbers
   - Update file sizes if needed

4. **Push updates**:
   ```bash
   cd distribution
   git add .
   git commit -m "Release v2.1.1"
   git push
   ```

---

## 🐛 Troubleshooting

### Page Not Loading

**Problem**: 404 error when visiting GitHub Pages URL

**Solutions**:
- Wait 10 minutes (first deployment takes time)
- Check GitHub Pages is enabled in Settings
- Verify branch is set to "main" and folder to "/"
- Check repository is Public

### Downloads Not Working

**Problem**: Download links return 404

**Solutions**:
- Verify files are in the repository
- Check file names match exactly in index.html
- Files might be too large for GitHub (100MB limit per file)
- Consider using Git LFS for large files

### Files Too Large

**Problem**: GitHub rejects files over 100MB

**Solutions**:

1. **Use Git LFS** (Large File Storage):
   ```bash
   brew install git-lfs
   git lfs install
   git lfs track "*.dmg"
   git lfs track "*.zip"
   git add .gitattributes
   git add .
   git commit -m "Add LFS tracking"
   git push
   ```

2. **Alternative hosting**:
   - Host large files on AWS S3
   - Use GitHub Releases instead
   - Use Dropbox/Google Drive links

---

## 🎯 Alternative: GitHub Releases

If files are too large for Git LFS, use GitHub Releases:

### Create a Release

1. Go to your repository
2. Click **"Releases"** → **"Create a new release"**
3. Tag: `v2.1.0`
4. Title: `Eloquent v2.1.0`
5. Description: Copy from README.md
6. **Attach files**: Upload DMG and ZIP
7. Click **"Publish release"**

### Update Landing Page

Update download links in `index.html`:
```html
<a href="https://github.com/YOUR_USERNAME/eloquent-download/releases/download/v2.1.0/Eloquent-2.1.0-mac-universal.dmg">
    Download DMG
</a>
```

---

## 📱 Sharing Your App

### Share These Links

1. **Landing Page**: `https://YOUR_USERNAME.github.io/eloquent-download`
2. **Direct DMG**: `https://YOUR_USERNAME.github.io/eloquent-download/Eloquent-2.1.0-mac-universal.dmg`
3. **Repository**: `https://github.com/YOUR_USERNAME/eloquent-download`

### Marketing Channels

- 📧 Email to friends/colleagues
- 🐦 Twitter/X announcement
- 💼 LinkedIn post
- 🎮 Product Hunt launch
- 📱 Reddit (r/macapps, r/productivity)
- 🗣️ Hacker News Show HN

---

## 🎉 Success Checklist

- [ ] Repository created on GitHub
- [ ] Files pushed successfully
- [ ] GitHub Pages enabled
- [ ] Landing page accessible
- [ ] Downloads working
- [ ] Backend API running
- [ ] Tested on clean Mac
- [ ] Shared with 5+ beta users
- [ ] Collecting feedback

---

## 📞 Need Help?

- **GitHub Pages Docs**: https://pages.github.com
- **Git LFS Guide**: https://git-lfs.github.com
- **GitHub Support**: https://support.github.com

---

**Your app is ready to launch! 🚀**

Next: Run `./deploy-github-pages.sh` to get started!