# Heroku Quick Start Guide

## 🚀 Deploy in 5 Minutes

### Option 1: Automated Deployment (Recommended)
```bash
# Run the deployment script
./deploy-heroku.sh
```

### Option 2: Manual Deployment
```bash
# 1. Navigate to backend
cd EloquentElectron/backend-go

# 2. Create Heroku app
heroku create your-app-name

# 3. Set buildpack
heroku buildpacks:set heroku/go

# 4. Set environment variables (see below)

# 5. Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

## 🔑 Required Environment Variables

Set these in Heroku dashboard or using CLI:

```bash
# Production settings
heroku config:set ENVIRONMENT=production

# Supabase (required)
heroku config:set SUPABASE_URL=https://your-project.supabase.co
heroku config:set SUPABASE_ANON_KEY=eyJ...
heroku config:set SUPABASE_SERVICE_KEY=eyJ...

# Groq API (required)
heroku config:set GROQ_API_KEY=gsk_...

# CORS (required)
heroku config:set ALLOWED_ORIGINS=*

# Stripe (optional - for payments)
heroku config:set STRIPE_SECRET_KEY=sk_live_...
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_...
```

## 📱 Update Electron App

After deployment, update your Electron app:

```env
# In EloquentElectron/.env
ELOQUENT_API_URL=https://your-app-name.herokuapp.com
```

## ✅ Verify Deployment

```bash
# Check app status
heroku ps

# Test health endpoint
curl https://your-app-name.herokuapp.com/health

# View logs
heroku logs --tail
```

## 🛠️ Helper Scripts

| Script | Purpose |
|--------|---------|
| `./deploy-heroku.sh` | Full automated deployment |
| `./heroku-config.sh` | Configure existing app |

## 🔧 Common Commands

```bash
# View app info
heroku info

# Restart app
heroku restart

# Scale dynos
heroku ps:scale web=1

# View config
heroku config

# Open app
heroku open
```

## 🐛 Troubleshooting

### App Won't Start
```bash
# Check logs
heroku logs --tail

# Common fixes:
heroku config:set PORT=3000
heroku restart
```

### CORS Errors
```bash
# Allow all origins (development only)
heroku config:set ALLOWED_ORIGINS=*

# Or set specific origins
heroku config:set ALLOWED_ORIGINS=https://yourdomain.com
```

### Build Failures
```bash
# Ensure go.mod and go.sum are committed
git add go.mod go.sum
git commit -m "Update Go modules"
git push heroku main
```

## 📊 Monitoring

### View Metrics
- Go to Heroku Dashboard
- Select your app
- Click "Metrics" tab

### Set up Alerts
```bash
# Add monitoring addon
heroku addons:create papertrail

# View logs in Papertrail
heroku addons:open papertrail
```

## 💰 Cost Management

### Free Tier
- 550-1000 dyno hours/month
- App sleeps after 30 min inactivity
- Good for development/testing

### Upgrade Options
```bash
# Hobby dyno (no sleeping) - $7/month
heroku ps:type hobby

# Standard dynos for production
heroku ps:type standard-1x
```

## 🔒 Security Best Practices

1. **Environment Variables**: Never commit secrets to git
2. **CORS**: Set specific origins, not `*` in production
3. **Rate Limiting**: Configure appropriate limits
4. **HTTPS**: Enabled by default on Heroku
5. **Secrets Rotation**: Regularly update API keys

## 📈 Performance Tips

1. **Keep Alive**: Use hobby dyno to prevent sleeping
2. **Database**: Add PostgreSQL for persistent data
3. **Caching**: Add Redis for better performance
4. **CDN**: Use Heroku's CDN for static assets

## 🎯 Production Checklist

- [ ] App deployed successfully
- [ ] Health endpoint returns 200
- [ ] Environment variables set
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] Monitoring set up
- [ ] Electron app updated with new URL
- [ ] SSL certificate active (automatic)

## 📞 Support Resources

- [Heroku Dev Center](https://devcenter.heroku.com/)
- [Go on Heroku](https://devcenter.heroku.com/articles/getting-started-with-go)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

## 🔄 Continuous Deployment

### GitHub Integration
1. Connect GitHub repo in Heroku dashboard
2. Enable automatic deploys
3. Optionally enable "Wait for CI to pass"

### Manual Deploys
```bash
# Deploy specific branch
git push heroku feature-branch:main

# Deploy with verbose output
git push heroku main --verbose
```