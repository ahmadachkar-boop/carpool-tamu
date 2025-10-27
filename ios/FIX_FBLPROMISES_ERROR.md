# Fix for FBLPromises Library Loading Error

## Problem

The app was crashing on iOS with this error:
```
dyld[37695]: Library not loaded: @rpath/FBLPromises.framework/FBLPromises
Referenced from: /private/var/containers/Bundle/Application/.../App.app/App.debug.dylib
```

## Root Cause

The `GoogleService-Info.plist` file was included in the Xcode project build settings, which caused Xcode to attempt auto-linking of Firebase native iOS frameworks. However, **this app uses the Firebase JavaScript SDK** (via npm), not the native iOS SDK. The native Firebase frameworks (like FBLPromises) were never installed via CocoaPods, causing the runtime linker to fail.

## Solution

### What Was Fixed

1. **Removed GoogleService-Info.plist from Xcode project**
   - Removed from `PBXBuildFile` section
   - Removed from `PBXFileReference` section
   - Removed from App group
   - Removed from Resources build phase
   - The file still exists on disk but is no longer part of the build process

2. **Updated Podfile**
   - Added post_install hook to explicitly remove any Firebase framework linker flags
   - Prevents accidental auto-linking of Firebase native frameworks

3. **Created cleanup script**
   - `clean-and-rebuild.sh` automates the cleanup process

### How to Apply the Fix

#### Option 1: Use the Cleanup Script (Recommended)

```bash
cd ios
./clean-and-rebuild.sh
```

Then open `App.xcworkspace` in Xcode and build.

#### Option 2: Manual Steps

1. **In Terminal:**
   ```bash
   cd ios/App

   # Clean CocoaPods
   pod deintegrate
   rm -rf Pods
   rm -rf Podfile.lock

   # Clean derived data
   rm -rf ~/Library/Developer/Xcode/DerivedData/App-*

   # Reinstall pods
   pod install
   ```

2. **In Xcode:**
   - Open `App.xcworkspace`
   - Menu: Product → Clean Build Folder (⇧⌘K)
   - Menu: Product → Build (⌘B)
   - Run the app

## Why This Happened

Firebase provides both:
- **JavaScript SDK** (installed via npm) - What this app uses
- **Native iOS SDK** (installed via CocoaPods) - What the app was accidentally trying to link

The presence of `GoogleService-Info.plist` in the Xcode project can trigger Xcode to attempt auto-linking the native SDK, even though it's not actually installed.

## Verification

After rebuilding, the app should launch without the FBLPromises error. Firebase features will continue to work normally through the JavaScript SDK.

## Important Notes

- This app uses **Firebase JavaScript SDK only**
- The `GoogleService-Info.plist` file can be deleted if not needed
- If you need native Firebase features in the future, you would need to:
  1. Add Firebase pods to the Podfile
  2. Re-add GoogleService-Info.plist to the project
  3. Initialize Firebase in Swift code
  4. Remove the post_install hook that removes Firebase linker flags
