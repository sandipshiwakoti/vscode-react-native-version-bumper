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
- Optional Git tag creation (e.g., `v1.2.3`)
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
  1. Choose bump type (Patch, Minor, Major)
  2. Choose whether to include package.json
  3. Updates all relevant version files

### 🔄 Bump Version and Commit
- Extends "Bump App Version" with Git operations
- Steps:
  1. Choose bump type (Patch, Minor, Major)
  2. Choose whether to include package.json
  3. Confirm Git commit (if not auto-enabled)
  4. Optionally create Git tag (if not enabled)
  5. Confirm push to remote repository
- Creates descriptive commit messages and tags

### 👀 Show Current Versions
- Displays all current version information in a formatted webview panel

## Usage

### Quick Start
1. Open your React Native project in VS Code
2. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) to open the command palette
3. Type "Version Bumper" to see available commands
4. Select the appropriate command for your needs

### Status Bar Integration
The extension shows the project name and current package.json version in the status bar (e.g., `my-app: v1.0.0`). Click to view detailed version information for all platforms.

### Git Workflow
Use the "Bump Version and Commit" command for Git operations:
1. Select bump type and package.json inclusion
2. Confirm commit (if not auto-enabled in settings)
3. Choose to create a Git tag (if not enabled in settings)
4. Confirm pushing to remote repository to prevent unintended production deployments
5. Changes are staged, committed, tagged (if selected), and pushed (if confirmed)

## Configuration

Access settings via `File > Preferences > Settings` and search for "React Native Version Bumper".

### Available Settings

| Setting                                      | Default                              | Description                                              |
| -------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| `reactNativeVersionBumper.autoCommit`        | `false`                              | Automatically commit version changes to Git              |
| `reactNativeVersionBumper.commitMessage`     | `"chore: bump version to {version}"` | Git commit message template                              |
| `reactNativeVersionBumper.createTags`        | `false`                              | Automatically create Git tags for version bumps          |
| `reactNativeVersionBumper.pushToRemote`      | `false`                              | Enable push to remote (still requires user confirmation) |
| `reactNativeVersionBumper.showInStatusBar`   | `true`                               | Show project name and version in the status bar          |
| `reactNativeVersionBumper.confirmMajorBumps` | `true`                               | Show confirmation dialog for major version bumps         |

### Example Configuration

```json
{
  "reactNativeVersionBumper.autoCommit": true,
  "reactNativeVersionBumper.commitMessage": "🚀 Release v{version}",
  "reactNativeVersionBumper.createTags": true,
  "reactNativeVersionBumper.pushToRemote": true,
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
Android: versionCode 74, versionName "2.36.6"
iOS: CFBundleVersion 91, CFBundleShortVersionString "2.36.2"
Package.json: "version": "2.36.6"
```

### After Minor Bump
```
Android: versionCode 75, versionName "2.37.0"
iOS: CFBundleVersion 92, CFBundleShortVersionString "2.37.0"
Package.json: "version": "2.37.0"
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
- Verify standard React Native structure

**iOS project not found**
- Confirm `ios/` folder and `.xcodeproj` file exist

**Git operations failing**
- Verify Git is installed and the project is a Git repository
- Check repository permissions
- Ensure remote repository is configured
- Confirm push operations to avoid unintended production deployments

## Contributing

Contributions are welcome! Submit issues, feature requests, or pull requests on [GitHub](https://github.com/your-username/react-native-version-bumper).

## License

MIT License - see LICENSE file for details.