# Install Heroku CLI

## 🍎 macOS Installation Options

### Option 1: Homebrew (Recommended)
```bash
# Install Homebrew if you don't have it
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Heroku CLI
brew tap heroku/brew && brew install heroku
```

### Option 2: Direct Download
```bash
# Download and install
curl https://cli-assets.heroku.com/install.sh | sh
```

### Option 3: Manual Download
1. Go to [https://devcenter.heroku.com/articles/heroku-cli](https://devcenter.heroku.com/articles/heroku-cli)
2. Download the macOS installer
3. Run the installer

## ✅ Verify Installation

After installation, verify it works:
```bash
heroku --version
heroku login
```

## 🚀 Then Deploy

Once Heroku CLI is installed:
```bash
cd EloquentElectron
./deploy-heroku.sh
```

## 🔧 Alternative: Manual Deployment

If you prefer not to install Heroku CLI, you can deploy manually:

### 1. Create Heroku Account
- Go to [heroku.com](https://heroku.com)
- Sign up for free account

### 2. Deploy via GitHub
1. Push your code to GitHub
2. Connect GitHub repo to Heroku
3. Enable automatic deploys

### 3. Set Environment Variables
In Heroku dashboard, go to Settings > Config Vars and add:
- `ENVIRONMENT=production`
- `SUPABASE_URL=https://your-project.supabase.co`
- `SUPABASE_ANON_KEY=eyJ...`
- `GROQ_API_KEY=gsk_...`
- `ALLOWED_ORIGINS=*`

## 📱 GitHub Deployment Steps

1. **Push to GitHub**:
   ```bash
   cd EloquentElectron/backend-go
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/eloquent-backend.git
   git push -u origin main
   ```

2. **Connect to Heroku**:
   - Go to Heroku Dashboard
   - Create new app
   - Go to Deploy tab
   - Connect GitHub repository
   - Enable automatic deploys

3. **Set Buildpack**:
   - Go to Settings tab
   - Add buildpack: `heroku/go`

4. **Configure Environment**:
   - Go to Settings > Config Vars
   - Add all required environment variables

## 🎯 Quick Test

After deployment, test your API:
```bash
curl https://your-app-name.herokuapp.com/health
```

Should return: `{"status":"ok","timestamp":"..."}`