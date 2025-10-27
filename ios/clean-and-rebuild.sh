#!/bin/bash

# Script to clean all build artifacts and prepare for a fresh rebuild
# This fixes the FBLPromises.framework loading error

echo "🧹 Cleaning iOS build artifacts..."

# Navigate to iOS app directory
cd "$(dirname "$0")/App" || exit 1

# Clean CocoaPods
echo "📦 Cleaning CocoaPods..."
pod deintegrate || echo "⚠️  No CocoaPods to deintegrate"
rm -rf Pods
rm -rf Podfile.lock

# Clean build artifacts
echo "🗑️  Removing build artifacts..."
rm -rf App.xcworkspace/xcuserdata
rm -rf App.xcodeproj/xcuserdata
rm -rf App.xcodeproj/project.xcworkspace/xcuserdata

# Clean derived data (if running locally, not on CI)
if [ -d ~/Library/Developer/Xcode/DerivedData ]; then
    echo "🗑️  Cleaning Xcode Derived Data..."
    rm -rf ~/Library/Developer/Xcode/DerivedData/App-*
fi

# Reinstall pods
echo "📦 Installing CocoaPods dependencies..."
pod install

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Next steps:"
echo "1. Open App.xcworkspace in Xcode"
echo "2. In Xcode menu: Product → Clean Build Folder (⇧⌘K)"
echo "3. In Xcode menu: Product → Build (⌘B)"
echo "4. Run the app"
echo ""
echo "The FBLPromises error should be resolved."
