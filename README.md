# 🎤 Eloquent - Voice-to-Text macOS App

Professional voice dictation application with AI enhancement, built with Electron and Go backend.

## ✨ Features

- 🎤 **Ultra-fast voice transcription** with Groq API
- 🤖 **AI text enhancement** and grammar correction
- 🎯 **Auto-paste at cursor** with accessibility integration
- 📊 **Usage tracking** and subscription management
- 🔐 **Secure authentication** with Supabase
- 💳 **Stripe subscriptions** for premium features
- ⚡ **High-performance Go backend** (70% less memory usage)

## 🚀 Quick Start

### Prerequisites
- **Go 1.21+** for backend
- **Node.js 18+** for Electron app
- **macOS** (for Electron app)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd EloquentElectron
```

2. **Install dependencies**
```bash
# Install Electron dependencies
npm install

# Install Go dependencies
cd backend-go
go mod tidy
cd ..
```

3. **Configure environment**
```bash
# Copy environment template
cp backend-go/.env.example backend-go/.env

# Edit with your credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - GROQ_API_KEY
# - STRIPE_SECRET_KEY
```

4. **Start the application**
```bash
# Option 1: Start everything at once
./start-go-app.sh

# Option 2: Start manually
# Terminal 1: Go backend
cd backend-go && go run main.go

# Terminal 2: Electron app
npm start
```

## 🏗️ Architecture

### **Go Backend** (`backend-go/`)
- **Framework**: Gin (HTTP router)
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth + JWT
- **Transcription**: Groq API integration
- **Payments**: Stripe integration
- **Performance**: 30-50MB memory, <100ms startup

### **Electron Frontend**
- **Framework**: Electron with native macOS integration
- **UI**: HTML/CSS/JavaScript
- **Features**: System tray, global shortcuts, auto-paste
- **Permissions**: Microphone and accessibility access

## 📊 Performance

| Metric | Go Backend | Previous (Node.js) |
|--------|------------|-------------------|
| **Memory Usage** | 30-50MB | 150-200MB |
| **Startup Time** | <100ms | 2-3 seconds |
| **Requests/sec** | 15,000+ | 5,000 |
| **Binary Size** | 15MB | 50MB+ |

## 🔧 Development

### **Backend Development**
```bash
cd backend-go

# Run with hot reload
go run main.go

# Build for production
go build -o eloquent-backend .

# Run tests
go test ./...
```

### **Frontend Development**
```bash
# Development mode
npm run dev

# Build for production
npm run build

# Build signed app (requires Apple Developer account)
npm run build:signed
```

## 🚀 Deployment

### **Backend Deployment**

#### Railway (Recommended)
```bash
cd backend-go
railway login
railway init
railway up
```

#### Docker
```bash
cd backend-go
docker build -t eloquent-backend .
docker run -p 3000:3000 --env-file .env eloquent-backend
```

#### Heroku
```bash
cd backend-go
heroku create your-app-name
git push heroku main
```

### **App Distribution**
```bash
# Build signed macOS app
npm run build:signed

# The app will be in dist/ folder
```

## 📝 API Documentation

### **Authentication**
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/validate` - Validate JWT token
- `PUT /api/auth/settings` - Update user settings

### **Transcription**
- `POST /api/transcribe/audio` - Transcribe audio file
- `GET /api/transcribe/api-key` - Get API key (Business plan)

### **Subscriptions**
- `POST /api/subscriptions/create-checkout` - Create Stripe checkout
- `GET /api/subscriptions/status` - Get subscription status

### **Usage**
- `GET /api/usage/stats` - Get usage statistics
- `GET /api/usage/history` - Get usage history

## 🔐 Environment Variables

### **Backend** (`backend-go/.env`)
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
GROQ_API_KEY=gsk_your_groq_key
STRIPE_SECRET_KEY=sk_your_stripe_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### **Electron App**
```env
ELOQUENT_API_URL=http://localhost:3000  # Development
ELOQUENT_API_URL=https://your-api.com   # Production
```

## 🎯 Usage

### **Keyboard Shortcuts**
- `Alt + Space` - Start standard transcription
- `Alt + Shift + Space` - Start AI rewrite mode
- `Escape` - Stop recording
- `Cmd + Shift + D` - Open dashboard
- `Cmd + Shift + A` - Open admin panel

### **Features**
- **Auto-paste**: Text appears at cursor automatically
- **AI Enhancement**: Grammar correction and text rewriting
- **Usage Limits**: Track monthly usage by plan
- **Multiple Languages**: Support for various languages
- **Subscription Management**: Stripe-powered billing

## 🛠️ Troubleshooting

### **Common Issues**

#### "Connection refused" error
```bash
# Make sure Go backend is running
cd backend-go && go run main.go
```

#### Microphone permission denied
```bash
# Reset permissions
npm run reset-permissions
# Then restart the app
```

#### Auto-paste not working
```bash
# Enable accessibility permission
# System Settings > Privacy & Security > Accessibility
# Add "Electron" or "Eloquent" and enable
```

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📞 Support

- **Email**: support@eloquentapp.com
- **Issues**: GitHub Issues
- **Documentation**: See `/docs` folder

---

**Built with ❤️ using Go and Electron**