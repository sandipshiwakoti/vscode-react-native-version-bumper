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
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/releases">
    <img src="https://img.shields.io/github/v/release/sandipshiwakoti.vscode-react-native-version-bumper?style=flat-square" alt="GitHub Release">
  </a>
</p>

<p align="center">
  <strong>Effortless version management for React Native developers</strong><br>
  One-click version bumping for React Native. Sync package.json, Android & iOS versions with CodeLens, semantic versioning, and Git automation.
</p>

---

## 🎯 Why You Need This

**Before:** Manually editing `package.json`, `build.gradle`, and `Info.plist` files. Forgetting to sync versions. Wrestling with Git tags and releases.

**After:** One command. All platforms updated. Git workflow automated. Release-ready in seconds.

```bash
# What used to take 10+ minutes of manual work:
✅ package.json: 1.0.0 → 1.0.1
✅ Android: versionName "1.0.1", versionCode 2
✅ iOS: CFBundleShortVersionString 1.0.1, CFBundleVersion 2
✅ Git: Committed, tagged v1.0.1, pushed to remote
✅ Ready for app store deployment
```

## ✨ Features

- 📦 **Version Bumping**: Increment versions in `package.json`, Android (`build.gradle`), and iOS (`Info.plist` or `project.pbxproj`) using commands or CodeLens (major, minor, patch, custom).
- 🔍 **CodeLens**: Click CodeLens links (e.g., "Bump Patch: 1.0.0 → 1.0.1") to increment version code and name for Android/iOS or version for `package.json`, with an optional toggle to show/hide CodeLens.
- 🔄 **Git Integration**: Commit, branch, tag, and push changes with customizable templates.
- 📊 **Status Bar Display**: Show the current `package.json` version in the VS Code status bar (toggleable).
- 👀 **Version Overview**: View all platform versions in an interactive webview.
- 🛠️ **Flexible Configuration**: Customize file paths, skip platforms, and tweak Git behaviors via settings.
- 🖱️ **User-Friendly**: Interactive prompts guide you through version bumps and Git operations.
- 🔄 **Cross-Platform Sync**: Sync versions across all platforms to maintain consistency.
- **Smart Batch Mode**: Preview all operations before execution - see exactly what will change across all platforms and Git operations, then execute everything atomically with one click.

---

## 🚀 Installation

Get it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper) or install it manually:

```bash
code --install-extension sandipshiwakoti.vscode-react-native-version-bumper
```

**Requirements**: A React Native project with a `package.json` file and optional `android`/`ios` folders.

---

## ⚡ Quick Start

1. **Install** from [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper)
2. **Open** your React Native project
3. **Press** `Ctrl+Shift+P` (or `Cmd+Shift+P`)
4. **Type** "Version Bumper" and choose your action
5. **Done!** All platforms updated and synced

## 📋 Usage

### 1. Open Your Project

Open a React Native project in VS Code.

### 2. Run Commands

Access commands via the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on macOS):

- **Version Bumper: Bump All Platform Versions 📱**  
  Bumps versions for selected platforms without Git operations.
    - Choose bump type (Major, Minor, Patch) for Android/iOS.
    - Optionally include `package.json` with its own bump type.
    - Updates version code (Android/iOS) and version name (all platforms).
    - View results in a webview (success/failure details).

- **Version Bumper: Bump All Platform Versions with Git Workflow 🔄**  
  Bumps versions and performs Git operations.
    - Same version bump process as above.
    - Additional steps:
        - Create a branch (optional, customizable name).
        - Commit changes (customizable message).
        - Create a tag (optional, customizable format).
        - Push to remote (optional).
    - Webview results include links to:
        - **Create a Release**: For the new tag (e.g., on GitHub or GitLab).
        - **Create a Merge Request**: For the new branch (e.g., on GitHub or GitLab).

- **Version Bumper: Sync Versions Across All Platforms 🔄**  
  Sync all platforms to the same version.
    - Choose source version (package.json, Android, iOS, or custom).
    - Preview changes before confirming.
    - Updates all platforms simultaneously.

- **Version Bumper: Version Overview 👀**  
  Displays current versions for all platforms in a webview.

### 3. CodeLens Version Bumping

When CodeLens is enabled (default), editing `package.json`, `build.gradle`, or `Info.plist` shows CodeLens links above version fields:

- **Bump Patch/Minor/Major Version**: Shows the current and next version (e.g., "Bump Patch: 1.0.0 → 1.0.1"). Clicking increments the version code (Android/iOS), version name (all platforms), or version (`package.json`).
- **✏️ Set Custom Version**: Opens the main version bumper with custom version options for all platforms.
- **Toggle CodeLens**: Use the editor title bar button (circle with upward arrow for enabled, slashed for disabled) to show/hide CodeLens for a cleaner editor view.

**Example CodeLens in action:**

```json
// In package.json
{
  "version": "1.0.0"  ← Click "Bump Patch: 1.0.0 → 1.0.1"
}
```

### 4. Current File Version Bumping

For precise control, bump versions in the currently active file (package.json, build.gradle, or Info.plist):

- **Version Bumper: Bump Patch Version in Current File (0.0.X)**
- **Version Bumper: Bump Minor Version in Current File (0.X.0)**
- **Version Bumper: Bump Major Version in Current File (X.0.0)**

### 5. Status Bar

Click the status bar item to quickly see the current `package.json` version or trigger the "Version Overview" command.

---

## ⚙️ Configuration

Adjust settings in `settings.json` to fit your workflow:

| Setting                                              | Description                                              | Default                                      |
| ---------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| `reactNativeVersionBumper.skipPackageJson`           | Skip `package.json` version bump                         | `false`                                      |
| `reactNativeVersionBumper.skipAndroid`               | Skip Android version bump                                | `false`                                      |
| `reactNativeVersionBumper.android.buildGradlePath`   | Path to `build.gradle`                                   | `"android/app/build.gradle"`                 |
| `reactNativeVersionBumper.skipIOS`                   | Skip iOS version bump                                    | `false`                                      |
| `reactNativeVersionBumper.ios.infoPlistPath`         | Custom path to `Info.plist` (auto-detected if null)      | `null`                                       |
| `reactNativeVersionBumper.ios.projectPbxprojPath`    | Custom path to `project.pbxproj` (auto-detected if null) | `null`                                       |
| `reactNativeVersionBumper.git.commitMessageTemplate` | Commit message template                                  | `"chore: bump version to {platformUpdates}"` |
| `reactNativeVersionBumper.git.skipBranch`            | Skip branch creation                                     | `false`                                      |
| `reactNativeVersionBumper.git.autoCreateBranch`      | Auto-create branch                                       | `false`                                      |
| `reactNativeVersionBumper.git.branchNameTemplate`    | Branch name template                                     | `"release/{version}"`                        |
| `reactNativeVersionBumper.git.skipTag`               | Skip tag creation                                        | `false`                                      |
| `reactNativeVersionBumper.git.autoCreateTag`         | Auto-create tag                                          | `false`                                      |
| `reactNativeVersionBumper.git.tagNameTemplate`       | Tag name template                                        | `"v{version}"`                               |
| `reactNativeVersionBumper.git.skipPush`              | Skip pushing to remote                                   | `false`                                      |
| `reactNativeVersionBumper.enableCodeLens`            | Enable or disable CodeLens for version bumping           | `true`                                       |
| `reactNativeVersionBumper.batchMode`                 | Preview all operations before execution (recommended)    | `true`                                       |

### Template Placeholders

**For commit messages, branch names, and tag names:**

- `{type}`: Bump type (e.g., "patch", "minor", "major")
- `{platformUpdates}`: Affected platforms with versions (e.g., "package.json v1.0.1, Android v1.0.1 (build 2), iOS v1.0.1 (build 3)")
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

### 🎛️ Essential Settings for New Users

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

**Example `settings.json`:**

```json
{
    "reactNativeVersionBumper.git.commitMessageTemplate": "chore: bump version to {platformUpdates}",
    "reactNativeVersionBumper.git.autoCreateTag": true,
    "reactNativeVersionBumper.git.tagNameTemplate": "v{version}",
    "reactNativeVersionBumper.enableCodeLens": true,

    "reactNativeVersionBumper.android.buildGradlePath": "android/app/build.gradle",
    "reactNativeVersionBumper.ios.infoPlistPath": "ios/MyApp/Info.plist",
    "reactNativeVersionBumper.ios.projectPbxprojPath": "ios/MyApp.xcodeproj/project.pbxproj"
}
```

---

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

1. **Command:** "Bump All"
2. **Choose:** Usually "Patch"
3. **Result:** All platforms updated, no Git operations

### 🔄 **Sync Workflow**

When versions get out of sync:

1. **Command:** "Sync All"
2. **Choose:** Source version (package.json, Android, iOS, or custom)
3. **Result:** All platforms aligned to same version

---

## ❓ FAQ

**Q: How do I create a release or merge request?**  
A: Use the "Bump All Platform Versions with Git Workflow 🔄" command. After a successful bump, the webview shows buttons to:

- Create a release for the new tag (e.g., on GitHub or GitLab).
- Create a merge request for the new branch (e.g., on GitHub or GitLab).
  These open in your browser for the configured Git remote.

**Q: How do I toggle CodeLens?**  
A: Click the editor title bar button when editing `package.json`, `build.gradle`, or `Info.plist`. The button shows a circle with an upward arrow (enabled) or a slashed version (disabled), toggling CodeLens instantly.

**Q: What if my project structure is different?**  
A: Customize file paths in the settings (e.g., `android.buildGradlePath`, `ios.infoPlistPath`, `ios.projectPbxprojPath`). The extension auto-detects `Info.plist` and `project.pbxproj` for iOS if not specified, ensuring compatibility with non-standard React Native project structures.

**Important:** Custom iOS paths are fully supported - if you configure `ios.infoPlistPath` to point to a custom location (e.g., `custom/Info.plist`), all version operations including CodeLens will respect this custom path.

**Q: Does this work with Expo projects?**  
A: Yes! The extension works with any React Native project structure, including Expo managed and bare workflows.

**Q: Can I use this with monorepos?**  
A: Yes! You can skip package.json updates and focus on platform-specific files, or configure custom paths for monorepo structures.

---

## 🛠️ Development Setup

- **Tools**: Bun, VS Code, TypeScript.
- **Build**: `bun compile`
- **Test**: `bun test`
- **Package**: `bun package` (creates `.vsix`)
- **Publish**: `bun publish` (for maintainers)

### For Contributors

```bash
# Clone the repository
git clone https://github.com/sandipshiwakoti/vscode-react-native-version-bumper.git
cd vscode-react-native-version-bumper

# Install dependencies (using Bun for speed)
bun install

# Compile TypeScript
bun run compile

# Run tests
bun run test

# Package extension
bun run package
```

---

## 🙌 Contributing

We welcome contributions! Please see our [Contributing Guidelines](.github/CONTRIBUTING.md) for details on how to submit pull requests, report issues, and contribute to the project.

For major changes, please open an issue first to discuss what you would like to change.

We'd love your help! Here's how to contribute:

1. Fork the repo: [github.com/sandipshiwakoti/vscode-react-native-version-bumper](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper)
2. Clone it:

```bash
git clone https://github.com/<your-username>/vscode-react-native-version-bumper.git
```

3. Install dependencies:

```bash
cd vscode-react-native-version-bumper
bun install
```

4. Make changes, then test:

```bash
bun compile
bun test
```

5. Submit a pull request!

### Ways to Contribute

- 🐛 **Report bugs** via [GitHub Issues](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues)
- 💡 **Suggest features** via [Feature Requests](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues/new?template=feature_request.md)
- 🔧 **Submit PRs** for bug fixes or new features
- ⭐ **Star the repo** to show support
- 📢 **Share with others** in the React Native community

---

## 💬 Support

If you find this project helpful, please consider:

- ⭐️ [Starring the repository](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/stargazers)
- 🐛 [Reporting bugs](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues/new?labels=bug&template=bug_report.md)
- 💡 [Suggesting new features](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues/new?labels=enhancement&template=feature_request.md)
- 🔄 [Sharing with the React Native community](https://twitter.com/intent/tweet?text=🚀%20Discovered%20a%20great%20tool!%20React%20Native%20Version%20Bumper%20helps%20manage%20versions%20across%20all%20platforms%20with%20one%20click%20⚡️%20Try%20it%20out:%20https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper)
- 📝 [Writing a review](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper&ssr=false#review-details) on the VS Code Marketplace

---

## 📜 License

This project is licensed under the [MIT License](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/blob/main/LICENSE).

---

<p align="center">
  <strong>Made with ❤️ for the React Native community</strong><br>
  <a href="https://github.com/sandipshiwakoti">@sandipshiwakoti</a>
</p>
