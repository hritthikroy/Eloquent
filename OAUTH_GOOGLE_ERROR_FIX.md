# OAuth Google Error Fix

## Problem
You were getting this Google OAuth error:
```
Access blocked: Authorization Error
access_type 'offline' not allowed for response_type token
Error 400: invalid_request
```

## Root Cause
The OAuth configuration was using **implicit flow** (`response_type=token`) with **offline access** (`access_type=offline`), which Google doesn't allow. Google requires the **authorization code flow** (`response_type=code`) for offline access.

## Fix Applied

### Changed OAuth Configuration in `src/services/auth-bridge.js`

**Before (❌ Broken):**
```javascript
const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}&response_type=token&prompt=select_account&access_type=offline&state=${timestamp}_${randomState}&approval_prompt=force&include_granted_scopes=true`;
```

**After (✅ Fixed):**
```javascript
const oauthUrl = `${supabaseUrl}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectUrl)}&response_type=code&prompt=select_account&state=${timestamp}_${randomState}&approval_prompt=force&include_granted_scopes=true`;
```

### Key Changes:
1. **Changed `response_type=token` to `response_type=code`** - Uses authorization code flow instead of implicit flow
2. **Removed `access_type=offline`** - Not needed and causes the error with implicit flow
3. **Kept other parameters** - `prompt=select_account`, `approval_prompt=force`, etc. for account switching

## How Authorization Code Flow Works

1. **User clicks "Sign in with Google"**
2. **App generates OAuth URL** with `response_type=code`
3. **User completes Google authentication**
4. **Google redirects to Supabase** with authorization code
5. **Supabase exchanges code for tokens** (happens automatically)
6. **Supabase redirects to your backend** with tokens
7. **Backend redirects to Electron app** with tokens
8. **App processes tokens and authenticates user**

## Testing the Fix

### Method 1: Quick Test
```bash
./test-oauth-url-fix.sh
```

### Method 2: Manual Test
1. Start the app: `npm start`
2. Click "Sign in with Google"
3. You should **NOT** see the "Access blocked" error anymore
4. Complete Google OAuth normally
5. You should be redirected back to the app successfully

## Expected Behavior

### Before Fix:
- Click "Sign in with Google"
- Google shows: "Access blocked: Authorization Error"
- OAuth fails immediately

### After Fix:
- Click "Sign in with Google"
- Google shows normal OAuth consent screen
- User can select account and grant permissions
- User is redirected back to app successfully
- App authenticates and shows dashboard

## Why This Fix Works

**Google's OAuth Policy:**
- ✅ `response_type=code` (authorization code flow) - Allowed
- ✅ `response_type=token` (implicit flow) - Allowed for client-side apps
- ❌ `response_type=token` + `access_type=offline` - **NOT ALLOWED**

**Supabase Compatibility:**
- Supabase supports both authorization code flow and implicit flow
- With `response_type=code`, Supabase handles the code exchange automatically
- The end result is the same - you get tokens in your redirect URL

## Files Modified
- `src/services/auth-bridge.js` - Fixed OAuth URL generation
- `test-oauth-url-fix.sh` - New test script (created)

## Verification
After applying this fix, the OAuth URL will look like:
```
https://your-project.supabase.co/auth/v1/authorize?provider=google&redirect_to=...&response_type=code&prompt=select_account&state=...&approval_prompt=force&include_granted_scopes=true
```

Notice:
- ✅ `response_type=code` (instead of `token`)
- ❌ No `access_type=offline` parameter

This should resolve the Google OAuth error completely.