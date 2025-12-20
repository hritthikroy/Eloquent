# QR Code Display Fix Guide

## Issue
QR codes are not showing in the payment modal in the Electron app.

## Root Cause Analysis
The backend is correctly generating and returning QR code URLs in the API response:
- ✅ QR code URL is generated: `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=<address>`
- ✅ QR code URL is accessible (HTTP 200)
- ✅ QR code is a valid PNG image (300x300, 575 bytes)
- ✅ QR code is included in both `payment_instructions.qr_code` and `qr_code_url` fields

## Fixes Applied

### 1. Backend (backend-go/internal/handlers/blockbee.go)
- ✅ Added QR code URL generation for each payment address
- ✅ Ensured QR code URL is included in API response
- ✅ Added fallback to ensure QR code is always available

### 2. Main Process (src/main.js)
- ✅ Added `qr_code_url` to the payment data sent to frontend
- ✅ Ensured `paymentInstructions` object is passed correctly

### 3. Frontend (src/ui/dashboard.js)
- ✅ Updated payment modal to check both `paymentInstructions.qr_code` and `qr_code_url`
- ✅ Added error handling for QR code image loading
- ✅ Added debug logging to track QR code data flow
- ✅ Added fallback display when QR code is not available

## Testing Steps

### 1. Test the Backend API
```bash
# Run the test script
./test-qr-code.sh

# Expected output:
# ✅ QR code URL is accessible (HTTP 200)
# ✅ QR code appears to be a valid image
```

### 2. Test the Payment Modal (Browser)
```bash
# Open the test HTML file
open test-payment-modal.html

# Click "Show Payment Modal" button
# Expected: QR code should display correctly
```

### 3. Test in Electron App
1. **Restart the backend** (if not already running):
   ```bash
   cd backend-go
   go run main.go
   ```

2. **Restart the Electron app**:
   ```bash
   npm start
   ```

3. **Open Developer Tools** in the Electron app:
   - Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux)
   - Go to the Console tab

4. **Trigger a payment**:
   - Navigate to the Pricing section
   - Click "Upgrade to Starter" (or any plan)
   - Sign in if prompted

5. **Check the console logs**:
   ```javascript
   // You should see:
   💰 Crypto payment created: {...}
   🔍 Payment instructions: {...}
   🔍 QR code URL: https://api.qrserver.com/v1/create-qr-code/...
   🔍 QR code from instructions: https://api.qrserver.com/v1/create-qr-code/...
   🔍 showPaymentInstructions called with: {...}
   🔍 QR code check: {condition: true, ...}
   ```

6. **Verify the payment modal**:
   - The modal should appear with payment details
   - The QR code image should be visible
   - If not visible, check the console for errors

## Debugging

### If QR code still doesn't show:

1. **Check Console Logs**:
   - Look for the debug logs starting with 🔍
   - Verify that `qr_code` or `qr_code_url` is present in the data

2. **Check Network Tab**:
   - Open Network tab in Developer Tools
   - Look for requests to `api.qrserver.com`
   - Verify the request succeeds (HTTP 200)

3. **Check Image Loading**:
   - Right-click on the QR code area
   - Select "Inspect Element"
   - Check if the `<img>` tag has the correct `src` attribute
   - Check for any CORS or CSP errors in console

4. **Manual Test**:
   - Copy the QR code URL from the console
   - Paste it in a browser address bar
   - Verify the QR code image loads correctly

## Common Issues and Solutions

### Issue 1: CORS Error
**Symptom**: Console shows CORS error when loading QR code
**Solution**: The QR code API (api.qrserver.com) supports CORS, so this shouldn't happen. If it does, check your Content Security Policy settings.

### Issue 2: CSP Blocking
**Symptom**: Console shows "Content Security Policy" error
**Solution**: Update CSP in main.js to allow images from api.qrserver.com:
```javascript
webPreferences: {
  contentSecurityPolicy: "img-src 'self' data: https://api.qrserver.com"
}
```

### Issue 3: Image Not Loading
**Symptom**: Image tag exists but shows broken image icon
**Solution**: 
- Check if the URL is correctly formatted
- Verify network connectivity
- Try opening the URL directly in a browser

### Issue 4: Conditional Rendering Not Working
**Symptom**: QR code section doesn't appear at all
**Solution**: Check the debug message in the modal. It should show:
```
Debug: qr_code=present, qr_code_url=present
```
If both show "missing", the data is not being passed correctly from main.js.

## Verification Checklist

- [ ] Backend returns QR code URL in API response
- [ ] QR code URL is accessible (HTTP 200)
- [ ] QR code is a valid PNG image
- [ ] main.js passes QR code data to frontend
- [ ] dashboard.js receives QR code data
- [ ] Payment modal renders QR code section
- [ ] QR code image loads successfully
- [ ] QR code is visible to the user

## API Response Structure

The payment creation API should return:
```json
{
  "success": true,
  "order_id": "...",
  "payment_address": "0x...",
  "payment_amount": "3.00",
  "payment_coin": "usdt_bep20",
  "qr_code_url": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=0x...",
  "payment_instructions": {
    "address": "0x...",
    "amount": "3.00",
    "coin": "usdt_bep20",
    "network": "BEP20 (Binance Smart Chain)",
    "qr_code": "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=0x..."
  },
  "plan": {...},
  "estimate": {...}
}
```

## Next Steps

If the QR code still doesn't show after following this guide:

1. **Capture Screenshots**:
   - Screenshot of the payment modal
   - Screenshot of the console logs
   - Screenshot of the Network tab

2. **Check Electron Version**:
   - Some older Electron versions have issues with external images
   - Consider updating to the latest Electron version

3. **Alternative Solution**:
   - Generate QR code on the backend as base64 data URL
   - Embed the QR code directly in the response
   - This eliminates external image loading issues

## Contact

If you continue to experience issues, please provide:
- Console logs from the Electron app
- Network tab screenshot
- The full API response from payment creation
- Electron version (`npm list electron`)