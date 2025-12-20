# 🗄️ Database Setup Guide

## Current Status

**❌ Database is NOT connected** - Your backend is using mock data instead of the real Supabase database.

## Why This Happened

The `SUPABASE_SERVICE_KEY` in your `.env` file is set to a placeholder:
```
SUPABASE_SERVICE_KEY=your-service-key
```

This causes the backend to fall back to mock data mode.

## Quick Fix (3 Steps)

### Step 1: Get Your Service Key

1. Open your Supabase dashboard:
   ```
   https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/settings/api
   ```

2. Find the **"service_role"** secret key (NOT the anon key)
   - Look for the key labeled "service_role"
   - Click the eye icon to reveal it
   - It should be a long JWT token starting with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. Copy the entire key

### Step 2: Update .env File

Open your `.env` file and replace:
```bash
SUPABASE_SERVICE_KEY=your-service-key
```

With your actual key:
```bash
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3M...
```

### Step 3: Set Up Database Tables

Run the automated setup script:
```bash
./setup-database.sh
```

This will:
- ✅ Verify your Supabase credentials
- ✅ Show you the database schema
- ✅ Guide you through creating tables
- ✅ Test the database connection
- ✅ Optionally create your admin user

## Manual Database Setup

If you prefer to set up manually:

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/editor
   ```

2. **Copy the schema:**
   ```bash
   cat backend-go/database/schema.sql
   ```

3. **Paste and run** in the SQL Editor

4. **Run the migration** (optional):
   ```bash
   cat backend-go/database/migrations/001_add_user_roles.sql
   ```

## Verify Everything Works

### 1. Test Database Connection
```bash
./test-database-connection.sh
```

Expected output:
```
✅ REST API connection successful
✅ Auth API connection successful
✅ Backend server is running
✅ Database query successful
```

### 2. Restart Backend
```bash
# Kill any running process
./kill-port-3000.sh

# Start backend
cd backend-go && go run main.go
```

### 3. Test Admin Endpoints
```bash
./test-admin-endpoints.sh
```

## What Changes After Setup

### Before (Mock Data):
- ❌ Users stored in memory only
- ❌ Data lost on restart
- ❌ Only 1 mock user exists
- ❌ No real authentication
- ❌ Usage not tracked

### After (Real Database):
- ✅ Users stored in Supabase
- ✅ Data persists across restarts
- ✅ Real users from Google OAuth
- ✅ Full authentication flow
- ✅ Usage tracking and limits
- ✅ Subscription management
- ✅ Admin panel shows real data

## Troubleshooting

### "Could not connect to users table"
**Solution:** The tables haven't been created yet. Run `./setup-database.sh` or manually create them in Supabase SQL Editor.

### "Invalid token" errors
**Solution:** Make sure you're using a valid Google OAuth token or the `dev-token` for testing.

### "Address already in use" on port 3000
**Solution:** Run `./kill-port-3000.sh` to free up the port.

### Backend still using mock data
**Solution:** 
1. Verify `SUPABASE_SERVICE_KEY` is set correctly in `.env`
2. Restart the backend server
3. Check logs for any connection errors

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your service key to git
- The service key has full admin access to your database
- Keep it in `.env` file (already in `.gitignore`)
- Rotate the key if it's ever exposed

## Helper Scripts

All scripts are in the root directory:

- `./setup-database.sh` - Interactive database setup
- `./test-database-connection.sh` - Test database connectivity
- `./test-admin-endpoints.sh` - Test admin API endpoints
- `./kill-port-3000.sh` - Free up port 3000

## Need Help?

Check these files for more info:
- `DATABASE_STATUS_REPORT.md` - Detailed status report
- `backend-go/database/schema.sql` - Database schema
- `backend-go/database/migrations/` - Database migrations
- `.env.example` - Example environment variables

## Next Steps

After database is set up:

1. ✅ Configure Google OAuth (if not already done)
2. ✅ Test user registration flow
3. ✅ Test admin panel functionality
4. ✅ Set up Stripe for payments (optional)
5. ✅ Deploy to production
