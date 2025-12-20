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

1. **Clone and install dependencies**
```bash
git clone <repository-url>
cd EloquentElectron
npm install
cd backend-go && go mod tidy && cd ..
```

2. **Configure environment**
```bash
# Copy environment template
cp .env.example .env
cp backend-go/.env.example backend-go/.env

# Edit .env files with your credentials:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - GROQ_API_KEY
# - STRIPE_SECRET_KEY
```

3. **Start the application**
```bash
# Start backend
cd backend-go && go run main.go &

# Start Electron app
npm start
```

## 📁 Project Structure

```
EloquentElectron/
├── src/                    # Source code
│   ├── main.js            # Main Electron process
│   ├── services/          # Core services
│   │   ├── auth-service.js
│   │   ├── performance-monitor.js
│   │   └── performance-optimizer.js
│   ├── utils/             # Utility modules
│   │   ├── ai-prompts.js
│   │   ├── admin-check.js
│   │   ├── fast-startup.js
│   │   └── utils.js
│   └── ui/                # User interface files
│       ├── dashboard.html
│       ├── overlay.html
│       ├── admin.html
│       ├── login.html
│       ├── subscription.html
│       └── manual-oauth.html
├── backend-go/            # Go backend server
├── assets/                # Static assets
├── docs/                  # Documentation
│   ├── QUICKSTART.md
│   └── PERFORMANCE_OPTIMIZATIONS.md
├── .env                   # Environment configuration
└── package.json          # Node.js dependencies
```

## 🎯 Usage

### Keyboard Shortcuts
- **Alt + Shift + Space** - Start AI Rewrite (recommended)
- **Alt + Space** - Start Standard transcription
- **Enter** - Stop recording
- **Cmd + Shift + D** - Open dashboard
- **Cmd + Shift + A** - Open admin panel (admin users only)

### First Recording
1. Press **Alt + Shift + Space**
2. Speak your text
3. Press **Enter** to stop
4. Text automatically pastes at cursor!

## 🔧 Development

### Scripts
```bash
# Development
npm run dev              # Start Electron in dev mode
npm run start:full       # Start backend + frontend

# Production
npm run build           # Build distributable app
npm run build:signed    # Build signed app

# Backend
npm run backend:dev     # Start Go server
npm run backend:build   # Build Go binary
npm run backend:test    # Run Go tests
```

## 🚀 Performance

| Metric | Go Backend | Previous (Node.js) |
|--------|------------|-------------------|
| **Memory Usage** | 30-50MB | 150-200MB |
| **Startup Time** | <100ms | 2-3 seconds |
| **Requests/sec** | 15,000+ | 5,000 |
| **Binary Size** | 15MB | 50MB+ |

## 📚 Documentation

- **[Quick Start Guide](docs/QUICKSTART.md)** - Get up and running in 5 minutes
- **[Performance Guide](docs/PERFORMANCE_OPTIMIZATIONS.md)** - Optimization details
- **[Backend Documentation](backend-go/README.md)** - Go backend setup

## 🛠️ Troubleshooting

### Common Issues

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
1. Go to **System Settings** > **Privacy & Security** > **Accessibility**
2. Find **Electron** or **Eloquent** and enable it
3. Restart the app

## 📄 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ using Go and Electron**