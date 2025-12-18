#!/usr/bin/env node

// Test script for manual OAuth URL parsing
console.log('🧪 Testing Manual OAuth URL Parsing...\n');

// Test URLs that might be encountered
const testUrls = [
    // Standard Supabase format
    'http://localhost:3000/auth/success#access_token=ya29.a0AfH6SMC_test&refresh_token=1//04_test&expires_in=3600&token_type=Bearer',
    
    // Query parameter format
    'http://localhost:3000/auth/success?access_token=ya29.a0AfH6SMC_test&refresh_token=1//04_test&expires_in=3600&token_type=Bearer',
    
    // JSON data format (encoded)
    'http://localhost:3000/auth/success?data=%7B%22success%22%3Atrue%2C%22access_token%22%3A%22ya29.test%22%2C%22refresh_token%22%3A%221%2F%2F04_test%22%7D',
    
    // Production URL format
    'https://eloquent-api.herokuapp.com/auth/success#access_token=ya29.prod_test&refresh_token=1//04_prod&expires_in=3600',
    
    // Malformed URLs (should fail gracefully)
    'http://localhost:3000/auth/success',
    'invalid-url',
    'http://localhost:3000/auth/success#error=access_denied'
];

function parseOAuthUrl(url) {
    try {
        let accessToken, refreshToken, expiresIn, tokenType;
        
        console.log(`\n🔍 Testing: ${url.substring(0, 80)}${url.length > 80 ? '...' : ''}`);
        
        if (url.includes('#access_token=')) {
            // Handle fragment format
            const fragment = url.split('#')[1];
            const params = new URLSearchParams(fragment);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            expiresIn = params.get('expires_in');
            tokenType = params.get('token_type');
            console.log('   📍 Format: Fragment (#)');
            
        } else if (url.includes('?access_token=')) {
            // Handle query format
            const query = url.split('?')[1];
            const params = new URLSearchParams(query);
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            expiresIn = params.get('expires_in');
            tokenType = params.get('token_type');
            console.log('   📍 Format: Query (?)');
            
        } else if (url.includes('?data=')) {
            // Handle JSON data format
            const dataParam = url.split('?data=')[1];
            const authData = JSON.parse(decodeURIComponent(dataParam));
            accessToken = authData.access_token;
            refreshToken = authData.refresh_token;
            expiresIn = authData.expires_in;
            tokenType = authData.token_type;
            console.log('   📍 Format: JSON Data');
            
        } else {
            throw new Error('No access token found in URL');
        }
        
        // Validate tokens
        if (!accessToken) {
            throw new Error('Access token is missing or empty');
        }
        
        console.log('   ✅ Access Token:', accessToken ? `${accessToken.substring(0, 20)}...` : 'MISSING');
        console.log('   ✅ Refresh Token:', refreshToken ? `${refreshToken.substring(0, 15)}...` : 'MISSING');
        console.log('   ✅ Expires In:', expiresIn || 'Not specified');
        console.log('   ✅ Token Type:', tokenType || 'Not specified');
        console.log('   🎉 PARSING SUCCESS');
        
        return {
            success: true,
            tokens: {
                access_token: accessToken,
                refresh_token: refreshToken,
                expires_in: expiresIn,
                token_type: tokenType
            }
        };
        
    } catch (error) {
        console.log('   ❌ PARSING FAILED:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run tests
let successCount = 0;
let totalTests = testUrls.length;

testUrls.forEach((url, index) => {
    const result = parseOAuthUrl(url);
    if (result.success) {
        successCount++;
    }
});

console.log('\n📊 Test Results:');
console.log(`✅ Successful: ${successCount}/${totalTests}`);
console.log(`❌ Failed: ${totalTests - successCount}/${totalTests}`);

if (successCount >= 4) { // Expect at least 4 valid URLs to pass
    console.log('\n🎉 Manual OAuth URL parsing is working correctly!');
    console.log('\n📋 Usage Instructions:');
    console.log('1. Copy the OAuth URL from your stuck browser page');
    console.log('2. Open Eloquent and press Cmd+Shift+O');
    console.log('3. Paste the URL in the Manual OAuth Fix window');
    console.log('4. Click "Process OAuth URL"');
    console.log('5. Authentication should complete successfully');
} else {
    console.log('\n⚠️ Some URL parsing tests failed. Check the implementation.');
}

console.log('\n✅ Test completed!');