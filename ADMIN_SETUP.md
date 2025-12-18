# Admin Role Setup

## Overview
The admin role system has been implemented to give `hritthikin@gmail.com` admin privileges while keeping all other users as regular users.

## What Was Changed

### 1. Backend (Go)
- **User Model** (`internal/models/user.go`):
  - Added `Role` field to User struct
  - Added `IsAdmin()`, `GetRole()`, and `IsAdminEmail()` helper methods
  - `hritthikin@gmail.com` is hardcoded as admin email

- **User Service** (`internal/services/user.go`):
  - Updated `CreateOrUpdateGoogleUser()` to assign admin role based on email
  - Updated `GetUserByID()` to include role field

- **Auth Handler** (`internal/handlers/auth.go`):
  - Updated API responses to include user role information

### 2. Database
- **Schema** (`database/schema.sql`):
  - Added `role` column to users table with default value 'user'

- **Migration** (`database/migrations/001_add_user_roles.sql`):
  - Migration script to add role column to existing databases
  - Automatically sets `hritthikin@gmail.com` as admin

### 3. Frontend (JavaScript)
- **Auth Service** (`auth-service.js`):
  - `isAdmin()` method already existed and works correctly
  - Updated development mode to use admin email
  - Role information is preserved in user sessions

## How It Works

1. **User Registration/Login**:
   - When a user signs in with Google OAuth
   - Backend checks if email matches `hritthikin@gmail.com`
   - If yes: assigns `role: "admin"`
   - If no: assigns `role: "user"`

2. **Admin Panel Access**:
   - Admin panel (`admin.html`) checks user role via IPC
   - `admin-verify-access` handler uses `isAdminUser()` utility
   - Checks both role field and email fallback
   - Only admin users can access admin features

3. **Fallback System**:
   - If backend doesn't return role, checks email directly
   - `hritthikin@gmail.com` always gets admin access
   - Works even if backend role system isn't deployed

4. **Development Mode**:
   - Mock user automatically gets admin role for testing
   - Uses `hritthikin@gmail.com` as development email

## Admin Features
- API configuration management
- User management
- Request monitoring and analytics
- System statistics

## Security
- Role is assigned server-side based on email verification
- Frontend admin checks prevent unauthorized access
- All admin IPC handlers verify role before executing

## Adding More Admins
To add more admin emails, update both:

1. **Backend** - `IsAdminEmail()` function in `internal/models/user.go`:
```go
func IsAdminEmail(email string) bool {
    adminEmails := []string{
        "hritthikin@gmail.com",
        "another-admin@example.com", // Add more here
    }
    // ... rest of function
}
```

2. **Frontend** - `admin-check.js` file:
```javascript
const adminEmails = [
  'hritthikin@gmail.com',
  'another-admin@example.com' // Add more here
];
```