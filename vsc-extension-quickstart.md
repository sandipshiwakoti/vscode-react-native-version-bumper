# 🚀 React Native Version Bumper - Quick Start Guide

Welcome to **React Native Version Bumper**! This guide will get you up and running in minutes.

## 🎯 What This Extension Does

**Problem:** Managing versions across React Native platforms is tedious and error-prone.

**Solution:** One-click version bumping with automatic sync across package.json, Android, and iOS.

## ⚡ 5-Minute Setup

### 1. **Install the Extension**

- Open VS Code
- Go to Extensions (`Ctrl+Shift+P` → "Extensions: Install Extensions")
- Search "React Native Version Bumper"
- Click **Install**

### 2. **Open Your React Native Project**

Make sure your project has:

- ✅ `package.json` (required)
- ✅ `android/app/build.gradle` (optional)
- ✅ `ios/` folder with `Info.plist` (optional)

### 3. **Try Your First Version Bump**

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Version Bumper"
3. Select **"Bump All Platform Versions"**
4. Choose **"Patch"** (1.0.0 → 1.0.1)
5. Watch the magic happen! ✨

## 🎨 Visual Features

### CodeLens Integration

When you edit version files, you'll see clickable links:

```json
// In package.json
{
  "version": "1.0.0"  ← Click "Bump Patch: 1.0.0 → 1.0.1"
}
```

### Interactive Results

After each version bump, see a beautiful results page showing:

- ✅ What was updated successfully
- ❌ Any errors (with helpful solutions)
- 🔗 Quick actions for Git workflows

### Status Bar Integration

Your current package.json version appears in the VS Code status bar - click it for quick actions!

## 🔄 Common Workflows

### 🚀 **Release Workflow**

Perfect for production releases:

1. **Command:** "Bump All Platform Versions with Git Workflow"
2. **Choose:** Patch/Minor/Major
3. **Result:**
    - All platforms updated
    - Git commit created
    - Tag created (e.g., v1.0.1)
    - Pushed to remote
    - Ready for app store!

### 🔧 **Development Workflow**

For regular development:

1. **Command:** "Bump All Platform Versions"
2. **Choose:** Usually "Patch"
3. **Result:** All platforms updated, no Git operations

### 🔄 **Sync Workflow**

When versions get out of sync:

1. **Command:** "Sync Versions Across All Platforms"
2. **Choose:** Source version (package.json, Android, iOS, or custom)
3. **Result:** All platforms aligned to same version

## ⚙️ Essential Configuration

Add these to your VS Code `settings.json`:

```json
{
    // Enable CodeLens (clickable version links)
    "reactNativeVersionBumper.enableCodeLens": true,

    // Git automation for releases
    "reactNativeVersionBumper.git.autoCreateTag": true,
    "reactNativeVersionBumper.git.commitMessageTemplate": "🚀 Release v{version}",

    // Skip platforms you don't use
    "reactNativeVersionBumper.skipAndroid": false,
    "reactNativeVersionBumper.skipIOS": false
}
```

## 🎯 Pro Tips

### 💡 **Tip 1: Use CodeLens for Quick Bumps**

Instead of running commands, just click the "Bump Patch" link that appears above version lines in your files.

### 💡 **Tip 2: Customize Git Messages**

Use template variables in your commit messages:

```json
"reactNativeVersionBumper.git.commitMessageTemplate": "🚀 Release v{version}\n\nPlatforms updated:\n{platforms}"
```

### 💡 **Tip 3: Branch-Based Workflow**

For team environments, enable branch creation:

```json
"reactNativeVersionBumper.git.autoCreateBranch": true,
"reactNativeVersionBumper.git.branchNameTemplate": "release/v{version}"
```

### 💡 **Tip 4: Status Bar Quick Access**

Click the version number in your status bar for instant access to version commands.

### 💡 **Tip 5: Version Dashboard**

Use "Show Current Platform Versions" to get a visual overview of all your versions and sync status.

## 🚨 Troubleshooting

### **Issue: "No React Native project detected"**

**Solution:** Make sure you have a `package.json` file in your workspace root.

### **Issue: "Android/iOS files not found"**

**Solution:** Check your project structure or configure custom paths in settings:

```json
{
    "reactNativeVersionBumper.android.buildGradlePath": "android/app/build.gradle",
    "reactNativeVersionBumper.ios.infoPlistPath": "ios/MyApp/Info.plist"
}
```

### **Issue: "Git operations failed"**

**Solution:** Make sure you're in a Git repository and have proper remote access.

### **Issue: "CodeLens not showing"**

**Solution:** Enable it in settings:

```json
{
    "reactNativeVersionBumper.enableCodeLens": true
}
```

## 🎉 You're Ready!

That's it! You now have a powerful version management system for your React Native projects.

### **Next Steps:**

1. ⭐ [Star the repository](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper) if you find it helpful
2. 📝 [Report issues](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues) or suggest features
3. 📢 Share with your React Native team!

### **Need Help?**

- 📖 [Full Documentation](README.md)
- 🐛 [Report Issues](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues)
- 💬 [Join Discussions](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/discussions)

---

<p align="center">
  <strong>Happy version bumping! 🚀</strong><br>
  Made wi
