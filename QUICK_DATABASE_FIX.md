# ⚡ Quick Database Fix

## The Problem
Your backend is using **MOCK DATA** because the Supabase service key is not configured.

## The Solution (2 Minutes)

### 1️⃣ Get Your Service Key
Go to: https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/settings/api

Copy the **"service_role"** key (the long one, not anon key)

### 2️⃣ Update .env
Replace this line in your `.env` file:
```bash
SUPABASE_SERVICE_KEY=your-service-key
```

With:
```bash
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # Your actual key
```

### 3️⃣ Set Up Tables
```bash
./setup-database.sh
```

Follow the prompts to create database tables.

### 4️⃣ Restart Backend
```bash
./kill-port-3000.sh
cd backend-go && go run main.go
```

### 5️⃣ Test It
```bash
./test-database-connection.sh
```

## Done! 🎉

Your backend is now connected to the real database.

---

**Need more details?** See `DATABASE_SETUP_GUIDE.md`
