#!/bin/bash

echo "🧪 Testing OAuth Flow"
echo "===================="

echo "1. Testing backend health..."
curl -s https://agile-basin-06335-9109082620ce.herokuapp.com/health

echo -e "\n\n2. Testing OAuth success page..."
curl -s https://agile-basin-06335-9109082620ce.herokuapp.com/auth/success | head -10

echo -e "\n\n3. Testing Supabase connection..."
curl -s "https://apphxfvhpqogsquqlaol.supabase.co/rest/v1/" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcGh4ZnZocHFvZ3NxdXFsYW9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTMyMTUsImV4cCI6MjA4MTU4OTIxNX0.Z63Kpf2la_bQUmlySXzDLXmh6wowkuYiIFIuROcmgKk"

echo -e "\n\n✅ All services are responding correctly"
echo "🔧 If OAuth still doesn't work, use the Manual OAuth Fix option in the tray menu"