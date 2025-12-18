# Production Mode Setup - Complete Guide

## 🎯 What You Need to Do

To switch from development mode to production mode with real Google OAuth:

### Quick Setup (5 minutes)
```bash
# 1. Run the setup script
./setup-production.sh

# 2. Follow prompts to edit .env with your credentials

# 3. Validate setup
npm run validate-production

# 4. Start in production mode
npm start
```

### Manual Setup
```bash
# 1. Copy production template
cp .env.production .env

# 2. Edit .env with real credentials (see below)

# 3. Test the setup
npm start
```

## 🔑 Required Credentials

Edit `.env` and replace these values:

```env
# Replace with your real Supabase project URL
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co

# Replace with your real Supabase anon key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Replace with your real Groq API key
GROQ_API_KEY_1=gsk_your_real_groq_api_key_here
```

## 📋 Prerequisites

Before you can use production mode, you need:

1. **Supabase Project**:
   - Go to [supabase.com](https://supabase.com)
   - Create new project
   - Get URL and anon key from Settings > API

2. **Google OAuth Setup**:
   - Create project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable Google+ API
   - Create OAuth 2.0 credentials
   - Configure in Supabase Authentication > Providers

3. **Groq API Key**:
   - Get free key from [console.groq.com](https://console.groq.com)

## 🔍 How to Tell if Production Mode is Working

### Development Mode (Current):
```
🔧 Development mode detected - using mock authentication
💡 To enable production mode: ./setup-production.sh
```

### Production Mode (Target):
```
🚀 Production mode detected - using real Google OAuth
💡 Supabase URL: https://yourproject.supabase.co
```

## 📁 Files Created for Production Setup

| File | Purpose |
|------|---------|
| `.env.production` | Template with production settings |
| `setup-production.sh` | Automated setup script |
| `validate-production.js` | Configuration validator |
| `PRODUCTION_SETUP.md` | Detailed setup guide |
| `QUICK_START_PRODUCTION.md` | Fast setup instructions |

## 🚀 New NPM Scripts

```bash
npm run setup-production    # Run setup wizard
npm run validate-production # Check configuration
npm run prod               # Start in production mode
```

## ⚡ Quick Test

After setup, test that production mode works:

1. **Start the app**: `npm start`
2. **Check console**: Should show "Production mode detected"
3. **Test Google sign-in**: Should redirect to real Google OAuth
4. **No development button**: "Continue in Development Mode" should be hidden

## 🔄 Switch Between Modes

### To Production Mode:
```bash
cp .env.production .env
# Edit .env with real credentials
npm start
```

### Back to Development Mode:
```bash
cp .env.example .env
npm start
```

## 🐛 Common Issues

**Still seeing "Development mode"?**
- Check `.env` has real Supabase URL (not placeholder)
- Ensure no typos in environment variables
- Run `npm run validate-production`

**Google OAuth not working?**
- Verify redirect URIs in Google Cloud Console
- Check Supabase Google provider is enabled
- Test credentials in Supabase dashboard first

**"Connection timeout"?**
- Check internet connection
- Verify Supabase project is active
- Try different network if behind firewall

## 📞 Need Help?

1. **Check validation**: `npm run validate-production`
2. **Read detailed guide**: `PRODUCTION_SETUP.md`
3. **Check troubleshooting**: `TROUBLESHOOTING.md`
4. **Look at console logs** when starting the app

## ✅ Success Checklist

- [ ] Supabase project created
- [ ] Google OAuth configured
- [ ] `.env` file updated with real credentials
- [ ] `npm run validate-production` passes
- [ ] App starts with "Production mode detected"
- [ ] Google sign-in works with real OAuth flow

Once all items are checked, your app is running in full production mode! 🎉