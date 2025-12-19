@echo off
echo 🚀 Starting Eloquent Backend Server...

REM Check if we're in the right directory
if not exist "backend-go" (
    echo ❌ Error: backend-go directory not found
    echo Please run this script from the EloquentElectron directory
    pause
    exit /b 1
)

REM Check if Go is installed
go version >nul 2>&1
if errorlevel 1 (
    echo ❌ Error: Go is not installed
    echo Please install Go from https://golang.org/dl/
    pause
    exit /b 1
)

REM Navigate to backend directory
cd backend-go

REM Check if .env file exists
if not exist ".env" (
    echo 📋 Creating .env from template...
    if exist ".env.example" (
        copy ".env.example" ".env"
        echo ⚠️  Please edit backend-go\.env with your API keys
    ) else (
        echo ❌ Error: .env.example not found
        pause
        exit /b 1
    )
)

REM Check if compiled binary exists
if exist "eloquent-backend.exe" (
    echo 🔧 Using compiled binary...
    eloquent-backend.exe
) else (
    echo 🔧 Compiling and running from source...
    go run main.go
)

pause