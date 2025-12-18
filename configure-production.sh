#!/bin/bash

# Interactive Production Configuration Script
# This script guides you through setting up production mode step by step

echo "🚀 Eloquent Production Mode Configuration"
echo "========================================"
echo ""
echo "This script will help you configure Eloquent for production mode."
echo "You'll need:"
echo "  1. Groq API key (free at console.groq.com)"
echo "  2. Supabase credentials (from your dashboard)"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Creating .env from template..."
    cp .env.production .env
    echo "✅ .env file created"
fi

echo "📋 Current configuration status:"
echo ""

# Run validation to show current status
node validate-production.js

echo ""
echo "🔧 Let's configure the missing credentials..."
echo ""

# Function to update .env file
update_env() {
    local key=$1
    local value=$2
    local file=".env"
    
    if grep -q "^${key}=" "$file"; then
        # Key exists, replace it
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
        else
            # Linux
            sed -i "s|^${key}=.*|${key}=${value}|" "$file"
        fi
    else
        # Key doesn't exist, add it
        echo "${key}=${value}" >> "$file"
    fi
}

# Configure Groq API Key
current_groq=$(grep "^GROQ_API_KEY_1=" .env | cut -d'=' -f2)
if [[ "$current_groq" == "gsk_your_api_key_here" ]] || [[ -z "$current_groq" ]]; then
    echo "🔑 GROQ API KEY SETUP"
    echo "-------------------"
    echo "1. Visit: https://console.groq.com"
    echo "2. Sign up and go to API Keys"
    echo "3. Create a new API key"
    echo "4. Copy the key (starts with 'gsk_')"
    echo ""
    read -p "Enter your Groq API key: " groq_key
    
    if [[ $groq_key == gsk_* ]]; then
        update_env "GROQ_API_KEY_1" "$groq_key"
        echo "✅ Groq API key configured"
    else
        echo "⚠️  Warning: Key doesn't start with 'gsk_' - please double-check"
        update_env "GROQ_API_KEY_1" "$groq_key"
    fi
    echo ""
fi

# Configure Supabase Anon Key
current_supabase=$(grep "^SUPABASE_ANON_KEY=" .env | cut -d'=' -f2)
if [[ "$current_supabase" == "your-anon-key" ]] || [[ -z "$current_supabase" ]]; then
    echo "🔐 SUPABASE ANON KEY SETUP"
    echo "-------------------------"
    echo "1. Visit: https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Click Settings → API"
    echo "4. Copy the 'anon public' key (starts with 'eyJ')"
    echo ""
    read -p "Enter your Supabase anon key: " supabase_key
    
    if [[ $supabase_key == eyJ* ]]; then
        update_env "SUPABASE_ANON_KEY" "$supabase_key"
        echo "✅ Supabase anon key configured"
    else
        echo "⚠️  Warning: Key doesn't start with 'eyJ' - please double-check"
        update_env "SUPABASE_ANON_KEY" "$supabase_key"
    fi
    echo ""
fi

echo "🧪 Validating configuration..."
echo ""

# Run validation again
node validate-production.js

echo ""
echo "🎯 Next Steps:"
echo ""
echo "1. Start the app: npm start"
echo "2. Look for 'Production mode detected' in console"
echo "3. Test Google sign-in functionality"
echo ""
echo "📚 For troubleshooting, see:"
echo "   - QUICK_PRODUCTION_SETUP.md"
echo "   - PRODUCTION_SETUP.md"
echo ""
echo "🎉 Configuration complete!"