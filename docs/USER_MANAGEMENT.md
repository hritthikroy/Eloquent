# User Management System

This document describes the user management system added to the Eloquent admin panel.

## Features

### Admin Panel Access
- **Menu Access**: Right-click the tray icon → "👥 User Management"
- **Keyboard Shortcut**: `Cmd+Shift+U` (macOS)
- **Requirements**: Admin user authentication required

### User Management Capabilities

#### 1. View Users
- **Search**: Search users by email or name
- **Filter**: Filter users by subscription plan (free, starter, pro, unlimited, enterprise)
- **User Information**: View user details including:
  - Email and name
  - Current subscription plan
  - User role (user, admin, moderator)
  - Usage statistics (current month usage vs. limit)
  - Subscription status
  - Last login time

#### 2. Edit User Plans
- Change user subscription plans
- Available plans:
  - **Free**: 60 minutes/month, basic transcription
  - **Starter**: 180 minutes/month, basic transcription + AI rewrite
  - **Pro**: 600 minutes/month, all features + priority support
  - **Unlimited**: Unlimited usage, all features + API access
  - **Enterprise**: Unlimited usage, all features

#### 3. User Actions
- **Edit Plan**: Change a user's subscription plan
- **Reset Usage**: Reset a user's monthly usage counter
- **Delete User**: Remove a user account (cannot delete your own account)
- **View Details**: See detailed user information and usage logs

#### 4. Bulk Operations
- Select multiple users with checkboxes
- Apply bulk changes to:
  - Subscription plans
  - User roles
- Bulk update up to 100 users at once

## API Endpoints

The user management system uses the following backend API endpoints:

### Admin Routes (require admin authentication)
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/plan` - Update user plan
- `PUT /api/admin/users/:id/role` - Update user role
- `POST /api/admin/users/:id/reset-usage` - Reset user usage
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/stats` - Get admin statistics
- `GET /api/admin/search` - Search users
- `GET /api/admin/users/plan/:plan` - Get users by plan
- `PUT /api/admin/users/bulk` - Bulk update users

## Security

### Authentication
- All admin endpoints require valid authentication token
- Only users with admin role can access user management
- Admin status is verified on both frontend and backend

### Authorization
- Admin users are defined in `internal/models/user.go`
- Admin emails are hardcoded for security
- Non-admin users cannot access any admin functionality

### Data Protection
- User data is handled securely
- Sensitive operations require confirmation
- Audit logging for admin actions

## Usage Instructions

### For Administrators

1. **Access User Management**
   - Ensure you're logged in as an admin user
   - Right-click the Eloquent tray icon
   - Select "👥 User Management"

2. **Search and Filter Users**
   - Use the search box to find users by email or name
   - Use the plan filter dropdown to filter by subscription plan
   - Click "Refresh" to reload the user list

3. **Edit User Plans**
   - Click "Edit Plan" next to a user
   - Enter the new plan name when prompted
   - Valid plans: free, starter, pro, unlimited, enterprise

4. **Bulk Operations**
   - Select users using the checkboxes
   - Choose the changes to apply in the bulk actions panel
   - Click "Apply Changes" to update all selected users

5. **View User Details**
   - Click "View" next to a user to see detailed information
   - View usage statistics and recent activity logs
   - Perform additional actions from the detail modal

### For Developers

#### Adding New Admin Users
Edit `EloquentElectron/backend-go/internal/models/user.go`:

```go
func IsAdminEmail(email string) bool {
    adminEmails := []string{
        "admin@example.com",
        "your-email@domain.com", // Add new admin emails here
    }
    
    for _, adminEmail := range adminEmails {
        if email == adminEmail {
            return true
        }
    }
    return false
}
```

#### Extending User Management
1. Add new fields to the `User` model in `internal/models/user.go`
2. Update the admin handlers in `internal/handlers/admin.go`
3. Modify the frontend UI in `src/ui/user-management.html`
4. Update the API endpoints in `main.go`

## Troubleshooting

### Common Issues

1. **"Access Denied" Error**
   - Ensure you're logged in as an admin user
   - Check that your email is in the admin list
   - Restart the application if needed

2. **"Failed to load users" Error**
   - Check that the backend server is running
   - Verify network connectivity
   - Check browser console for detailed error messages

3. **User Management Window Not Opening**
   - Try the keyboard shortcut `Cmd+Shift+U`
   - Check that you have admin privileges
   - Restart the application

### Backend Issues

1. **API Endpoints Not Working**
   - Ensure the Go backend is running on port 3000
   - Check the backend logs for errors
   - Verify database connectivity

2. **Authentication Failures**
   - Check Supabase configuration
   - Verify JWT tokens are valid
   - Check admin role assignment

## Development Mode

In development mode, the system uses mock data:
- Mock users with different plans and roles
- Simulated usage statistics
- Test admin functionality without real database

To enable production mode:
1. Configure Supabase credentials in `.env`
2. Set up the database schema
3. Deploy the backend server

## Future Enhancements

Potential improvements for the user management system:

1. **Advanced Filtering**
   - Filter by registration date
   - Filter by usage patterns
   - Filter by subscription status

2. **User Analytics**
   - Usage trends and patterns
   - Revenue analytics
   - User engagement metrics

3. **Automated Actions**
   - Automatic plan upgrades/downgrades
   - Usage limit notifications
   - Subscription renewal reminders

4. **Export Functionality**
   - Export user lists to CSV
   - Generate usage reports
   - Backup user data

5. **Real-time Updates**
   - Live user activity monitoring
   - Real-time usage tracking
   - Instant notifications for admin actions