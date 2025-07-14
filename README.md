# React Native Version Bumper

🚀 A comprehensive VS Code extension for managing React Native app versions with semantic versioning and Git integration.

## Features

### 🎯 Multi-Platform Support
- **React Native CLI** projects (Android & iOS)
- **Package.json** version management

### 📱 Platform-Specific Version Handling

#### Android
- Automatically increments `versionCode` by 1
- Updates `versionName` using semantic versioning
- Supports `build.gradle` files

#### iOS
- Handles both `Info.plist` and `project.pbxproj` configurations
- Auto-detects whether to use variables or hardcoded values
- Updates `CFBundleVersion`/`CURRENT_PROJECT_VERSION` and `CFBundleShortVersionString`/`MARKETING_VERSION`

### 🔄 Git Integration
- Automatic commit with customizable messages
- Optional branch creation (e.g., `version-bump/ios-v2.2.3` for iOS-only bumps)
- Optional Git tag creation based on latest Git tag (e.g., `v12.0.2`)
- User-confirmed push to remote repository to prevent unintended production deployments
- Staging of all version-related changes

### 📊 Version Management
- Real-time version display in status bar (shows project name and version)
- Comprehensive version overview panel
- Project type auto-detection
- Semantic versioning (major.minor.patch)

## Commands

### 📱 Bump App Version
- Interactive version bumping for native platforms and optionally package.json
- Steps:
  1. Choose bump type (Patch, Minor, Major) for Android and iOS
  2. Choose whether to include package.json and its bump type
  3. Updates all relevant version files

### 🔄 Bump Version and Commit
- Extends "Bump App Version" with Git operations
- Steps:
  1. Choose bump type (Patch, Minor, Major) for Android and iOS
  2. Choose whether to include package.json and its bump type
  3. Confirm Git commit (if not auto-enabled)
  4. Confirm branch creation (if not auto-enabled)
  5. Optionally create Git tag (if not enabled)
  6. Confirm push to remote repository
- Creates descriptive commit messages, branches, and tags

### 👀 Show Current Versions
- Displays all current version information in a formatted webview panel

## Usage

### Quick Start
1. Open your React Native project in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
3. Type "RN Version Bumper" to see available commands
4. Select the appropriate command for your needs

### Status Bar Integration
The extension shows the project name and current package.json version in the status bar (e.g., `my-app: v12.0.2`). Click to view detailed version information for all platforms.

### Git Workflow
Use the "Bump Version and Commit" command for Git operations:
1. Select bump type and package.json inclusion
2. Confirm branch creation (if not auto-enabled in settings)
3. Confirm commit (if not auto-enabled in settings)
4. Choose to create a Git tag (if not enabled in settings)
5. Confirm pushing to remote repository to prevent unintended production deployments
6. Changes are staged, committed, branched (if selected), tagged (if selected), and pushed (if confirmed)

## Configuration

Access settings via `File > Preferences > Settings` and search for "React Native Version Bumper".

### Available Settings

| Setting                                              | Default                      | Description                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reactNativeVersionBumper.skipPackageJson`           | `false`                      | Skip bumping the package.json version                                                                                                                                                                                                                                                                                                                                                                             |
| `reactNativeVersionBumper.skipAndroid`               | `false`                      | Skip bumping the Android version                                                                                                                                                                                                                                                                                                                                                                                  |
| `reactNativeVersionBumper.android.buildGradlePath`   | `"android/app/build.gradle"` | Path to Android `build.gradle` file                                                                                                                                                                                                                                                                                                                                                                               |
| `reactNativeVersionBumper.skipIOS`                   | `false`                      | Skip bumping the iOS version                                                                                                                                                                                                                                                                                                                                                                                      |
| `reactNativeVersionBumper.ios.infoPlistPath`         | `null`                       | Path to iOS `Info.plist` file (auto-detected if null)                                                                                                                                                                                                                                                                                                                                                             |
| `reactNativeVersionBumper.git.autoCommit`            | `false`                      | Automatically commit changes to Git                                                                                                                                                                                                                                                                                                                                                                               |
| `reactNativeVersionBumper.git.commitMessageTemplate` | `"chore: bump {platforms}"`  | Template for the Git commit message. Placeholders: {type}, {platforms}, {version}, {date}, {androidVersion}, {iosVersion}, {androidBuildNumber}, {iosBuildNumber}                                                                                                                                                                                                                                                 |
| `reactNativeVersionBumper.git.skipBranch`            | `false`                      | Skip creating a new Git branch                                                                                                                                                                                                                                                                                                                                                                                    |
| `reactNativeVersionBumper.git.autoCreateBranch`      | `false`                      | Automatically create a new Git branch                                                                                                                                                                                                                                                                                                                                                                             |
| `reactNativeVersionBumper.git.branchNameTemplate`    | `""`                         | Template for the Git branch name. Placeholders: {type}, {version}, {date}, {androidVersion}, {iosVersion}, {androidBuildNumber}, {iosBuildNumber}. Defaults to 'version-bump/android-v{androidVersion}-ios-v{iosVersion}' for both platforms, 'version-bump/android-v{androidVersion}' for Android only, 'version-bump/ios-v{iosVersion}' for iOS only, or 'version-bump/v{version}' for package.json or Git tag. |
| `reactNativeVersionBumper.git.skipTag`               | `false`                      | Skip creating a Git tag                                                                                                                                                                                                                                                                                                                                                                                           |
| `reactNativeVersionBumper.git.autoCreateTag`         | `false`                      | Automatically create a Git tag                                                                                                                                                                                                                                                                                                                                                                                    |
| `reactNativeVersionBumper.git.tagNameTemplate`       | `"v{version}"`               | Template for the Git tag name. Placeholders: {type}, {version}, {date}, {androidVersion}, {iosVersion}, {androidBuildNumber}, {iosBuildNumber}. Uses latest Git tag version by default.                                                                                                                                                                                                                           |
| `reactNativeVersionBumper.git.skipPush`              | `false`                      | Skip pushing to remote repository                                                                                                                                                                                                                                                                                                                                                                                 |

### Example Configuration

For iOS-only bumps with correct branch and tag:

```json
{
  "reactNativeVersionBumper.skipAndroid": true,
  "reactNativeVersionBumper.skipIOS": false,
  "reactNativeVersionBumper.skipPackageJson": false,
  "reactNativeVersionBumper.autoCommit": true,
  "reactNativeVersionBumper.commitMessageTemplate": "chore: bump {platforms}",
  "reactNativeVersionBumper.autoCreateBranch": true,
  "reactNativeVersionBumper.branchNameTemplate": "",
  "reactNativeVersionBumper.autoCreateTag": true,
  "reactNativeVersionBumper.tagNameTemplate": "v{version}",
  "reactNativeVersionBumper.skipPush": false,
  "reactNativeVersionBumper.showInStatusBar": true
}
```

## Project Structure Support

### React Native CLI Projects
```
project/
├── android/
│   └── app/
│       └── build.gradle
├── ios/
│   ├── ProjectName/
│   │   └── Info.plist
│   └── ProjectName.xcodeproj/
│       └── project.pbxproj
└── package.json
```

## Version Bump Examples

### Before
```
Android: versionCode 49, versionName "3.1.9"
iOS: CFBundleVersion 51, CFBundleShortVersionString "2.2.2"
Package.json: "version": "12.0.2"
Latest Git tag: v12.0.2
```

### After Patch Bump (iOS only, skipAndroid: true)
```
Android: versionCode 49, versionName "3.1.9" (unchanged)
iOS: CFBundleVersion 52, CFBundleShortVersionString "2.2.3"
Package.json: "version": "12.0.3" (if included)
Git:
  Branch: version-bump/ios-v2.2.3
  Commit: chore: bump ios to v2.2.3 (52)
  Tag: v12.0.3
  Push: Pushed branch and tag to remote
```

### After Patch Bump (Both Platforms)
```
Android: versionCode 50, versionName "3.2.0"
iOS: CFBundleVersion 52, CFBundleShortVersionString "2.2.3"
Package.json: "version": "12.0.3" (if included)
Git:
  Branch: version-bump/android-v3.2.0-ios-v2.2.3
  Commit: chore: bump android to v3.2.0 (50) and ios to v2.2.3 (52)
  Tag: v12.0.3
  Push: Pushed branch and tag to remote
```

## Advanced Features

### Auto-Detection
- Detects project type based on folder structure
- **React Native CLI**: Has `android/` and `ios/` folders

### Error Handling
- Comprehensive error messages with solutions
- Graceful handling of missing files
- Partial success reporting

### Results Display
- Formatted webview panel showing:
  - ✅ Successful operations with before/after values
  - ❌ Failed operations with error details
  - 📊 Summary of operations completed

## Troubleshooting

### Common Issues

**Android build.gradle not found**
- Ensure `android/app/build.gradle` exists
- Verify `reactNativeVersionBumper.android.buildGradlePath` is correct

**iOS project not found**
- Confirm `ios/` folder and `.xcodeproj` file exist
- Check `reactNativeVersionBumper.ios.infoPlistPath` or ensure auto-detection works

**Package.json not bumped**
- Ensure `reactNativeVersionBumper.skipPackageJson` is `false`
- Confirm you select "Yes" when prompted to include package.json during the bump
- Check the project’s `package.json` exists and is writable

**Git operations failing**
- Verify Git is installed and the project is a Git repository (`git init`)
- Check repository permissions and remote configuration
- Ensure `git push` is allowed for the remote repository

## Contributing

Contributions are welcome! Submit issues, feature requests, or pull requests on [GitHub](https://github.com/sandipshiwakoti/react-native-version-bumper).

## License

MIT License - see LICENSE file for details.
