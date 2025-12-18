#!/usr/bin/env node

// Test protocol URL parsing
function testProtocolParsing() {
  console.log('🧪 Testing Protocol URL Parsing');
  console.log('===============================');
  
  // Test URL from your logs
  const testUrl = 'eloquent://auth/success?data=%7B%22success%22%3Atrue%2C%22access_token%22%3A%22eyJhbGciOiJIUzI1NiIsImtpZCI6Im1vN3RwV1ZRcWJHbHEzSTIiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL2FwcGh4ZnZocHFvZ3NxdXFsYW9sLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiJlM2Q4MWYwZC02MzdmLTRhMzUtYjViYi1hZjAyOGYzODkxZDgiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY2MDU2MjQ3LCJpYXQiOjE3NjYwNTI2NDcsImVtYWlsIjoiaHJpdHRoaWtpbkBnbWFpbC5jb20iLCJwaG9uZSI6IiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6Imdvb2dsZSIsInByb3ZpZGVycyI6WyJnb29nbGUiXX0sInVzZXJfbWV0YWRhdGEiOnsiYXZhdGFyX3VybCI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tycEFBb042ZkUxVlhaVUhBS1NZZjlnOGVkX1pJbnBuWVE3am1qaTNpNG4tcUc2Zz1zOTYtYyIsImVtYWlsIjoiaHJpdHRoaWtpbkBnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZnVsbF9uYW1lIjoiaHJpdHRoaWsgcm95IiwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy5nb29nbGUuY29tIiwibmFtZSI6ImhyaXR0aGlrIHJveSIsInBob25lX3ZlcmlmaWVkIjpmYWxzZSwicGljdHVyZSI6Imh0dHBzOi8vbGgzLmdvb2dsZXVzZXJjb250ZW50LmNvbS9hL0FDZzhvY0tycEFBb042ZkUxVlhaVUhBS1NZZjlnOGVkX1pJbnBuWVE3am1qaTNpNG4tcUc2Zz1zOTYtYyIsInByb3ZpZGVyX2lkIjoiMTEwNzc0NTMyMTg0Mjk2OTkxNjM4Iiwic3ViIjoiMTEwNzc0NTMyMTg0Mjk2OTkxNjM4In0sInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYWFsIjoiYWFsMSIsImFtciI6W3sibWV0aG9kIjoib2F1dGgiLCJ0aW1lc3RhbXAiOjE3NjYwNTI2NDd9XSwic2Vzc2lvbl9pZCI6IjhjYzJlMWNlLTliOGMtNDIzNy1hYjcyLTYzYzkzNWQ1MDI4MSIsImlzX2Fub255bW91cyI6ZmFsc2V9.dyszm4ya-gQ_lndwYF3xpEQluLIBJDpyFxyDwFr_x3M%22%2C%22refresh_token%22%3A%22w3l6cpkjp5zn%22%2C%22expires_in%22%3A%223600%22%2C%22token_type%22%3A%22bearer%22%7D';
  
  console.log('📋 Test URL:');
  console.log(testUrl.substring(0, 100) + '...');
  console.log('');
  
  try {
    let accessToken, refreshToken;
    
    // Handle new format: eloquent://auth/success?data={...}
    if (testUrl.includes('eloquent://auth/success?data=')) {
      const dataParam = testUrl.split('?data=')[1];
      const authData = JSON.parse(decodeURIComponent(dataParam));
      accessToken = authData.access_token;
      refreshToken = authData.refresh_token;
      
      console.log('✅ Successfully parsed JSON data');
      console.log('📊 Parsed data:');
      console.log(`   Success: ${authData.success}`);
      console.log(`   Access Token: ${accessToken ? accessToken.substring(0, 50) + '...' : 'None'}`);
      console.log(`   Refresh Token: ${refreshToken || 'None'}`);
      console.log(`   Expires In: ${authData.expires_in || 'None'}`);
      console.log(`   Token Type: ${authData.token_type || 'None'}`);
      
      // Decode JWT to see user info
      if (accessToken) {
        try {
          const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());
          console.log('');
          console.log('👤 User Info from JWT:');
          console.log(`   Email: ${payload.email}`);
          console.log(`   Name: ${payload.user_metadata?.full_name || 'N/A'}`);
          console.log(`   Provider: ${payload.app_metadata?.provider || 'N/A'}`);
          console.log(`   Expires: ${new Date(payload.exp * 1000).toLocaleString()}`);
        } catch (jwtError) {
          console.log('⚠️ Could not decode JWT:', jwtError.message);
        }
      }
      
    } else {
      console.log('❌ URL format not recognized');
    }
    
    console.log('');
    console.log('🎉 Protocol parsing test completed successfully!');
    
  } catch (error) {
    console.log('❌ Error parsing protocol URL:', error.message);
  }
}

testProtocolParsing();