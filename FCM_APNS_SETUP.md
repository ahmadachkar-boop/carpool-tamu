# Firebase Cloud Messaging & Apple Push Notifications Setup Guide

This guide will walk you through setting up proper push notifications for the Carpool TAMU app using Firebase Cloud Messaging (FCM) and Apple Push Notification service (APNs).

## Overview

The app now supports **proper push notifications** that work even when the app is closed or in the background. This eliminates the duplicate notification issues you were experiencing.

### What Was Fixed

1. **Duplicate Notifications** - Fixed by using consistent notification IDs
2. **Car Marker Not Appearing** - Fixed race condition with Google Maps API loading
3. **Map Not Showing** - Added fallback center coordinates
4. **Marker Flickering** - Optimized to update positions instead of recreating
5. **Reconnection Duplicates** - Track message IDs instead of just counts
6. **FCM/APNs Integration** - Now supports proper push notifications with your Apple Developer account

---

## Prerequisites

Before you begin, make sure you have:

- ✅ Apple Developer Account (you mentioned you have this now!)
- ✅ Access to Firebase Console for your project
- ✅ Xcode installed (for iOS setup)
- ✅ Admin access to your Firebase project

---

## Part 1: Firebase Console Setup

### Step 1: Generate Web Push Certificate (VAPID Key)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **carpool-tamu-2446c**
3. Click the gear icon ⚙️ > **Project settings**
4. Navigate to **Cloud Messaging** tab
5. Scroll down to **Web configuration** section
6. Under **Web Push certificates**, click **Generate key pair**
7. Copy the generated key (starts with "B...")
8. Create a `.env` file in your project root:

```bash
# Copy the example file
cp .env.example .env
```

9. Open `.env` and add your VAPID key:

```env
# .env
REACT_APP_VAPID_KEY=BNdP9k_your_actual_vapid_key_here_QxYz
```

**Important Security Notes:**
- ✅ `.env` is already in `.gitignore` - it won't be committed
- ✅ Never commit your `.env` file to git
- ✅ Use `.env.example` as a template for other developers
- ✅ For production, set this environment variable in your hosting platform

### Step 2: Enable Cloud Messaging API

1. Still in Firebase Console > **Cloud Messaging** tab
2. Make sure **Firebase Cloud Messaging API (V1)** is enabled
3. If you see a button that says "Enable", click it

---

## Part 2: iOS Setup (APNs with Apple Developer Account)

### Step 1: Create APNs Authentication Key

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Sign in with your Apple Developer account
3. Navigate to **Certificates, Identifiers & Profiles**
4. Click **Keys** in the sidebar
5. Click the **+** button to create a new key
6. Name it: `Carpool TAMU APNs Key`
7. Check the box for **Apple Push Notifications service (APNs)**
8. Click **Continue**, then **Register**
9. **Download the .p8 file** - you can only download this once!
10. Note down:
    - **Key ID** (e.g., ABC123XYZ)
    - **Team ID** (top-right of the page, e.g., TEAM123456)

### Step 2: Upload APNs Key to Firebase

1. Go back to Firebase Console > **Project settings** > **Cloud Messaging**
2. Scroll to **Apple app configuration** section
3. Click **Upload** under APNs Authentication Key
4. Upload the `.p8` file you downloaded
5. Enter your **Key ID** and **Team ID**
6. Click **Upload**

### Step 3: Configure iOS App Identifier

1. Go back to Apple Developer Portal
2. Navigate to **Identifiers**
3. Find your app identifier (e.g., `com.yourdomain.carpooltamu`)
4. Click to edit it
5. Make sure **Push Notifications** capability is checked
6. If not checked, enable it and click **Save**

### Step 4: Update Xcode Project

1. Open your iOS project in Xcode (in `/ios` folder)
2. Select your app target
3. Go to **Signing & Capabilities** tab
4. Click **+ Capability**
5. Add **Push Notifications**
6. Add **Background Modes** (if not already added)
7. Under Background Modes, check:
   - ✅ **Remote notifications**

### Step 5: Build and Deploy iOS App

After making these changes, you need to rebuild your iOS app:

```bash
cd /path/to/carpool-tamu

# Sync Capacitor
npx cap sync ios

# Open in Xcode
npx cap open ios
```

Then in Xcode:
1. Build the app (⌘+B)
2. Test on a real device (push notifications don't work in simulator)
3. Deploy to TestFlight or App Store

---

## Part 3: Android Setup (FCM)

### Step 1: Download google-services.json

1. Go to Firebase Console > **Project settings**
2. Scroll to **Your apps** section
3. Find your Android app
4. Click **Download google-services.json**
5. Place it in: `android/app/google-services.json`

### Step 2: Update Android Project

1. Make sure `android/app/build.gradle` has:

```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

2. Make sure `android/build.gradle` has:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

### Step 3: Build and Deploy Android App

```bash
cd /path/to/carpool-tamu

# Sync Capacitor
npx cap sync android

# Open in Android Studio
npx cap open android
```

Then in Android Studio:
1. Build the app
2. Test on a real device
3. Deploy to Google Play

---

## Part 4: Testing Push Notifications

### Test on Web

1. Open the app in a browser
2. Click the **Notifications** button
3. Allow notification permissions
4. Check browser console - you should see: "✅ FCM token registered"
5. Send a test message from another device/account
6. You should receive a notification!

### Test on iOS

1. Install the app on a real iPhone (not simulator)
2. Open the app and enable notifications
3. Close or background the app
4. Send a test message
5. You should receive a push notification with sound!

### Test on Android

1. Install the app on a real Android device
2. Open the app and enable notifications
3. Close or background the app
4. Send a test message
5. You should receive a push notification!

---

## Part 5: Server-Side Notification Sending (Optional)

To send push notifications from your backend (e.g., Cloud Functions), you'll need to use the Firebase Admin SDK.

### Example Cloud Function

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendMessageNotification = functions.firestore
  .document('couchMessages/{messageId}')
  .onCreate(async (snap, context) => {
    const message = snap.data();

    // Get recipient's FCM token from Firestore
    const recipientTokenDoc = await admin.firestore()
      .collection('fcmTokens')
      .doc(message.recipientUserId)
      .get();

    if (!recipientTokenDoc.exists) {
      console.log('No FCM token found for user');
      return;
    }

    const token = recipientTokenDoc.data().token;

    // Send notification
    const payload = {
      notification: {
        title: 'New Message',
        body: message.message,
        badge: '1'
      },
      data: {
        messageId: context.params.messageId,
        carNumber: String(message.carNumber)
      },
      token: token
    };

    try {
      await admin.messaging().send(payload);
      console.log('✅ Notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending notification:', error);
    }
  });
```

---

## Troubleshooting

### Issue: "VAPID key not set" or "VAPID_KEY not configured" error

**Solution:**
1. Make sure you created a `.env` file in your project root
2. Verify it contains: `REACT_APP_VAPID_KEY=your_actual_key`
3. Restart your development server after adding the .env file:
   ```bash
   # Stop the server (Ctrl+C)
   npm start
   ```
4. Check that your VAPID key starts with "B" (e.g., `BNdP9k...`)
5. Verify the key has no extra spaces or quotes around it

### Issue: iOS notifications not working

**Checklist:**
- ✅ APNs key uploaded to Firebase?
- ✅ Push Notifications capability enabled in Xcode?
- ✅ Testing on real device (not simulator)?
- ✅ App has permission to send notifications?
- ✅ App is built with correct provisioning profile?

### Issue: Android notifications not working

**Checklist:**
- ✅ google-services.json file in correct location?
- ✅ Firebase Cloud Messaging dependency added?
- ✅ Testing on real device?
- ✅ App has notification permission?

### Issue: Web notifications not showing

**Checklist:**
- ✅ HTTPS enabled (required for service workers)?
- ✅ Service worker registered (check DevTools > Application > Service Workers)?
- ✅ Browser supports notifications?
- ✅ Notification permission granted?

### Issue: Still seeing duplicate notifications

**Solution:** Clear app cache and reinstall. The old local notification system may still be cached. After reinstall, the new consistent ID system will prevent duplicates.

---

## Verification Checklist

Before deploying to production, verify:

- [ ] `.env` file created with REACT_APP_VAPID_KEY
- [ ] `.env` file is in `.gitignore` (already done)
- [ ] APNs key uploaded to Firebase Console
- [ ] iOS Push Notifications capability enabled
- [ ] Android google-services.json in place
- [ ] Service worker (`firebase-messaging-sw.js`) accessible at `/firebase-messaging-sw.js`
- [ ] Tested on real iOS device
- [ ] Tested on real Android device
- [ ] Tested on web browser (Chrome/Firefox/Safari)
- [ ] No duplicate notifications appearing
- [ ] Background notifications working when app closed
- [ ] Notification sound playing
- [ ] Car markers appearing immediately on map
- [ ] Map showing without requiring refresh

---

## Support

If you encounter issues during setup:

1. Check browser console logs for errors
2. Check Xcode console logs for iOS errors
3. Check Logcat for Android errors
4. Verify all Firebase configuration is correct
5. Make sure you're testing on real devices (not simulators/emulators for push notifications)

---

## Summary of Files Modified

- ✅ `src/notificationUtils.js` - Fixed duplicate notifications
- ✅ `src/components/CouchNavigator.jsx` - Fixed all map and notification issues
- ✅ `src/fcmUtils.js` - NEW: FCM utilities (uses environment variables)
- ✅ `public/firebase-messaging-sw.js` - NEW: Service worker for background notifications
- ✅ `.env` - NEW: Create this file to store your VAPID key (use .env.example as template)
- ✅ `.env.example` - NEW: Template for environment variables

---

**You're all set!** 🎉

Once you complete the Firebase Console and Apple Developer Portal steps above, your push notifications will work flawlessly across all platforms.
