<p align="center">
  <img src="assets/logo.png" alt="React Native Version Bumper Logo" width="150" height="150">
</p>

<h1 align="center">React Native Version Bumper</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper">
    <img src="https://img.shields.io/visual-studio-marketplace/v/sandipshiwakoti.vscode-react-native-version-bumper?style=flat-square" alt="Marketplace Version">
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper">
    <img src="https://img.shields.io/visual-studio-marketplace/d/sandipshiwakoti.vscode-react-native-version-bumper?style=flat-square&color=success" alt="Downloads">
  </a>
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/stargazers">
    <img src="https://img.shields.io/github/stars/sandipshiwakoti/vscode-react-native-version-bumper?style=flat-square" alt="GitHub Stars">
  </a>
</p>

<p align="center">
  <strong>⚡ One-click version bumping for React Native projects</strong><br>
  <em>CodeLens integration • Git automation • Cross-platform sync • Batch preview</em>
</p>

---

## ✨ Features

- 📱 **Version Bumping**: Increment versions across Android (`build.gradle`), iOS (`Info.plist`), and package.json with semantic versioning (major, minor, patch)
- 🔍 **Smart CodeLens**: Click ↑ links above version lines for instant updates with intelligent auto-detection of project files
- 🔄 **Git Workflow Integration**: Create branches, commit changes, tag releases, and push to remote with smart commit messages
- 📋 **Interactive Batch Mode**: Preview all file changes and Git operations before execution, then apply everything atomically
- 📊 **Version Overview Dashboard**: View current versions across all platforms in a unified interface
- ⚙️ **Intelligent Auto-Detection**: Automatically finds Android, iOS, and package.json files with support for custom paths and platform skipping
- 🚀 **Expo Support**: Also works with Expo projects (`app.json`, `app.config.js`, `app.config.ts`) with optional native file synchronization
- 🔗 **Release Automation**: Generate release notes and provide links to create GitHub/GitLab releases and pull requests

## 🚀 Installation

Get it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper) or install it manually:

```bash
code --install-extension sandipshiwakoti.vscode-react-native-version-bumper
```

**Requirements**: A React Native project with `android/` and/or `ios/` folders. Also supports Expo projects with `app.json`, `app.config.js`, or `app.config.ts`. Package.json is optional.

---

## ⚡ Quick Start

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper)
2. **Open** your React Native or Expo project
3. **Press** `Ctrl+Shift+P` (or `Cmd+Shift+P`)
4. **Type** "Version Bumper" and choose your action
5. **Done!** All platforms updated and synced with clean commit messages

## 🎥 See It In Action

### ⚡ CodeLens: One-Click Version Updates

_Click the ↑ arrows above version lines for instant bumps_

https://github.com/user-attachments/assets/49d420db-2b8f-4996-9a17-9518b2812822

### 🔄 Bump All Platforms

_Update Android, iOS, and package.json simultaneously_

https://github.com/user-attachments/assets/19a53e9c-5e5f-409f-b58b-d5dba3b0dca9

### 🚀 Complete Git Workflow

_Branch creation, commits, tags, and release automation_

https://github.com/user-attachments/assets/971d3eaa-63bf-4e60-907b-ddd406ffd250

### 🔀 Sync All Platforms

_Synchronize versions across all platforms to match_

https://github.com/user-attachments/assets/e16e9b6d-2e3a-4dfd-b3c7-41e140f026a2

### 📊 Version Overview

_Monitor all platform versions at a glance_

https://github.com/user-attachments/assets/0ca1f9df-d559-4be1-8204-1226adeb9db8

## 📋 Usage

### 1. Open Your Project

Open a React Native or Expo project in VS Code.

### 2. Run Commands

Access commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS):

- **Version Bumper: Bump All**  
  Bumps versions for selected platforms without Git operations.
    - Choose bump type (Major, Minor, Patch) for Android/iOS.
    - Choose package.json bump type or skip it entirely for this operation.
    - Updates version code (Android/iOS) and version name (all platforms).
    - View results in a webview (success/failure details).

- **Version Bumper: Bump All + Git**  
  Bumps versions and performs Git operations.
    - Same version bump process as above (with option to skip package.json).
    - Additional steps:
        - Create a branch (optional, customizable name).
        - Commit changes (customizable message).
        - Create a tag (optional, customizable format).
        - Push to remote (optional).
    - Webview results include links to:
        - **Create a Release**: For the new tag (e.g., on GitHub or GitLab).
        - **Create a Merge Request**: For the new branch (e.g., on GitHub or GitLab).

- **Version Bumper: Sync All**  
  Sync all platforms to the same version.
    - Choose source version (package.json, Android, iOS, or custom).
    - Preview changes before confirming.
    - Updates all platforms simultaneously.

- **Version Bumper: Sync All + Git**  
  Same as "Sync All" with Git workflow automation.
    - Syncs all platforms to the same version.
    - Creates branch, commits, tags, and pushes to remote.

- **Version Bumper: Version Overview**  
  Displays current versions for all platforms in a webview.

- **Version Bumper: Bump Patch (Current File)**  
  Bumps patch version in the currently active file only (package.json, build.gradle, or Info.plist).

- **Version Bumper: Bump Minor (Current File)**  
  Bumps minor version in the currently active file only.

- **Version Bumper: Bump Major (Current File)**  
  Bumps major version in the currently active file only.

### 3. CodeLens (Click ↑ to Bump)

When CodeLens is enabled (default), editing `package.json`, `build.gradle`, or `Info.plist` shows CodeLens links above version fields:

- **Click ↑ links to bump versions:**
    - **Android/iOS**: Shows build numbers (e.g., "↑ Patch (1.0.1 (24))")
    - **Package.json**: Shows version only (e.g., "↑ Patch (1.0.1)")
    - **Auto-detects**: Project files and custom paths

- **Toggle CodeLens**: Use the editor title bar button (circle with upward arrow for enabled, slashed for disabled) to show/hide CodeLens for a cleaner editor view.

### 📱 Expo Support

The extension also works with Expo projects, supporting:

- **Configuration Files**: `app.json`, `app.config.js`, and `app.config.ts`
- **CodeLens Integration**: Click ↑ arrows above version lines in Expo config files
- **Native File Sync**: Optional sync with Android/iOS files (enable `expo.syncNativeFiles`)
- **Clean Git Messages**: Simple commit messages like `chore: bump version to v1.2.0`

**Example:**

```json
// ↑ Patch (1.0.1) | ↑ Minor (1.1.0) | ↑ Major (2.0.0)
{
    "expo": {
        "version": "1.0.0"
    }
}
```

3. Push changes to your repository

**Example CodeLens in action:**

```json
// ↑ Patch (1.0.1) | ↑ Minor (1.1.0) | ↑ Major (2.0.0)
{
    "version": "1.0.0"
}
```

```gradle
// ↑ Patch (1.0.1 (24)) | ↑ Minor (1.1.0 (24)) | ↑ Major (2.0.0 (24))
versionName "1.0.0"
versionCode 23
```

```xml
<!-- ↑ Patch (1.0.1 (24)) | ↑ Minor (1.1.0 (24)) | ↑ Major (2.0.0 (24)) -->
<key>CFBundleShortVersionString</key>
<string>1.0.0</string>
```

### 4. Auto-Detection & What Gets Updated

**Android (`android/app/build.gradle`)**

- **Auto-detects:** `android/app/build.gradle` file
- **Updates:** `versionName "1.0.0"` and `versionCode 23`
- **Custom path:** Configure via `reactNativeVersionBumper.android.buildGradlePath`

**iOS (`ios/*/Info.plist`)**

- **Auto-detects:** `Info.plist` in `ios/YourAppName/` or `ios/` folder
- **Updates:** `CFBundleShortVersionString` (version) and `CFBundleVersion` (build number)
- **Smart Variables:** Automatically detects and handles iOS variables like `$(MARKETING_VERSION)`, `$(CURRENT_PROJECT_VERSION)` - updates `project.pbxproj` when variables are found
- **Flexible:** Works with direct values or any `$(...)` variable pattern
- **Custom path:** Configure via `reactNativeVersionBumper.ios.infoPlistPath`

**Package.json (optional)**

- **Auto-detects:** `package.json` in project root
- **Updates:** `"version": "1.0.0"`
- **Skip:** Set `reactNativeVersionBumper.skipPackageJson: true`

---

### 5. Status Bar

Click the status bar item to quickly see the current `package.json` version or trigger the "Version Overview" command.

---

## ⚙️ Configuration

Adjust settings in `settings.json` to fit your workflow:

| Setting                                                | Description                                                                                                                                                     | Default                      |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `reactNativeVersionBumper.skipPackageJson`             | Skip `package.json` version bump                                                                                                                                | `false`                      |
| `reactNativeVersionBumper.skipAndroid`                 | Skip Android version bump                                                                                                                                       | `false`                      |
| `reactNativeVersionBumper.android.buildGradlePath`     | Path to `build.gradle`                                                                                                                                          | `"android/app/build.gradle"` |
| `reactNativeVersionBumper.skipIOS`                     | Skip iOS version bump                                                                                                                                           | `false`                      |
| `reactNativeVersionBumper.ios.infoPlistPath`           | Custom path to `Info.plist` (auto-detected if null)                                                                                                             | `null`                       |
| `reactNativeVersionBumper.ios.projectPbxprojPath`      | Custom path to `project.pbxproj` (auto-detected if null)                                                                                                        | `null`                       |
| `reactNativeVersionBumper.git.commitMessagePrefix`     | Commit message prefix (system adds smart version suffix)                                                                                                        | `"chore: bump version to "`  |
| `reactNativeVersionBumper.git.syncCommitMessagePrefix` | Commit message prefix for sync operations (system adds smart version suffix)                                                                                    | `"chore: sync version to "`  |
| `reactNativeVersionBumper.expo.syncNativeFiles`        | Sync Expo version changes to native Android and iOS files                                                                                                       | `false`                      |
| `reactNativeVersionBumper.git.skipBranch`              | Skip branch creation                                                                                                                                            | `false`                      |
| `reactNativeVersionBumper.git.autoCreateBranch`        | Auto-create branch                                                                                                                                              | `false`                      |
| `reactNativeVersionBumper.git.branchNameTemplate`      | Branch name template                                                                                                                                            | `"release/{version}"`        |
| `reactNativeVersionBumper.git.skipTag`                 | Skip tag creation                                                                                                                                               | `false`                      |
| `reactNativeVersionBumper.git.autoCreateTag`           | Auto-create tag                                                                                                                                                 | `false`                      |
| `reactNativeVersionBumper.git.tagNameTemplate`         | Tag name template                                                                                                                                               | `"v{version}"`               |
| `reactNativeVersionBumper.git.skipPush`                | Skip pushing to remote                                                                                                                                          | `false`                      |
| `reactNativeVersionBumper.enableCodeLens`              | Enable or disable CodeLens for version bumping                                                                                                                  | `true`                       |
| `reactNativeVersionBumper.showInStatusBar`             | Show version information in the status bar                                                                                                                      | `true`                       |
| `reactNativeVersionBumper.batchMode`                   | Preview all operations before execution - shows file modifications, version changes, and Git operations in an interactive preview before applying (recommended) | `true`                       |

### Smart Commit Messages

The extension uses a **commit message prefix** approach for cleaner, more predictable commit messages:

#### **How It Works**

- **You configure**: Just the prefix (e.g., `"chore: bump version to "`)
- **System adds**: Smart version suffix based on your project type
- **Result**: Clean, contextual commit messages

#### **Project-Aware Behavior**

| Project Type                          | Example Result                                      |
| ------------------------------------- | --------------------------------------------------- |
| **Expo Projects**                     | `chore: bump version to v1.2.0`                     |
| **React Native (Same Versions)**      | `chore: bump version to v1.2.0`                     |
| **React Native (Different Versions)** | `chore: bump version to Android v1.2.0, iOS v1.2.1` |
| **Package.json Only**                 | `chore: bump version to package.json v1.2.0`        |
| **Single Platform**                   | `chore: bump Android version to v1.2.0`             |

#### **Sync Operations**

Sync operations use a separate configurable prefix:

- **Regular**: `chore: bump version to v1.2.0` (uses `git.commitMessagePrefix`)
- **Sync**: `chore: sync version to v1.2.0` (uses `git.syncCommitMessagePrefix`)

#### **Template Placeholders**

**For branch names and tag names:**

- `{type}`: Bump type (e.g., "patch", "minor", "major")
- `{version}`: Latest version (from Git tag or `package.json`)
- `{date}`: Current date in YYYY-MM-DD format
- `{androidVersion}`: Android version number (e.g., "1.0.1")
- `{iosVersion}`: iOS version number (e.g., "1.0.1")
- `{androidBuildNumber}`: Android build number (e.g., "2")
- `{iosBuildNumber}`: iOS build number (e.g., "3")

### Release Notes

The extension automatically generates release notes with the following behavior:

**1. Uses existing project templates** (if found):

- `.github/RELEASE_TEMPLATE.md`
- `.github/release_template.md`
- `.github/RELEASE_NOTES_TEMPLATE.md`
- `.gitlab/RELEASE_TEMPLATE.md`
- Similar variations

**2. Appends version information** at the end (only if not already present):

```markdown
**Version Updates:**

- Android: 1.0.0 → 1.0.1 (build 123)
- iOS: 1.0.0 → 1.0.1 (build 456)

**Full Changelog**: https://github.com/user/repo/compare/v1.0.0...v1.0.1
```

**3. Falls back to simple default** if no template exists:

```markdown
**What's Changed:**

<!-- Add your changes here -->

-
- **Version Updates:**

- Android: 1.0.0 → 1.0.1 (build 123)
- iOS: 1.0.0 → 1.0.1 (build 456)

**Full Changelog**: https://github.com/user/repo/compare/v1.0.0...v1.0.1
```

**To customize release notes**: Create a `.github/RELEASE_TEMPLATE.md` file in your project with your preferred format. The extension will automatically use it and append version information at the end.

---

## ❓ FAQ

**Q: How do I create a release or merge request?**  
A: Use the "Bump All + Git" command. After a successful bump, the webview shows buttons to:

- Create a release for the new tag (e.g., on GitHub or GitLab).
- Create a merge request for the new branch (e.g., on GitHub or GitLab).
  These open in your browser for the configured Git remote.

**Q: How do I toggle CodeLens?**  
A: Click the editor title bar button when editing `package.json`, `build.gradle`, or `Info.plist`. The button shows a circle with an upward arrow (enabled) or a slashed version (disabled), toggling CodeLens instantly.

**Q: What if my project structure is different?**  
A: Customize file paths in the settings (e.g., `android.buildGradlePath`, `ios.infoPlistPath`, `ios.projectPbxprojPath`). The extension auto-detects `Info.plist` and `project.pbxproj` for iOS if not specified, ensuring compatibility with non-standard React Native project structures.

**Important:** Custom iOS paths are fully supported - if you configure `ios.infoPlistPath` to point to a custom location (e.g., `custom/Info.plist`), all version operations including CodeLens will respect this custom path.

**Q: Can I use this with monorepos?**  
A: Yes! You can skip package.json updates and focus on platform-specific files, or configure custom paths for monorepo structures.

**Q: What's the difference between the "Skip" option and the `skipPackageJson` setting?**  
A: The "Skip" option appears during the interactive bump process and lets you skip package.json for that specific operation. The `skipPackageJson` setting permanently disables package.json updates. Use "Skip" for occasional exclusions, use the setting for permanent workflow preferences.

**Q: Why not a CLI tool instead of a VS Code extension?**  
A: Great question! There are already excellent CLI solutions for CI/CD automation like [Fastlane](https://fastlane.tools/), [semantic-release](https://github.com/semantic-release/semantic-release), and [standard-version](https://github.com/conventional-changelog/standard-version). This extension focuses on a different use case: **developer experience during active development**. It provides visual feedback, interactive previews, CodeLens integration, and seamless IDE workflow - things that are perfect for when you're actively coding but not ideal for automated pipelines. Think of it as complementary to CLI tools rather than competing with them.

---

## 🛠️ Development Setup

- **Tools**: Bun, VS Code, TypeScript.
- **Build**: `bun run compile`
- **Test**: `bun run test`
- **Package**: `bun run package` (creates `.vsix`)
- **Publish**: `bun run publish` (for maintainers)

---

## 🙌 Contributing

Contributions are welcome! Please see [Contributing Guidelines](.github/CONTRIBUTING.md) for details.

---

## 📜 License

This project is licensed under the [MIT License](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/blob/main/LICENSE).

---

<p align="center">
  <strong>Made with ❤️ for the React Native & Expo community</strong><br>
  <a href="https://github.com/sandipshiwakoti">@sandipshiwakoti</a>
</p>
