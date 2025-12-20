#!/bin/bash

# Database Setup Script
# This script helps you set up the Supabase database for Eloquent

echo "🗄️  Eloquent Database Setup"
echo "=========================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if Supabase is configured
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_KEY" ]; then
    echo "❌ Error: Supabase credentials not configured"
    echo ""
    echo "Please set the following in your .env file:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_KEY"
    echo ""
    exit 1
fi

# Check if service key is placeholder
if [ "$SUPABASE_SERVICE_KEY" = "your-service-key" ]; then
    echo "❌ Error: SUPABASE_SERVICE_KEY is still a placeholder"
    echo ""
    echo "Please update SUPABASE_SERVICE_KEY in your .env file with your real service key"
    echo "Get it from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api"
    echo ""
    exit 1
fi

echo "✅ Supabase credentials found"
echo ""

# Display schema file
echo "📄 Database Schema"
echo "=================="
echo ""
echo "The schema is defined in: backend-go/database/schema.sql"
echo ""
echo "Tables to create:"
echo "  1. users - User accounts and profiles"
echo "  2. devices - User devices"
echo "  3. usage_logs - Usage tracking"
echo ""

# Ask user if they want to see the schema
read -p "Do you want to view the schema? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat backend-go/database/schema.sql
    echo ""
fi

# Instructions for manual setup
echo "📝 Setup Instructions"
echo "===================="
echo ""
echo "To set up your database, follow these steps:"
echo ""
echo "1. Go to your Supabase SQL Editor:"
echo "   https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/editor"
echo ""
echo "2. Create a new query and paste the contents of:"
echo "   backend-go/database/schema.sql"
echo ""
echo "3. Run the query to create all tables and indexes"
echo ""
echo "4. (Optional) Run the migration:"
echo "   backend-go/database/migrations/001_add_user_roles.sql"
echo ""
echo "5. Verify tables were created in the Table Editor:"
echo "   https://supabase.com/dashboard/project/apphxfvhpqogsquqlaol/editor"
echo ""

# Offer to copy schema to clipboard (macOS)
if command -v pbcopy &> /dev/null; then
    read -p "Copy schema to clipboard? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cat backend-go/database/schema.sql | pbcopy
        echo "✅ Schema copied to clipboard!"
        echo "   Now paste it into Supabase SQL Editor"
        echo ""
    fi
fi

# Test connection
echo "🔍 Testing Database Connection"
echo "=============================="
echo ""

# Try to query users table
RESPONSE=$(curl -s -w "\n%{http_code}" \
    "${SUPABASE_URL}/rest/v1/users?select=count" \
    -H "apikey: ${SUPABASE_SERVICE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n 1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Database connection successful!"
    echo "   Users table exists and is accessible"
    echo ""
    
    # Try to get user count
    USER_COUNT=$(echo "$BODY" | jq -r '.[0].count' 2>/dev/null)
    if [ -n "$USER_COUNT" ] && [ "$USER_COUNT" != "null" ]; then
        echo "📊 Current users in database: $USER_COUNT"
    fi
else
    echo "⚠️  Could not connect to users table (HTTP $HTTP_CODE)"
    echo ""
    if [ "$HTTP_CODE" = "404" ]; then
        echo "   This likely means the tables haven't been created yet."
        echo "   Follow the setup instructions above to create them."
    else
        echo "   Response: $BODY"
    fi
fi
echo ""

# Create admin user if needed
read -p "Do you want to create/update your admin user? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter admin email (default: hritthikin@gmail.com): " ADMIN_EMAIL
    ADMIN_EMAIL=${ADMIN_EMAIL:-hritthikin@gmail.com}
    
    echo ""
    echo "Creating/updating admin user: $ADMIN_EMAIL"
    
    # Upsert admin user
    UPSERT_DATA=$(cat <<EOF
{
  "email": "$ADMIN_EMAIL",
  "role": "admin",
  "plan": "enterprise",
  "subscription_status": "active",
  "name": "Admin User"
}
EOF
)
    
    UPSERT_RESPONSE=$(curl -s -w "\n%{http_code}" \
        -X POST \
        "${SUPABASE_URL}/rest/v1/users" \
        -H "apikey: ${SUPABASE_SERVICE_KEY}" \
        -H "Authorization: Bearer ${SUPABASE_SERVICE_KEY}" \
        -H "Content-Type: application/json" \
        -H "Prefer: resolution=merge-duplicates" \
        -d "$UPSERT_DATA")
    
    UPSERT_CODE=$(echo "$UPSERT_RESPONSE" | tail -n 1)
    
    if [ "$UPSERT_CODE" = "201" ] || [ "$UPSERT_CODE" = "200" ]; then
        echo "✅ Admin user created/updated successfully!"
    else
        echo "⚠️  Could not create admin user (HTTP $UPSERT_CODE)"
        echo "   You may need to create the tables first"
    fi
fi
echo ""

echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Restart your backend: cd backend-go && go run main.go"
echo "  2. Test the connection: ./test-database-connection.sh"
echo "  3. Test admin endpoints: ./test-admin-endpoints.sh"
echo ""
