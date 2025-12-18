# Heroku Deployment Guide for Eloquent Backend

## 🚀 Quick Deploy to Heroku

### Prerequisites
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- Git repository initialized
- Heroku account created

### Step 1: Prepare for Deployment

```bash
# Navigate to backend directory
cd EloquentElectron/backend-go

# Initialize git if not already done
git init
git add .
git commit -m "Initial backend commit"
```

### Step 2: Create Heroku App

```bash
# Create new Heroku app (replace 'your-app-name' with unique name)
heroku create eloquent-backend-api

# Or use auto-generated name
heroku create

# Add Go buildpack
heroku buildpacks:set heroku/go
```

### Step 3: Set Environment Variables

```bash
# Set production environment
heroku config:set ENVIRONMENT=production

# Set Supabase credentials
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
heroku config:set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Set Groq API key
heroku config:set GROQ_API_KEY=gsk_your_groq_api_key_here

# Set Stripe credentials (if using payments)
heroku config:set STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Set CORS origins
heroku config:set ALLOWED_ORIGINS=https://your-frontend-domain.com

# Optional: Set rate limiting
heroku config:set RATE_LIMIT_REQUESTS=100
heroku config:set RATE_LIMIT_WINDOW=3600
```

### Step 4: Deploy

```bash
# Deploy to Heroku
git push heroku main

# Or if your main branch is named differently
git push heroku master
```

### Step 5: Verify Deployment

```bash
# Check app status
heroku ps

# View logs
heroku logs --tail

# Open app in browser
heroku open

# Test health endpoint
curl https://your-app-name.herokuapp.com/health
```

## 🔧 Configuration Files

### Procfile (Already exists)
```
web: eloquent-backend
```

### go.mod (Already configured)
- Contains all necessary dependencies
- Go version 1.21 specified

## 🌐 Update Frontend Configuration

After deploying, update your Electron app's backend URL:

```env
# In EloquentElectron/.env
ELOQUENT_API_URL=https://your-app-name.herokuapp.com
```

## 📊 Monitoring and Maintenance

### View Logs
```bash
# Real-time logs
heroku logs --tail

# Last 100 lines
heroku logs -n 100

# Filter by source
heroku logs --source app
```

### Scale Dynos
```bash
# Scale up
heroku ps:scale web=2

# Scale down
heroku ps:scale web=1
```

### Environment Variables
```bash
# View all config vars
heroku config

# Set new variable
heroku config:set NEW_VAR=value

# Remove variable
heroku config:unset OLD_VAR
```

## 🔒 Security Considerations

### Environment Variables
- Never commit real API keys to git
- Use Heroku config vars for all secrets
- Rotate keys regularly

### CORS Configuration
```bash
# Set specific origins (recommended)
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# For development only (not recommended for production)
heroku config:set ALLOWED_ORIGINS=*
```

### Rate Limiting
```bash
# Adjust based on your needs
heroku config:set RATE_LIMIT_REQUESTS=1000  # requests per window
heroku config:set RATE_LIMIT_WINDOW=3600    # window in seconds (1 hour)
```

## 🐛 Troubleshooting

### Common Issues

**Build Fails**
```bash
# Check Go version in go.mod
# Ensure all dependencies are in go.sum
go mod tidy
git add go.sum
git commit -m "Update dependencies"
git push heroku main
```

**App Crashes on Start**
```bash
# Check logs for errors
heroku logs --tail

# Common issues:
# - Missing environment variables
# - Port binding (should use $PORT)
# - Database connection errors
```

**CORS Errors**
```bash
# Set proper origins
heroku config:set ALLOWED_ORIGINS=https://your-frontend-domain.com

# Check current CORS settings
heroku config:get ALLOWED_ORIGINS
```

### Health Check Endpoint

Test your deployment:
```bash
# Should return {"status":"ok","timestamp":"..."}
curl https://your-app-name.herokuapp.com/health
```

## 📱 Connect Electron App

Update your Electron app configuration:

```javascript
// In auth-service.js or main.js
this.baseURL = process.env.ELOQUENT_API_URL || 'https://your-app-name.herokuapp.com';
```

## 🔄 Continuous Deployment

### Automatic Deploys from GitHub

1. **Connect GitHub**:
   - Go to Heroku Dashboard
   - Select your app
   - Go to Deploy tab
   - Connect to GitHub repository

2. **Enable Auto Deploy**:
   - Choose branch (usually `main`)
   - Enable "Wait for CI to pass" if using CI
   - Click "Enable Automatic Deploys"

### Manual Deploy from CLI
```bash
# Deploy specific branch
git push heroku feature-branch:main

# Deploy with build logs
git push heroku main --verbose
```

## 📈 Performance Optimization

### Database Connection Pooling
```bash
# If using PostgreSQL addon
heroku addons:create heroku-postgresql:mini
heroku config:set DATABASE_MAX_CONNECTIONS=20
```

### Caching
```bash
# Add Redis for caching
heroku addons:create heroku-redis:mini
heroku config:set REDIS_URL=$(heroku config:get REDIS_URL)
```

## 💰 Cost Optimization

### Free Tier Limits
- 550-1000 dyno hours per month (free)
- Apps sleep after 30 minutes of inactivity
- 10,000 rows in PostgreSQL (free tier)

### Upgrade Options
```bash
# Upgrade to hobby dyno (no sleeping)
heroku ps:type hobby

# Scale to multiple dynos
heroku ps:scale web=2
```

## 🎯 Production Checklist

- [ ] Environment variables set
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Health check endpoint working
- [ ] Logs monitoring set up
- [ ] SSL/HTTPS enabled (automatic on Heroku)
- [ ] Database backups configured
- [ ] Error tracking set up (optional)

## 📞 Support

### Heroku Resources
- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Go on Heroku](https://devcenter.heroku.com/articles/getting-started-with-go)
- [Heroku CLI Reference](https://devcenter.heroku.com/articles/heroku-cli-commands)

### Quick Commands Reference
```bash
# App info
heroku info

# Restart app
heroku restart

# Run one-off commands
heroku run go version

# Access Heroku shell
heroku run bash
```