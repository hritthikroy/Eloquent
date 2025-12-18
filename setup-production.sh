#!/bin/bash

# Eloquent Production Setup Script
# This script helps you set up the complete production environment

echo "🚀 Eloquent Production Setup"
echo "============================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check prerequisites
print_step "Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not found"
    exit 1
fi

echo ""
print_step "Installing Electron app dependencies..."
npm install
print_success "Electron dependencies installed"

echo ""
print_step "Installing backend dependencies..."
cd backend
npm install
cd ..
print_success "Backend dependencies installed"

echo ""
echo "============================"
echo "📋 MANUAL SETUP REQUIRED"
echo "============================"
echo ""
echo "Please complete the following steps manually:"
echo ""
echo "1. 🗄️  DATABASE SETUP (MongoDB Atlas)"
echo "   - Go to https://cloud.mongodb.com"
echo "   - Create a free cluster"
echo "   - Create database user"
echo "   - Get connection string"
echo ""
echo "2. 💳 STRIPE SETUP"
echo "   - Go to https://dashboard.stripe.com"
echo "   - Create products: 'Eloquent Pro' and 'Eloquent Business'"
echo "   - Create prices for monthly and yearly billing"
echo "   - Set up webhook endpoint"
echo ""
echo "3. 🔑 GROQ API KEY"
echo "   - Go to https://console.groq.com"
echo "   - Create an API key"
echo ""
echo "4. 🍎 APPLE DEVELOPER (for code signing)"
echo "   - Enroll at https://developer.apple.com"
echo "   - Create Developer ID Application certificate"
echo "   - Generate app-specific password at https://appleid.apple.com"
echo ""
echo "============================"
echo ""

# Create .env file for backend
print_step "Creating backend .env file..."

if [ -f "backend/.env" ]; then
    print_warning "backend/.env already exists. Skipping..."
else
    cp backend/.env.example backend/.env
    print_success "Created backend/.env from template"
    echo ""
    echo "📝 Please edit backend/.env with your credentials:"
    echo "   - MONGODB_URI"
    echo "   - JWT_SECRET (generate with: openssl rand -hex 64)"
    echo "   - STRIPE_SECRET_KEY"
    echo "   - STRIPE_WEBHOOK_SECRET"
    echo "   - STRIPE_PRICE_* (4 price IDs)"
    echo "   - GROQ_API_KEY"
fi

echo ""
echo "============================"
echo "🎯 NEXT STEPS"
echo "============================"
echo ""
echo "1. Edit backend/.env with your credentials"
echo ""
echo "2. Start the backend locally:"
echo "   cd backend && npm run dev"
echo ""
echo "3. Test the Electron app:"
echo "   npm start"
echo ""
echo "4. Deploy backend to Railway:"
echo "   cd backend"
echo "   railway login"
echo "   railway init"
echo "   railway up"
echo ""
echo "5. Build signed app for distribution:"
echo "   export APPLE_ID='your@email.com'"
echo "   export APPLE_APP_SPECIFIC_PASSWORD='xxxx-xxxx-xxxx-xxxx'"
echo "   export APPLE_TEAM_ID='XXXXXXXXXX'"
echo "   npm run build:signed"
echo ""
echo "📚 See DEPLOYMENT.md for detailed instructions"
echo ""
print_success "Setup script complete!"