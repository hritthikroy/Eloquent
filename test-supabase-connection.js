#!/usr/bin/env node

const https = require('https');

// Test Supabase connection and create a test user
async function testSupabaseConnection() {
    const SUPABASE_URL = 'https://apphxfvhpqogsquqlaol.supabase.co';
    const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFwcGh4ZnZocHFvZ3NxdXFsYW9sIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAxMzIxNSwiZXhwIjoyMDgxNTg5MjE1fQ.kc_1qBPs9xS9zVPtsBc7VhzLW7bwzNYoR2mnQLoP2XQ';

    console.log('🔍 Testing Supabase connection...');

    // Test 1: Check if we can read from users table
    try {
        console.log('\n1. Testing read access to users table...');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const users = await response.json();
            console.log(`✅ Successfully connected! Found ${users.length} users in database`);
            console.log('Users:', users);
        } else {
            console.log(`❌ Failed to read users: ${response.status} ${response.statusText}`);
            const error = await response.text();
            console.log('Error:', error);
        }
    } catch (error) {
        console.log('❌ Connection error:', error.message);
    }

    // Test 2: Try to create a test user
    try {
        console.log('\n2. Testing write access - creating test user...');
        const testUser = {
            email: 'hritthikin@gmail.com',
            name: 'Hritthik Roy',
            role: 'admin',
            plan: 'enterprise',
            subscription_status: 'active',
            google_id: 'test_google_id_123'
        };

        const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(testUser)
        });

        if (response.ok) {
            const createdUser = await response.json();
            console.log('✅ Successfully created test user!');
            console.log('Created user:', createdUser);
        } else {
            console.log(`❌ Failed to create user: ${response.status} ${response.statusText}`);
            const error = await response.text();
            console.log('Error:', error);
            
            // If user already exists, that's fine
            if (response.status === 409) {
                console.log('ℹ️  User already exists - this is expected');
            }
        }
    } catch (error) {
        console.log('❌ Write error:', error.message);
    }

    // Test 3: Check users again after creation attempt
    try {
        console.log('\n3. Checking users table again...');
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
            headers: {
                'Authorization': `Bearer ${SERVICE_KEY}`,
                'apikey': SERVICE_KEY,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const users = await response.json();
            console.log(`✅ Now found ${users.length} users in database`);
            users.forEach(user => {
                console.log(`  - ${user.email} (${user.role}, ${user.plan})`);
            });
        }
    } catch (error) {
        console.log('❌ Final check error:', error.message);
    }

    // Test 4: Test backend API
    try {
        console.log('\n4. Testing backend API admin endpoint...');
        const response = await fetch('http://localhost:3000/api/admin/users', {
            headers: {
                'Authorization': 'Bearer dev-token',
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const users = await response.json();
            console.log('✅ Backend API working!');
            console.log(`Backend returned ${users.length} users`);
        } else {
            console.log(`❌ Backend API failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.log('❌ Backend API error:', error.message);
    }
}

// Run the test
testSupabaseConnection().catch(console.error);