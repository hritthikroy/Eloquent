#!/usr/bin/env node

// Simple test script to debug the admin modal issue
const axios = require('axios');

async function testBackendConnection() {
  console.log('🔍 Testing backend connection...');
  
  try {
    // Test health endpoint
    const healthResponse = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    console.log('✅ Health check:', healthResponse.status, healthResponse.data);
    
    // Test admin stats endpoint
    try {
      const statsResponse = await axios.get('http://localhost:3000/api/admin/stats', {
        headers: { 'Authorization': 'Bearer dev-token' },
        timeout: 5000
      });
      console.log('✅ Admin stats:', statsResponse.status, statsResponse.data);
    } catch (statsError) {
      console.log('❌ Admin stats failed:', statsError.response?.status, statsError.response?.data || statsError.message);
    }
    
    // Test users endpoint
    try {
      const usersResponse = await axios.get('http://localhost:3000/api/admin/users', {
        headers: { 'Authorization': 'Bearer dev-token' },
        timeout: 5000
      });
      console.log('✅ Users list:', usersResponse.status, 'Users count:', usersResponse.data?.users?.length || 0);
      
      // Test user details if we have users
      if (usersResponse.data?.users?.length > 0) {
        const firstUserId = usersResponse.data.users[0].id;
        console.log('🔍 Testing user details for ID:', firstUserId);
        
        const userDetailsResponse = await axios.get(`http://localhost:3000/api/admin/users/${firstUserId}`, {
          headers: { 'Authorization': 'Bearer dev-token' },
          timeout: 5000
        });
        console.log('✅ User details:', userDetailsResponse.status);
        console.log('   User data structure:', Object.keys(userDetailsResponse.data));
        console.log('   User object:', userDetailsResponse.data.user ? 'Present' : 'Missing');
        console.log('   Usage stats:', userDetailsResponse.data.usage_stats ? 'Present' : 'Missing');
        console.log('   Usage logs:', userDetailsResponse.data.usage_logs ? 'Present' : 'Missing');
      }
    } catch (usersError) {
      console.log('❌ Users endpoint failed:', usersError.response?.status, usersError.response?.data || usersError.message);
    }
    
  } catch (error) {
    console.log('❌ Backend connection failed:', error.code, error.message);
    console.log('💡 Make sure the backend is running with: ./start-backend.sh');
  }
}

testBackendConnection().catch(console.error);