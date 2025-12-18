# 🚀 Eloquent Quick Start Guide

Get up and running with Eloquent in 5 minutes!

## Prerequisites

- **macOS** (10.15 or later)
- **Node.js 18+** ([Download](https://nodejs.org/))
- **Go 1.21+** ([Download](https://golang.org/dl/))

## Quick Setup

### Option 1: Development Mode (Fastest)

Perfect for testing without real authentication:

```bash
# 1. Install dependencies
npm install
cd backend-go && go mod tidy && cd ..

# 2. Start everything
./start-dev.sh
```

That's it! The app will open with mock authentication enabled.

### Option 2: Production Mode (Full Features)

For real Google sign-in and cloud features:

```bash
# 1. Install dependencies
npm install
cd backend-go && go mod tidy && cd ..

# 2. Configure production credentials
./setup-production.sh

# 3. Start the app
npm start
```

## Getting API Keys

### Groq API Key (Required for transcription)

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up for a free account
3. Go to **API Keys** section
4. Click **Create API Key**
5. Copy the key (starts with `gsk_`)

### Supabase Credentials (Required for authentication)

1. Visit [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project or use existing
3. Go to **Settings** > **API**
4. Copy:
   - **Project URL** (e.g., `https://xxx.supabase.co`)
   - **anon public** key (starts with `eyJ`)

## Usage

### Keyboard Shortcuts

- **Alt + Shift + Space** - Start AI Rewrite (recommended)
- **Alt + Space** - Start Standard transcription
- **Escape** - Stop recording
- **Cmd + Shift + D** - Open dashboard
- **Cmd + Shift + A** - Open admin panel (admin users only)

### First Recording

1. Press **Alt + Shift + Space**
2. Speak your text
3. Press **Escape** to stop
4. Text automatically pastes at cursor!

## Troubleshooting

### "Microphone permission denied"

```bash
# Reset permissions
npm run reset-permissions
# Then restart the app
```

### "Auto-paste not working"

1. Go to **System Settings** > **Privacy & Security** > **Accessibility**
2. Find **Electron** or **Eloquent**
3. Toggle it **ON**
4. Restart the app

### "Connection refused" error

Make sure the Go backend is running:

```bash
cd backend-go
go run main.go
```

### "No API key configured"

1. Open the dashboard (Cmd + Shift + D)
2. Go to **Settings**
3. Add your Groq API key
4. Click **Save Settings**

## Development Scripts

```bash
# Start development mode
npm run dev

# Start with backend
npm run start:full

# Build for production
npm run build

# Check production configuration
npm run check-production

# Validate production setup
npm run validate-production
```

## Project Structure

```
EloquentElectron/
├── main.js              # Main Electron process
├── auth-service.js      # Authentication service
├── dashboard.html       # Dashboard UI
├── overlay.html         # Recording overlay
├── backend-go/          # Go backend server
│   ├── main.go         # Server entry point
│   └── internal/       # Backend modules
├── .env                # Configuration (create from .env.example)
└── package.json        # Dependencies
```

## Next Steps

1. **Customize Settings** - Open dashboard and configure language, AI mode
2. **Deploy Backend** - Deploy `backend-go/` to Heroku or Railway
3. **Build App** - Run `npm run build` to create distributable
4. **Read Full Docs** - See `README.md` for detailed information

## Support

- **Issues**: Check `README.md` troubleshooting section
- **Backend Deployment**: See `backend-go/README.md`
- **Performance**: See `PERFORMANCE_OPTIMIZATIONS.md`

## Tips

- Use **AI Rewrite mode** for best results (Alt + Shift + Space)
- Enable **Auto-paste** in Accessibility settings for seamless workflow
- Add multiple Groq API keys for higher daily limits
- Admin users get unlimited usage automatically

---

**Happy transcribing! 🎤✨**