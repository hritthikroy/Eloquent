#!/bin/bash

# Eloquent Production Setup Script
# This script helps configure production mode with real credentials

echo "🚀 Eloquent Production Mode Setup"
echo "=================================="
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "📁 Creating .env file from template..."
    cp .env.example .env
fi

echo "This script will help you configure Eloquent for production use."
echo ""

# Function to update env variable
update_env_var() {
    local var_name=$1
    local var_description=$2
    local var_example=$3
    local current_value=$(grep "^$var_name=" .env | cut -d'=' -f2-)
    
    echo "📝 $var_description"
    if [ ! -z "$var_example" ]; then
        echo "   Example: $var_example"
    fi
    if [ ! -z "$current_value" ] && [ "$current_value" != "your_${var_name,,}_here" ]; then
        echo "   Current: $current_value"
        read -p "   Keep current value? (y/n): " keep_current
        if [ "$keep_current" = "y" ] || [ "$keep_current" = "Y" ]; then
            return
        fi
    fi
    
    read -p "   Enter $var_name: " new_value
    if [ ! -z "$new_value" ]; then
        # Escape special characters for sed
        escaped_value=$(echo "$new_value" | sed 's/[[\.*^$()+?{|]/\\&/g')
        sed -i.bak "s|^$var_name=.*|$var_name=$escaped_value|" .env
        echo "   ✅ Updated $var_name"
    fi
    echo ""
}

echo "🔑 Step 1: Groq API Configuration"
echo "   Get your FREE API key at: https://console.groq.com"
echo "   1. Sign up at console.groq.com"
echo "   2. Go to API Keys section"
echo "   3. Create a new API key"
echo ""
update_env_var "GROQ_API_KEY_1" "Groq API Key (Primary)" "gsk_..."

echo "☁️  Step 2: Supabase Configuration"
echo "   Get your credentials at: https://supabase.com/dashboard"
echo "   1. Go to your project dashboard"
echo "   2. Click Settings > API"
echo "   3. Copy Project URL and anon public key"
echo ""
update_env_var "SUPABASE_URL" "Supabase Project URL" "https://your-project.supabase.co"
update_env_var "SUPABASE_ANON_KEY" "Supabase Anon Key" "eyJ..."

echo "🌐 Step 3: Backend Configuration"
echo "   If you have deployed the Go backend, enter the URL:"
echo ""
update_env_var "ELOQUENT_API_URL" "Backend API URL" "https://your-app.herokuapp.com"

# Validate configuration
echo "🔍 Validating configuration..."
source .env

validation_passed=true

if [[ ! "$GROQ_API_KEY_1" =~ ^gsk_ ]]; then
    echo "❌ Invalid Groq API key format (should start with 'gsk_')"
    validation_passed=false
fi

if [[ ! "$SUPABASE_URL" =~ ^https://.*\.supabase\.co$ ]]; then
    echo "❌ Invalid Supabase URL format"
    validation_passed=false
fi

if [[ ! "$SUPABASE_ANON_KEY" =~ ^eyJ ]]; then
    echo "❌ Invalid Supabase anon key format (should start with 'eyJ')"
    validation_passed=false
fi

if [ "$validation_passed" = true ]; then
    echo "✅ Configuration validation passed!"
    echo ""
    echo "🎉 Production mode setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Start the app: npm start"
    echo "2. Test Google sign-in functionality"
    echo "3. Verify voice transcription works"
    echo ""
    echo "For backend deployment:"
    echo "1. Deploy backend-go/ to Heroku or similar"
    echo "2. Update ELOQUENT_API_URL in .env"
    echo "3. Configure Supabase OAuth redirect URLs"
else
    echo ""
    echo "❌ Configuration validation failed!"
    echo "Please check the values and run this script again."
    echo ""
    echo "For help, see: README.md"
fi

# Cleanup backup file
rm -f .env.bak

echo ""
echo "📁 Configuration saved to .env"
echo "🔒 Keep your .env file secure and never commit it to version control!"