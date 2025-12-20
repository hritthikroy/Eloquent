# API Request Monitoring Fix

## Issue
API request monitoring was not working in the admin panel. The API requests table was empty even though API calls were being logged.

## Root Cause
The `loadApiRequests()` function in `src/ui/admin.js` was just a placeholder that logged "API request monitoring - to be implemented" and never actually fetched or displayed the API request data.

## Solution Applied

### 1. Implemented `loadApiRequests()` Function
- Added proper IPC call to `admin-get-api-requests` handler
- Added error handling and logging
- Calls `renderApiRequests()` to display the data

### 2. Implemented `renderApiRequests()` Function
- Renders API requests in the table with proper formatting
- Shows request type with icons (🎤 Whisper, ✨ AI Rewrite, 📝 Grammar)
- Displays status badges (success/error)
- Shows duration in milliseconds
- Shows token count when available
- Shows user email or "Anonymous"
- Handles empty state gracefully

### 3. Implemented `formatTimestamp()` Helper
- Formats timestamps as relative time (e.g., "5m ago", "2h ago")
- Falls back to full date/time for older requests
- Provides better UX than raw ISO timestamps

### 4. Updated Refresh Functions
- Modified `refreshUsers()` to also refresh API requests
- Updated `startAutoRefresh()` to include API requests in the auto-refresh cycle
- API requests now refresh every 2 minutes along with other admin data

## Files Modified
- `src/ui/admin.js` - Added complete API request monitoring implementation

## Testing
The fix connects to the existing IPC handler `admin-get-api-requests` in `src/main.js` which:
- Returns the last 100 API requests from `ADMIN_CONFIG.apiRequests`
- Sorts by timestamp (newest first)
- Requires admin authentication

## Result
✅ API request monitoring now works correctly
✅ Requests are displayed in real-time
✅ Auto-refresh keeps the data current
✅ Proper error handling and empty states
