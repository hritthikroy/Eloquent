#!/bin/bash

echo "🚀 Deploying Eloquent Go Backend to Heroku..."

# Check if we're in the right directory
if [ ! -f "backend-go/go.mod" ]; then
    echo "❌ Please run this script from the EloquentElectron directory"
    exit 1
fi

# Navigate to backend-go
cd backend-go

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "🔐 Please login to Heroku first:"
    heroku login
fi

# Check if git repo exists
if [ ! -d ".git" ]; then
    echo "📁 Initializing git repository..."
    git init
    git add .
    git commit -m "Initial commit for Heroku deployment"
fi

# Get app name
read -p "Enter your Heroku app name (e.g., eloquent-api-2024): " APP_NAME

if [ -z "$APP_NAME" ]; then
    echo "❌ App name is required"
    exit 1
fi

# Create Heroku app
echo "🏗️ Creating Heroku app: $APP_NAME"
heroku create $APP_NAME

# Set basic environment variables
# Set Go buildpack
echo "🔧 Setting Go buildpack..."
heroku buildpacks:set heroku/go --app $APP_NAME

echo "⚙️ Setting environment variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set APP_URL=https://$APP_NAME.herokuapp.com --app $APP_NAME

echo ""
echo "✅ Heroku app created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Set up Supabase project at https://supabase.com"
echo "2. Get Groq API key at https://console.groq.com"
echo "3. Get Stripe keys at https://dashboard.stripe.com"
echo "4. Set environment variables:"
echo "   heroku config:set SUPABASE_URL=https://your-project.supabase.co --app $APP_NAME"
echo "   heroku config:set SUPABASE_SERVICE_KEY=your-service-key --app $APP_NAME"
echo "   heroku config:set GROQ_API_KEY=gsk_your_groq_key --app $APP_NAME"
echo "   heroku config:set STRIPE_SECRET_KEY=sk_your_stripe_key --app $APP_NAME"
echo "   heroku config:set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret --app $APP_NAME"
echo "5. Deploy with: git push heroku main"
echo ""
echo "📖 Full guide: See HEROKU_DEPLOY.md"
echo ""
echo "🌐 Your app will be available at: https://$APP_NAME.herokuapp.com"