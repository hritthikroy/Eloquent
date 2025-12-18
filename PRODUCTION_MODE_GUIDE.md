# 🚀 Production Mode Configuration Guide

This guide explains how to configure Eloquent for production mode with real Google OAuth authentication.

## 📋 What is Production Mode?

**Development Mode** (default):
- Uses mock authentication (no real Google sign-in)
- Bypasses user management
- Works offline
- Good for testing and development

**Production Mode**:
- Real Google OAuth authentication
- User accounts and subscription management
- Cloud data storage via Supabase
- Full feature set with usage tracking

## ⚡ Quick Setup (5 minutes)

### Option 1: Interactive Setup (Recommended)
```bash
npm run configure-production
```

### Option 2: Manual Setup
1. **Get Groq API Key** (free):
   - Visit [console.groq.com](https://console.groq.com)
   - Create account and API key
   - Copy key (starts with `gsk_`)

2. **Get Supabase Credentials**:
   - Visit [your Supabase project](https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol)
   - Go to Settings → API
   - Copy "anon public" key (starts with `eyJ`)

3. **Update .env file**:
   ```env
   GROQ_API_KEY_1=gsk_your_actual_key_here
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here
   ```

## 🔍 Check Configuration Status

```bash
# Quick status check
npm run check-production

# Detailed validation
npm run validate-production
```

## 🎯 Available Scripts

| Script | Purpose |
|--------|---------|
| `npm run check-production` | Quick production mode status |
| `npm run configure-production` | Interactive setup wizard |
| `npm run validate-production` | Detailed configuration validation |
| `npm start` | Start the application |

## ✅ Verification Steps

After configuration, verify production mode:

1. **Run validation**:
   ```bash
   npm run validate-production
   ```
   Should show all ✅ green checkmarks

2. **Start the app**:
   ```bash
   npm start
   ```

3. **Look for production indicators**:
   ```
   🚀 Production mode detected - using real Google OAuth
   💡 Supabase URL: https://apphxfvhpqogsquqlaol.supabase.co
   ```

4. **Test authentication**:
   - Click "Sign In with Google"
   - Should open real Google OAuth (not development mode)
   - Successfully authenticate and return to app

## 🔧 Troubleshooting

### Still seeing "Development mode detected"?
```bash
# Check what's missing
npm run check-production

# Common issues:
# - SUPABASE_ANON_KEY still says "your-anon-key"
# - GROQ_API_KEY_1 still says "gsk_your_api_key_here"
```

### "Invalid API key" errors?
- Verify Groq key starts with `gsk_`
- Check for extra spaces or characters
- Generate a new key if needed

### Google OAuth not working?
- Verify Supabase anon key is correct
- Check internet connection
- Try refreshing the OAuth window

### Want to go back to development mode?
```bash
# Edit .env and change:
SUPABASE_ANON_KEY=your-anon-key
```

## 📚 Additional Resources

- **Quick Setup**: `QUICK_PRODUCTION_SETUP.md`
- **Detailed Guide**: `PRODUCTION_SETUP.md`
- **Heroku Deployment**: `HEROKU_DEPLOYMENT.md`

## 🆘 Getting Help

1. **Check status**: `npm run check-production`
2. **Validate config**: `npm run validate-production`
3. **Review logs**: Look at console output when starting app
4. **Reset to dev**: Change `SUPABASE_ANON_KEY=your-anon-key` in `.env`

---

**🎉 Once configured, your app will have full production features with real user authentication!**