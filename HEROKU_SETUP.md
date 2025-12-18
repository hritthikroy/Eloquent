# Heroku Deployment Guide for Eloquent Electron

This guide will help you deploy the Eloquent Electron Go backend to Heroku.

## Prerequisites

1. **Heroku CLI** - Install from https://devcenter.heroku.com/articles/heroku-cli
2. **Git** - Make sure git is installed and configured
3. **Heroku Account** - Sign up at https://heroku.com

## Quick Setup

Run the automated deployment script:

```bash
cd EloquentElectron
chmod +x deploy-heroku.sh
./deploy-heroku.sh
```

## Manual Setup

If you prefer to set up manually:

### 1. Login to Heroku

```bash
heroku login
```

### 2. Create Heroku App

```bash
cd backend-go
heroku create your-app-name
```

### 3. Set Go Buildpack

```bash
heroku buildpacks:set heroku/go
```

### 4. Configure Environment Variables

Set all required environment variables:

```bash
# Basic config
heroku config:set NODE_ENV=production
heroku config:set APP_URL=https://your-app-name.herokuapp.com

# Supabase (get from https://supabase.com)
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_SERVICE_KEY=your-service-key

# Groq API (get from https://console.groq.com)
heroku config:set GROQ_API_KEY=gsk_your_groq_key

# Stripe (get from https://dashboard.stripe.com)
heroku config:set STRIPE_SECRET_KEY=sk_your_stripe_key
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

### 5. Deploy

```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## Environment Variables Reference

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | Yes | `production` |
| `PORT` | Server port (auto-set by Heroku) | No | `3000` |
| `SUPABASE_URL` | Supabase project URL | Yes | `https://abc123.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes | `eyJ...` |
| `GROQ_API_KEY` | Groq API key for transcription | Yes | `gsk_...` |
| `STRIPE_SECRET_KEY` | Stripe secret key | Yes | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook endpoint secret | Yes | `whsec_...` |

## Setting Up External Services

### Supabase Setup

1. Go to https://supabase.com and create a new project
2. Run the database schema from `database/schema.sql`
3. Get your project URL and service role key from Settings > API
4. Set the environment variables in Heroku

### Groq API Setup

1. Go to https://console.groq.com
2. Create an API key
3. Set `GROQ_API_KEY` in Heroku

### Stripe Setup

1. Go to https://dashboard.stripe.com
2. Get your secret key from Developers > API keys
3. Create a webhook endpoint pointing to `https://your-app.herokuapp.com/api/webhooks/stripe`
4. Get the webhook secret and set both keys in Heroku

## Verification

After deployment, test your API:

```bash
# Health check
curl https://your-app-name.herokuapp.com/health

# Should return: {"status":"ok","timestamp":"..."}
```

## Troubleshooting

### Build Failures

1. Check that `go.mod` and `go.sum` are committed
2. Ensure all dependencies are properly declared
3. Check Heroku build logs: `heroku logs --tail`

### Runtime Errors

1. Check application logs: `heroku logs --tail`
2. Verify all environment variables are set: `heroku config`
3. Test database connectivity from Supabase dashboard

### CORS Issues

The app is configured to allow origins:
- `app://eloquent` (Electron app)
- `https://eloquentapp.com` (web app)

Update the CORS configuration in `main.go` if needed.

## Scaling

For production use, consider upgrading from the free tier:

```bash
# Upgrade to Hobby dyno
heroku ps:scale web=1 --type=hobby

# Or Professional dyno
heroku ps:scale web=1 --type=standard-1x
```

## Database

The app uses Supabase as the database. Make sure to:

1. Run the schema from `database/schema.sql`
2. Set up proper RLS (Row Level Security) policies
3. Configure authentication providers in Supabase

## Monitoring

Monitor your app with:

```bash
# View logs
heroku logs --tail

# Check dyno status
heroku ps

# View metrics (requires paid plan)
heroku addons:create heroku-postgresql:mini
```