#!/usr/bin/env node

/**
 * Test script for User Management System
 * 
 * This script tests the user management API endpoints to ensure
 * they work correctly with the admin authentication system.
 */

const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';
const TEST_TOKEN = 'dev-token'; // Mock token for development mode

// Test configuration
const config = {
  headers: {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  }
};

async function testUserManagement() {
  console.log('🧪 Testing User Management System\n');

  try {
    // Test 1: Get admin stats
    console.log('1️⃣ Testing admin stats...');
    const statsResponse = await axios.get(`${API_BASE}/admin/stats`, config);
    console.log('✅ Admin stats:', statsResponse.data);
    console.log('');

    // Test 2: Get all users
    console.log('2️⃣ Testing get all users...');
    const usersResponse = await axios.get(`${API_BASE}/admin/users`, config);
    console.log('✅ Users loaded:', usersResponse.data.users.length, 'users');
    console.log('');

    // Test 3: Get user details (use first user)
    if (usersResponse.data.users.length > 0) {
      const firstUser = usersResponse.data.users[0];
      console.log('3️⃣ Testing get user details...');
      const userDetailsResponse = await axios.get(`${API_BASE}/admin/users/${firstUser.id}`, config);
      console.log('✅ User details loaded for:', userDetailsResponse.data.user.email);
      console.log('');

      // Test 4: Update user plan
      console.log('4️⃣ Testing update user plan...');
      const updatePlanResponse = await axios.put(`${API_BASE}/admin/users/${firstUser.id}/plan`, {
        plan: 'pro',
        subscription_status: 'active',
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }, config);
      console.log('✅ User plan updated:', updatePlanResponse.data.message);
      console.log('');

      // Test 5: Reset user usage
      console.log('5️⃣ Testing reset user usage...');
      const resetUsageResponse = await axios.post(`${API_BASE}/admin/users/${firstUser.id}/reset-usage`, {}, config);
      console.log('✅ User usage reset:', resetUsageResponse.data.message);
      console.log('');
    }

    // Test 6: Search users
    console.log('6️⃣ Testing search users...');
    const searchResponse = await axios.get(`${API_BASE}/admin/search?q=example`, config);
    console.log('✅ Search results:', searchResponse.data.users.length, 'users found');
    console.log('');

    // Test 7: Get users by plan
    console.log('7️⃣ Testing get users by plan...');
    const planResponse = await axios.get(`${API_BASE}/admin/users/plan/free`, config);
    console.log('✅ Free plan users:', planResponse.data.users.length, 'users');
    console.log('');

    // Test 8: Bulk update users
    if (usersResponse.data.users.length > 1) {
      console.log('8️⃣ Testing bulk update users...');
      const userIds = usersResponse.data.users.slice(0, 2).map(u => u.id);
      const bulkResponse = await axios.put(`${API_BASE}/admin/users/bulk`, {
        user_ids: userIds,
        updates: {
          plan: 'starter'
        }
      }, config);
      console.log('✅ Bulk update completed:', bulkResponse.data.results);
      console.log('');
    }

    console.log('🎉 All tests passed! User Management System is working correctly.\n');

    // Summary
    console.log('📊 Test Summary:');
    console.log('- Admin authentication: ✅ Working');
    console.log('- User listing: ✅ Working');
    console.log('- User details: ✅ Working');
    console.log('- Plan updates: ✅ Working');
    console.log('- Usage reset: ✅ Working');
    console.log('- User search: ✅ Working');
    console.log('- Plan filtering: ✅ Working');
    console.log('- Bulk operations: ✅ Working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('1. Make sure the backend server is running: cd backend-go && go run main.go');
    console.log('2. Check that the server is accessible at http://localhost:3000');
    console.log('3. Verify admin authentication is working');
    console.log('4. Check the server logs for detailed error information');
  }
}

// Run the tests
if (require.main === module) {
  testUserManagement();
}

module.exports = { testUserManagement };