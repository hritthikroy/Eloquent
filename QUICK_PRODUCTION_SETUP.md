# 🚀 Quick Production Setup (5 minutes)

This guide will help you configure Eloquent for production mode with real Google OAuth authentication.

## ✅ Prerequisites Checklist

Before starting, make sure you have:
- [ ] Supabase account (free at [supabase.com](https://supabase.com))
- [ ] Groq API account (free at [console.groq.com](https://console.groq.com))
- [ ] Google Cloud Console access (free at [console.cloud.google.com](https://console.cloud.google.com))

## 🔧 Step 1: Get Groq API Key (2 minutes)

1. **Visit**: [console.groq.com](https://console.groq.com)
2. **Sign up** with your email
3. **Go to**: API Keys section
4. **Click**: "Create API Key"
5. **Copy** the key (starts with `gsk_`)
6. **Paste** it in `.env` file replacing `gsk_your_api_key_here`

```env
GROQ_API_KEY_1=gsk_your_actual_key_here
```

## 🔧 Step 2: Get Supabase Credentials (2 minutes)

Your Supabase project is already created! Just get the credentials:

1. **Visit**: [supabase.com/dashboard/project/apphxfvhpqogsquqlaol](https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol)
2. **Click**: Settings → API (in left sidebar)
3. **Copy** the "anon public" key (starts with `eyJ`)
4. **Paste** it in `.env` file replacing `your-anon-key`

```env
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.your_actual_key_here
```

## 🔧 Step 3: Configure Google OAuth (1 minute)

The Google OAuth is already configured in Supabase! Just verify:

1. **In Supabase dashboard**: Go to Authentication → Providers
2. **Check**: Google provider is enabled
3. **Verify**: Redirect URLs include your domain

## ✅ Step 4: Test Production Mode

1. **Validate configuration**:
   ```bash
   node validate-production.js
   ```

2. **Start the app**:
   ```bash
   npm start
   ```

3. **Look for these signs**:
   - ✅ No "Development mode detected" in console
   - ✅ Google sign-in opens real Google OAuth
   - ✅ User authentication works properly

## 🎯 Expected Results

After configuration, you should see:

```
🚀 Production mode detected - using real Google OAuth
💡 Supabase URL: https://apphxfvhpqogsquqlaol.supabase.co
✅ Eloquent is ready! Look for the microphone icon in your menu bar.
```

## 🔧 Troubleshooting

### "Invalid API key" error
- Double-check your Groq API key starts with `gsk_`
- Make sure there are no extra spaces

### "Invalid redirect URI" error  
- Check Google OAuth settings in Supabase
- Verify redirect URLs match exactly

### Still seeing "Development mode"
- Run `node validate-production.js` to check configuration
- Make sure all credentials are properly set

## 🆘 Need Help?

- **Detailed guide**: See `PRODUCTION_SETUP.md`
- **Quick validation**: Run `node validate-production.js`
- **Reset to dev mode**: Change `SUPABASE_ANON_KEY` back to `your-anon-key`

---

**🎉 That's it! Your app is now in production mode with real authentication.**