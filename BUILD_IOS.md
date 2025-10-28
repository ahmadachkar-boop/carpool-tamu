# iOS Build Instructions

This document explains how to properly build the iOS app for Carpool TAMU.

## Prerequisites

- Node.js and npm installed
- Xcode installed (macOS only)
- CocoaPods installed: `sudo gem install cocoapods`

## Build Process

The iOS app requires the web app to be built first, then synced to the iOS platform using Capacitor.

### Step 1: Install Dependencies

```bash
npm install
cd ios/App && pod install && cd ../..
```

### Step 2: Build the React Web App

```bash
npm run build
```

This creates the `build` directory with the compiled web application.

### Step 3: Sync Web Assets to iOS

```bash
npx cap sync ios
```

This command:
- Copies the web assets from `build` to the iOS app
- Generates `ios/App/App/capacitor.config.json`
- Generates `ios/App/App/config.xml`
- Creates/updates the `ios/App/App/public` directory

### Step 4: Open in Xcode

```bash
npx cap open ios
```

Or manually open: `ios/App/App.xcworkspace`

### Step 5: Build in Xcode

Build and run the app using Xcode's standard build process (⌘+R).

## Troubleshooting

### Missing Configuration Files

If you see errors about missing `capacitor.config.json`, `config.xml`, or `public` directory:

**Solution:** Run `npx cap sync ios` after building the web app.

### Deprecation Warnings

You may see warnings about deprecated 'alert' property in notification handlers:
- `LocalNotificationsHandler.swift:41:14`
- `PushNotificationsHandler.swift:38:49`

**Status:** These are warnings from Capacitor plugins (v7.0.3) and do not prevent building. They should be fixed in future plugin updates.

### Script Phase Warnings

Warnings about "[CP] Embed Pods Frameworks" and "[CP] Copy XCFrameworks" running every build:

**Status:** These are informational CocoaPods warnings and do not affect functionality.

## Quick Build Script

```bash
#!/bin/bash
npm run build && npx cap sync ios && npx cap open ios
```

## Development Workflow

For active development:

1. Make changes to React code in `src/`
2. Run `npm run build`
3. Run `npx cap sync ios` (or `npx cap copy ios` for faster asset-only sync)
4. Reload the app in Xcode/Simulator

## Notes

- The files `ios/App/App/capacitor.config.json`, `ios/App/App/config.xml`, and `ios/App/App/public` are auto-generated and should NOT be committed to git
- Always run `npm run build` before syncing to iOS
- Use `npx cap sync ios` for full sync including native dependencies
- Use `npx cap copy ios` for faster sync when only web assets changed
