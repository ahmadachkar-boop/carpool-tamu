# Cloud Functions Deployment Guide

This guide explains how to deploy the Cloud Functions that enable background push notifications when the app is closed.

## What This Fixes

**Issue**: Not receiving notifications when the app is force closed
**Solution**: Cloud Functions that trigger when messages are created and send push notifications via FCM/APNs

---

## Prerequisites

Before deploying:

- ✅ Firebase CLI installed
- ✅ Firebase project initialized
- ✅ APNs key uploaded to Firebase (see FCM_APNS_SETUP.md)
- ✅ VAPID key configured in `src/fcmUtils.js`
- ✅ Users have enabled notifications in the app (FCM tokens registered)

---

## Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

Verify installation:

```bash
firebase --version
```

---

## Step 2: Login to Firebase

```bash
firebase login
```

This will open a browser window for authentication.

---

## Step 3: Navigate to Functions Directory

```bash
cd /home/user/carpool-tamu/functions
```

---

## Step 4: Install Dependencies

```bash
npm install
```

This installs all required packages for Cloud Functions.

---

## Step 5: Deploy Cloud Functions

Deploy all functions:

```bash
cd /home/user/carpool-tamu
firebase deploy --only functions
```

Or deploy just the notification function:

```bash
firebase deploy --only functions:sendMessageNotification
```

---

## Step 6: Verify Deployment

After deployment, you'll see output like:

```
✔  functions[sendMessageNotification(us-central1)] Successful create operation.
Function URL (sendMessageNotification(us-central1)): https://...
```

Check Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Functions** section
4. You should see `sendMessageNotification` listed

---

## Step 7: Test Background Notifications

### Test on iOS:

1. Open the app on iPhone
2. Enable notifications
3. **Force close the app** (swipe up in app switcher)
4. Have someone send you a message from couch or navigator
5. You should receive a push notification with sound! 🔔

### Test on Android:

1. Open the app on Android device
2. Enable notifications
3. **Force close the app** (swipe away from recent apps)
4. Have someone send you a message
5. You should receive a push notification! 🔔

### Test on Web:

1. Open the app in browser (Chrome/Firefox)
2. Enable notifications
3. **Close the browser tab**
4. Have someone send you a message
5. You should receive a desktop notification! 🔔

---

## How It Works

### Architecture

```
User sends message
    ↓
Message added to Firestore "couchMessages" collection
    ↓
Cloud Function triggered (sendMessageNotification)
    ↓
Function looks up recipient's FCM token from "fcmTokens" collection
    ↓
Function sends push notification via FCM
    ↓
FCM routes to APNs (iOS) or Android notification service
    ↓
User receives notification even if app is closed!
```

### Function Logic

1. **Trigger**: When a new document is created in `couchMessages` collection
2. **Determine Recipient**:
   - If sender is "navigator" → notify couch users
   - If sender is "couch" → notify navigator (driver)
3. **Get FCM Tokens**: Query `fcmTokens` collection for registered devices
4. **Send Notification**: Use Firebase Admin SDK to send via FCM
5. **Delivery**:
   - iOS: FCM → APNs → Device
   - Android: FCM → Android notification service → Device
   - Web: FCM → Service Worker → Browser notification

---

## Monitoring and Debugging

### View Function Logs

```bash
firebase functions:log
```

Or in Firebase Console:
1. Go to **Functions** section
2. Click on `sendMessageNotification`
3. Click **Logs** tab

### Common Log Messages

**Success**:
```
=== MESSAGE NOTIFICATION TRIGGERED ===
New message from: navigator
Sending notification to 3 device(s)
✅ Notification sent! Success: 3, Failed: 0
```

**No Tokens**:
```
No FCM tokens found
```
→ Solution: Users need to enable notifications in the app

**Failed Delivery**:
```
Failed to send to token 0: [Error details]
```
→ Check if token is invalid/expired, user needs to re-enable notifications

---

## Updating Cloud Functions

When you make changes to `functions/index.js`:

1. Save the file
2. Deploy again:
   ```bash
   firebase deploy --only functions:sendMessageNotification
   ```

---

## Cost Considerations

### Firebase Cloud Functions Pricing

**Spark Plan (Free)**:
- 2 million invocations/month
- 400,000 GB-sec, 200,000 GHz-sec of compute time
- 5GB network egress

**Blaze Plan (Pay as you go)**:
- First 2M invocations free
- $0.40 per million invocations after that

For your use case (messages), you'll likely stay well within free limits unless you have thousands of active users.

### FCM Pricing

**FCM is completely free** for:
- ✅ Unlimited messages
- ✅ APNs integration
- ✅ Android push notifications
- ✅ Web push notifications

---

## Troubleshooting

### Issue: Function not triggering

**Check**:
1. Function deployed successfully?
   ```bash
   firebase functions:list
   ```
2. Firestore rules allow writes to `couchMessages`?
3. Check function logs for errors

### Issue: Notifications not received

**Checklist**:
- ✅ Cloud Function deployed?
- ✅ User enabled notifications in app?
- ✅ FCM token saved to Firestore `fcmTokens` collection?
- ✅ APNs key uploaded (for iOS)?
- ✅ App has notification permissions?
- ✅ Testing on real device (not simulator for iOS)?

**Debug Steps**:
1. Check function logs: `firebase functions:log`
2. Check Firestore `fcmTokens` collection has user's token
3. Verify token format looks correct (long alphanumeric string)
4. Check Firebase Console > Cloud Messaging for any errors

### Issue: "Permission denied" errors

**Solution**: Update Firestore Security Rules to allow Cloud Functions to read/write:

```javascript
// Add this to your firestore.rules
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow Cloud Functions to read FCM tokens
    match /fcmTokens/{userId} {
      allow read, write: if request.auth != null || request.resource == null;
    }
  }
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

### Issue: Duplicate notifications (one from local, one from server)

**This is expected behavior** when app is open:
- Local notification: Shown immediately when message arrives (foreground)
- Server notification: Triggered by Cloud Function

**To prevent duplicates**, the local notification logic already checks if the message is for the current user. The Cloud Function sends to ALL registered tokens, but the client should only show if it's relevant.

If you're getting true duplicates, check:
1. Make sure you're not subscribed to the message listener twice
2. Verify `lastNotifiedMessageIdRef` is working correctly

---

## Security Best Practices

### 1. Validate Message Data

The Cloud Function should validate that messages have required fields:

```javascript
if (!message.sender || !message.carNumber || !message.message) {
  console.error("Invalid message data");
  return null;
}
```

### 2. Rate Limiting

Consider adding rate limiting to prevent spam:

```javascript
// Check if user sent too many messages in short time
// Store message counts in Firestore with expiry
```

### 3. Token Management

Clean up invalid tokens:

```javascript
if (response.failureCount > 0) {
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error.code === 'messaging/invalid-registration-token') {
      // Remove invalid token from Firestore
      await db.collection('fcmTokens').doc(tokens[idx]).delete();
    }
  });
}
```

---

## Summary

After deploying Cloud Functions:

✅ Users will receive notifications when app is closed
✅ Works on iOS, Android, and web
✅ Uses your Apple Developer account APNs integration
✅ Completely free for reasonable usage
✅ Automatic delivery with sound and badge

**You're done!** 🎉

Test it by force closing the app and sending a message. You should receive a push notification!
