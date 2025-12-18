# Eloquent Backend - Go Version

This is the Go rewrite of the Eloquent voice-to-text application backend, originally written in Node.js.

## Features

- **Authentication**: Supabase integration with JWT validation
- **Transcription**: Groq API integration for speech-to-text
- **AI Enhancement**: Text rewriting and grammar correction
- **Subscriptions**: Stripe integration for payment processing
- **Usage Tracking**: Monitor user consumption and limits
- **Rate Limiting**: Built-in request rate limiting
- **CORS**: Configured for Electron app integration

## Architecture

```
├── main.go                 # Application entry point
├── internal/
│   ├── config/            # Configuration management
│   ├── handlers/          # HTTP request handlers
│   ├── middleware/        # HTTP middleware (auth, rate limiting)
│   ├── models/           # Data models
│   └── services/         # Business logic services
├── Dockerfile            # Container configuration
└── README.md            # This file
```

## Getting Started

### Prerequisites

- Go 1.21 or higher
- Supabase account and project
- Groq API key
- Stripe account (for subscriptions)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend-go
```

2. Install dependencies:
```bash
go mod tidy
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your credentials:
```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
GROQ_API_KEY=your_groq_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
```

5. Run the application:
```bash
go run main.go
```

The server will start on port 3000 (or the port specified in the PORT environment variable).

### Docker Deployment

Build and run with Docker:

```bash
docker build -t eloquent-backend .
docker run -p 3000:3000 --env-file .env eloquent-backend
```

## API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth authentication
- `POST /api/auth/validate` - Validate JWT token
- `PUT /api/auth/settings` - Update user settings
- `POST /api/auth/logout` - Logout user
- `DELETE /api/auth/account` - Delete user account

### Transcription
- `POST /api/transcribe/audio` - Transcribe audio file
- `GET /api/transcribe/api-key` - Get API key for client-side usage

### Subscriptions
- `POST /api/subscriptions/create-checkout` - Create Stripe checkout session
- `POST /api/subscriptions/create-portal` - Create Stripe customer portal
- `GET /api/subscriptions/status` - Get subscription status

### Usage
- `GET /api/usage/stats` - Get usage statistics
- `GET /api/usage/history` - Get usage history

### Webhooks
- `POST /api/webhooks/stripe` - Stripe webhook handler

### Health Check
- `GET /health` - Health check endpoint

## Key Differences from Node.js Version

### Performance Improvements
- **Compiled Binary**: Go compiles to a single binary, eliminating runtime dependencies
- **Better Concurrency**: Go's goroutines handle concurrent requests more efficiently
- **Lower Memory Usage**: Typically uses 50-70% less memory than Node.js equivalent
- **Faster Startup**: No JIT compilation, instant startup

### Architecture Changes
- **Structured Packages**: Clear separation of concerns with internal packages
- **Type Safety**: Compile-time type checking prevents runtime errors
- **Dependency Injection**: Services are injected into handlers for better testability
- **Middleware Pattern**: Clean middleware chain for authentication and rate limiting

### Development Benefits
- **Static Typing**: Catch errors at compile time
- **Better Tooling**: Excellent IDE support and debugging
- **Standard Library**: Rich standard library reduces external dependencies
- **Cross Compilation**: Easy deployment to different platforms

## Configuration

The application uses environment variables for configuration. See `.env.example` for all available options.

### Required Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `GROQ_API_KEY`: Groq API key for transcription
- `STRIPE_SECRET_KEY`: Stripe secret key for payments

### Optional Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook signing secret

## Database Integration

This version maintains compatibility with the existing Supabase PostgreSQL schema. The database operations are abstracted through the `UserService` which can be easily extended to use any SQL database with proper drivers.

To add full database integration:

1. Add a database driver (e.g., `github.com/lib/pq` for PostgreSQL)
2. Implement database queries in the service layer
3. Add connection pooling and transaction support

## Deployment

### Railway
```bash
railway login
railway link
railway up
```

### Heroku
```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_SERVICE_KEY=your_key
# ... set other environment variables
git push heroku main
```

### Docker
```bash
docker build -t eloquent-backend .
docker run -p 3000:3000 --env-file .env eloquent-backend
```

## Testing

Run tests:
```bash
go test ./...
```

Run tests with coverage:
```bash
go test -cover ./...
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and ensure they pass
6. Submit a pull request

## License

This project is licensed under the MIT License.