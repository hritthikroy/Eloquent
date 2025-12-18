# Quick Start: Production Mode

## 🚀 Fast Track to Production

### Option 1: Automated Setup (Recommended)
```bash
# Run the setup script
./setup-production.sh

# Follow the prompts to configure your credentials
# Then start the app
npm start
```

### Option 2: Manual Setup
```bash
# 1. Copy production template
cp .env.production .env

# 2. Edit .env with your credentials
# Replace these values:
# - SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
# - SUPABASE_ANON_KEY=eyJ... (from Supabase)
# - GROQ_API_KEY_1=gsk_... (from Groq)

# 3. Validate configuration
npm run validate-production

# 4. Start in production mode
npm start
```

## 📋 Prerequisites Checklist

Before setting up production mode, ensure you have:

- [ ] **Supabase Project**: Created at [supabase.com](https://supabase.com)
- [ ] **Google Cloud Project**: Set up at [console.cloud.google.com](https://console.cloud.google.com)
- [ ] **Google OAuth Credentials**: Client ID and Secret from Google Cloud
- [ ] **Supabase Google Auth**: Configured in Supabase dashboard
- [ ] **Groq API Key**: From [console.groq.com](https://console.groq.com)

## 🔧 Required Credentials

You'll need these values for your `.env` file:

| Variable | Where to Get It | Example |
|----------|----------------|---------|
| `SUPABASE_URL` | Supabase Dashboard > Settings > API | `https://abc123.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API | `eyJhbGciOiJIUzI1NiIs...` |
| `GROQ_API_KEY_1` | Groq Console > API Keys | `gsk_abc123...` |

## ✅ Verification Steps

After setup, verify production mode is working:

1. **Check Console Output**:
   ```
   🚀 Production mode detected - using real Google OAuth
   ```

2. **Test Google Sign-in**:
   - Click "Continue with Google"
   - Should redirect to real Google OAuth (not placeholder URL)
   - Should complete authentication flow

3. **Validate Configuration**:
   ```bash
   npm run validate-production
   ```

## 🐛 Troubleshooting

### Common Issues:

**"Development mode detected"**
- Check your `.env` file has real Supabase credentials
- Ensure SUPABASE_URL doesn't contain "your-project"

**"Invalid redirect URI"**
- Add redirect URIs in Google Cloud Console:
  - `https://YOUR_PROJECT.supabase.co/auth/v1/callback`
  - `http://localhost:3000/auth/callback`

**"Connection timeout"**
- Check internet connection
- Verify Supabase project is active
- Test credentials in Supabase dashboard

### Quick Fixes:

```bash
# Reset to development mode
cp .env.example .env

# Validate current setup
npm run validate-production

# Check logs
npm start # Look for error messages in console
```

## 📚 Detailed Guides

For complete setup instructions:
- **Full Setup**: `PRODUCTION_SETUP.md`
- **Troubleshooting**: `TROUBLESHOOTING.md`
- **Google OAuth**: See Google Cloud Console documentation

## 🎯 Success Indicators

You'll know production mode is working when:
- ✅ No "Development mode" messages in console
- ✅ Google sign-in uses real OAuth flow
- ✅ User data is stored in Supabase
- ✅ All app features work with real authentication

## 🔄 Switch Back to Development

If you need to return to development mode:
```bash
# Restore development settings
cp .env.example .env
npm start
```

The app will automatically detect placeholder credentials and switch to development mode.