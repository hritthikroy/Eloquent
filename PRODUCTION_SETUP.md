# Production Mode Setup Guide

## Step 1: Create Supabase Project

1. **Go to Supabase**:
   - Visit [supabase.com](https://supabase.com)
   - Sign up or log in
   - Click "New Project"

2. **Create Project**:
   - Choose organization
   - Enter project name: "eloquent-voice-app"
   - Enter database password (save this!)
   - Select region closest to your users
   - Click "Create new project"

3. **Get Project Credentials**:
   - Go to Settings > API
   - Copy your **Project URL** (looks like: `https://abcdefgh.supabase.co`)
   - Copy your **anon/public key** (starts with `eyJ...`)

## Step 2: Set Up Google OAuth

1. **Go to Google Cloud Console**:
   - Visit [console.cloud.google.com](https://console.cloud.google.com)
   - Create new project or select existing one

2. **Enable APIs**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google+ API" and enable it
   - Search for "Google Identity" and enable it

3. **Create OAuth Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Web application"
   - Name: "Eloquent Voice App"
   - Add Authorized redirect URIs:
     - `https://YOUR_SUPABASE_URL/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for development)
     - `https://your-production-domain.com/auth/callback` (for production)
   - Click "Create"
   - Copy Client ID and Client Secret

## Step 3: Configure Supabase Authentication

1. **In Supabase Dashboard**:
   - Go to Authentication > Providers
   - Find "Google" and click to configure
   - Enable Google provider
   - Enter your Google Client ID
   - Enter your Google Client Secret
   - Click "Save"

## Step 4: Update Environment Variables

Replace your `.env` file with real credentials:

```env
# Groq API Keys (keep your existing ones)
GROQ_API_KEY_1=your_existing_groq_key
GROQ_API_KEY_2=
GROQ_API_KEY_3=
GROQ_API_KEY_4=
GROQ_API_KEY_5=

# App Settings
LANGUAGE=en
AI_MODE=qn
AUTO_GRAMMAR_FIX=true
PRESERVE_CLIPBOARD=false

# Production Supabase Configuration
ELOQUENT_API_URL=https://your-production-domain.com
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# OAuth Redirect URL for production
OAUTH_REDIRECT_URL=https://your-production-domain.com/auth/callback
```

## Step 5: Test Production Mode

1. **Restart the app**:
   ```bash
   npm start
   ```

2. **Verify production mode**:
   - Check console logs for "Development mode" messages (should be gone)
   - Click "Continue with Google" button
   - Should redirect to real Google OAuth

## Step 6: Set Up Backend (Optional)

If you want full functionality, set up the Go backend:

1. **Configure backend**:
   ```bash
   cd backend-go
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

2. **Run backend**:
   ```bash
   go run main.go
   ```

## Troubleshooting

### Common Issues:

1. **"Invalid redirect URI"**:
   - Make sure redirect URIs in Google Console match exactly
   - Include both production and localhost URLs

2. **"Invalid API key"**:
   - Double-check Supabase credentials
   - Ensure no extra spaces or characters

3. **OAuth popup blocked**:
   - Allow popups for the app
   - Try different browser

### Quick Fixes:

- **Reset to development mode**: Change SUPABASE_URL back to placeholder
- **Check logs**: Look at browser console and terminal output
- **Verify credentials**: Test in Supabase dashboard first

## Security Notes

- Never commit real API keys to version control
- Use environment variables for all secrets
- Consider using different projects for dev/staging/production
- Regularly rotate API keys

## Next Steps

Once production mode is working:
1. Set up proper user management
2. Configure subscription billing
3. Deploy backend to production server
4. Set up monitoring and logging
5. Configure proper domain and SSL