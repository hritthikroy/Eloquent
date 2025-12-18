# Heroku Quick Reference

## 🚀 One-Command Deploy

```bash
./deploy-heroku.sh
```

## 📋 Manual Commands

```bash
# Login and create app
heroku login
heroku create your-app-name

# Set buildpack
heroku buildpacks:set heroku/go

# Deploy
git push heroku main

# Set environment variables
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_SERVICE_KEY=your-service-key
heroku config:set GROQ_API_KEY=gsk_your-key
heroku config:set STRIPE_SECRET_KEY=sk_your-key
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_your-secret
```

## 🔍 Verification

```bash
./verify-heroku-deployment.sh
```

## 📊 Monitoring

```bash
# View logs
heroku logs --tail

# Check status
heroku ps

# Open in browser
heroku open
```

## 🛠️ Troubleshooting

```bash
# Restart app
heroku restart

# Check config
heroku config

# Run one-off commands
heroku run bash
```

## 📱 API Endpoints

- Health: `GET /health`
- Auth: `POST /api/auth/google`
- Transcribe: `POST /api/transcribe/audio`
- Subscriptions: `POST /api/subscriptions/create-checkout`
- Webhooks: `POST /api/webhooks/stripe`