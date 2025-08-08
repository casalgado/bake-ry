# Manual Testing Guide: Billing HTTP Endpoints

## Prerequisites

### 1. Start Firebase Emulators
```bash
cd C:\Users\casal\documents\web\back\bake-ry\functions
npm run serve
```

Wait for the message: `✔  functions: Listening on http://localhost:5001`

### 2. Get Admin Authentication Token

You'll need a valid Firebase admin token. You can:

**Option A: Create test admin user (recommended)**
```bash
# In another terminal, while emulators are running
node -e "
const admin = require('firebase-admin');
const { initializeApp } = require('./src/config/firebase');
initializeApp();

admin.auth().createUser({
  uid: 'test-admin-123',
  email: 'admin@test.com',
  password: 'testpassword123'
}).then(() => {
  return admin.auth().setCustomUserClaims('test-admin-123', {
    role: 'system_admin'
  });
}).then(() => {
  console.log('Test admin user created');
  console.log('Email: admin@test.com');
  console.log('Password: testpassword123');
}).catch(console.error);
"
```

**Option B: Use existing admin user**
If you already have a system admin user, use their token.

### 3. Get Authentication Token

Use Firebase Auth to get an ID token:
```bash
# Using curl to Firebase Auth REST API
curl -X POST 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_FIREBASE_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@test.com",
    "password": "testpassword123",
    "returnSecureToken": true
  }'
```

Or use the Firebase Auth emulator:
```bash
curl -X POST 'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "admin@test.com",
    "password": "testpassword123",
    "returnSecureToken": true
  }'
```

Save the `idToken` from the response.

## Base URL
```
http://localhost:5001/bake-ry-c8c61/us-central1/bake
```

## Test Commands

Replace `<YOUR_ID_TOKEN>` with the actual token from step 3.

### 1. Check Subscriptions Due for Billing
```bash
curl -X GET "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/due" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected Response (when no subscriptions due):**
```json
{
  "success": true,
  "count": 0,
  "subscriptions": [],
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### 2. Process All Billing
```bash
curl -X POST "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/process" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json"
```

**Expected Response (when no subscriptions due):**
```json
{
  "success": true,
  "results": {
    "processed": 0,
    "successful": 0,
    "failed": 0,
    "suspended": 0,
    "errors": [],
    "message": "No subscriptions due for billing"
  },
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

### 3. Retry Specific Subscription
```bash
curl -X POST "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/retry/bakery-123" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "recurringPaymentId": "payment-456"
  }'
```

**Expected Response (when bakery not found):**
```json
{
  "success": false,
  "error": "Invalid subscription or recurring payment ID",
  "timestamp": "2024-01-25T10:30:00.000Z"
}
```

## Testing with Real Data

### 1. Create Test Bakery with Subscription
```bash
# First create a bakery (adjust based on your existing endpoints)
curl -X POST "http://localhost:5001/bake-ry-c8c61/us-central1/bake/bakeries" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Bakery",
    "email": "test@bakery.com"
  }'
```

### 2. Set up Subscription in Bakery Settings
```bash
curl -X PATCH "http://localhost:5001/bake-ry-c8c61/us-central1/bake/bakeries/BAKERY_ID/settings/default" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription": {
      "status": "TRIAL",
      "tier": "BASIC",
      "subscriptionStartDate": "2024-01-01T00:00:00Z",
      "savedCardId": "test-card-123",
      "amount": 99000,
      "currency": "COP"
    }
  }'
```

### 3. Test Again with Real Data
Run the same curl commands as above - you should now see actual subscription data.

## Error Testing

### 1. Test Missing Token
```bash
curl -X GET "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/due" \
  -H "Content-Type: application/json"
```

**Expected:** 401 Unauthorized

### 2. Test Invalid Token
```bash
curl -X GET "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/due" \
  -H "Authorization: Bearer invalid-token" \
  -H "Content-Type: application/json"
```

**Expected:** 401 Unauthorized

### 3. Test Missing recurringPaymentId
```bash
curl -X POST "http://localhost:5001/bake-ry-c8c61/us-central1/bake/admin/billing/retry/bakery-123" \
  -H "Authorization: Bearer <YOUR_ID_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected Response:**
```json
{
  "success": false,
  "error": "recurringPaymentId is required"
}
```

## Troubleshooting

### Common Issues

1. **Port already in use**: Firebase emulator ports might be in use. Check with `netstat -an | find "5001"`

2. **Authentication errors**: Make sure you're using the emulator auth endpoint if testing locally

3. **404 Not Found**: Verify the function URL matches your Firebase project ID

4. **CORS errors**: The endpoints should handle CORS properly, but if testing from browser, use curl instead

### Checking Logs
```bash
# In another terminal while emulators are running
npm run logs
```

### Stopping Emulators
```bash
# Ctrl+C in the terminal running emulators, or:
firebase emulators:stop
```

## Next Steps

Once manual testing confirms everything works:

1. **Set up external scheduling** (cron-job.org, GitHub Actions, etc.)
2. **Monitor logs** during scheduled runs  
3. **Set up alerts** for billing failures
4. **Create dashboard** for billing status monitoring

## Sample Postman Collection

If you prefer Postman, import this collection:

```json
{
  "info": {
    "name": "Billing API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Get Due Subscriptions",
      "request": {
        "method": "GET",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/admin/billing/due",
          "host": ["{{base_url}}"],
          "path": ["admin", "billing", "due"]
        }
      }
    },
    {
      "name": "Process All Billing",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          }
        ],
        "url": {
          "raw": "{{base_url}}/admin/billing/process",
          "host": ["{{base_url}}"],
          "path": ["admin", "billing", "process"]
        }
      }
    },
    {
      "name": "Retry Subscription",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Authorization",
            "value": "Bearer {{admin_token}}"
          },
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"recurringPaymentId\": \"payment-456\"\n}"
        },
        "url": {
          "raw": "{{base_url}}/admin/billing/retry/bakery-123",
          "host": ["{{base_url}}"],
          "path": ["admin", "billing", "retry", "bakery-123"]
        }
      }
    }
  ],
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:5001/bake-ry-c8c61/us-central1/bake"
    },
    {
      "key": "admin_token",
      "value": "YOUR_ID_TOKEN_HERE"
    }
  ]
}
```