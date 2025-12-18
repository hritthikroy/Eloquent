# 🔐 OAuth Setup Guide for Eloquent Production

## ✅ Current Status

Your OAuth configuration is now ready for production! All backend endpoints are deployed and working.

## 🎯 Final Configuration Steps

### 1. Configure Supabase Dashboard

Go to: https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol

#### A. URL Configuration (Authentication > URL Configuration)

**Site URL:**
```
https://agile-basin-06335-9109082620ce.herokuapp.com
```

**Redirect URLs (add this to the list):**
```
https://agile-basin-06335-9109082620ce.herokuapp.com/auth/success
```

#### B. Google OAuth Provider (Authentication > Providers > Google)

Make sure:
- ✅ Google OAuth is **enabled**
- ✅ Your **Google Client ID** is configured
- ✅ Your **Google Client Secret** is configured

### 2. Configure Google Cloud Console

Go to: https://console.cloud.google.com/apis/credentials

In your OAuth 2.0 Client ID settings, add this **Authorized redirect URI**:
```
https://apphxfvhpqogsquqlaol.supabase.co/auth/v1/callback
```

## 🧪 Testing Your OAuth Setup

### Test 1: Generate OAuth URL
```bash
node test-oauth-url.js
```

This will generate a test OAuth URL you can use in your browser.

### Test 2: Test Full OAuth Flow
```bash
node test-production-oauth.js
```

This runs all connectivity tests.

### Test 3: Manual Browser Test

1. Copy this URL:
```
https://apphxfvhpqogsquqlaol.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fagile-basin-06335-9109082620ce.herokuapp.com%2Fauth%2Fsuccess&access_type=offline&prompt=consent
```

2. Paste it in your browser
3. Complete Google sign-in
4. You should be redirected to the success page

## 🚀 How the OAuth Flow Works

1. **User clicks "Sign in with Google"** in your Electron app
2. **App opens browser** with Supabase OAuth URL
3. **User authorizes** with Google
4. **Google redirects** to Supabase callback
5. **Supabase redirects** to your backend: `/auth/success`
6. **Success page extracts tokens** from URL fragment
7. **Tokens sent back** to Electron app via custom protocol
8. **App completes authentication** and stores session

## 📁 Important Files

- `.env` - Development environment variables
- `.env.production` - Production environment variables
- `auth-service.js` - Authentication service
- `main.js` - Electron main process (OAuth handling)
- `backend-go/main.go` - Go backend with OAuth endpoints

## 🔧 Troubleshooting

### Error: "redirect_uri_mismatch"
- Make sure the redirect URL in Supabase matches exactly: `https://agile-basin-06335-9109082620ce.herokuapp.com/auth/success`
- Check that Google Console has the Supabase callback URL: `https://apphxfvhpqogsquqlaol.supabase.co/auth/v1/callback`

### Error: "Invalid request"
- Verify Google OAuth is enabled in Supabase
- Check that Client ID and Secret are correct
- Ensure your Google Cloud project has the OAuth consent screen configured

### Error: "Authentication Failed"
- This is normal when accessing the callback URL directly
- The callback only works when redirected from Google with tokens

## 🎉 Success Indicators

You'll know OAuth is working when:
- ✅ No "redirect_uri_mismatch" errors
- ✅ Google sign-in completes successfully
- ✅ You're redirected to the success page
- ✅ Electron app receives tokens and completes sign-in
- ✅ Dashboard shows your user info

## 📞 Support

If you encounter issues:
1. Check the browser console for errors
2. Check Electron console logs
3. Verify all URLs match exactly (no trailing slashes)
4. Test with the provided test scripts

---

**Last Updated:** December 18, 2025
**Backend Version:** v14
**OAuth Redirect URL:** https://agile-basin-06335-9109082620ce.herokuapp.com/auth/success
