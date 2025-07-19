<p align="center">
  <img src="assets/logo.png" alt="React Native Version Bumper Logo" width="150" height="150">
</p>

<h1 align="center">React Native Version Bumper</h1>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper">
    <img src="https://img.shields.io/visual-studio-marketplace/v/sandipshiwakoti.vscode-react-native-version-bumper?style=flat-square" alt="Marketplace Version">
  </a>
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/stargazers">
    <img src="https://img.shields.io/github/stars/sandipshiwakoti/vscode-react-native-version-bumper?style=flat-square" alt="GitHub Stars">
  </a>
  <a href="https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/releases">
    <img src="https://img.shields.io/github/v/release/sandipshiwakoti/vscode-react-native-version-bumper?style=flat-square" alt="GitHub Release">
  </a>
</p>

<p align="center">
  <strong>One-click version bumping for React Native. Sync package.json, Android & iOS versions with CodeLens, semantic versioning, and Git automation.</strong>
</p>

---

## ✨ Features

- 📦 **Version Bumping**: Increment versions in `package.json`, Android (`build.gradle`), and iOS (`Info.plist` or `project.pbxproj`) using commands or CodeLens (major, minor, patch).
- 🔍 **CodeLens**: Click CodeLens links (e.g., "Bump Patch: 1.0.0 → 1.0.1") to increment version code and name for Android/iOS or version for `package.json`, with an optional toggle to show/hide CodeLens.
- 🔄 **Git Integration**: Commit, branch, tag, and push changes with customizable templates.
- 📊 **Status Bar Display**: Show the current `package.json` version in the VS Code status bar (toggleable).
- 👀 **Version Overview**: View all platform versions in an interactive webview.
- 🛠️ **Flexible Configuration**: Customize file paths, skip platforms, and tweak Git behaviors via settings.
- 🖱️ **User-Friendly**: Interactive prompts guide you through version bumps and Git operations.
- � **Csross-Platform Sync**: Sync versions across all platforms to maintain consistency.

---

## 🚀 Installation

Get it from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper) or install it manually:

```bash
code --install-extension sandipshiwakoti.vscode-react-native-version-bumper
```

**Requirements**: A React Native project with a `package.json` file and optional `android`/`ios` folders.

---

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

- **Version Bumper: Show Current Platform Versions 👀**  
  Displays current versions for all platforms in a webview.

### 3. CodeLens Version Bumping

When CodeLens is enabled (default), editing `package.json`, `build.gradle`, or `Info.plist` shows CodeLens links above version fields:

- **Bump Patch/Minor/Major Version**: Shows the current and next version (e.g., "Bump Patch: 1.0.0 → 1.0.1"). Clicking increments the version code (Android/iOS), version name (all platforms), or version (`package.json`).
- **Toggle CodeLens**: Use the editor title bar button (circle with upward arrow for enabled, slashed for disabled) to show/hide CodeLens for a cleaner editor view.

### 4. Current File Version Bumping

For precise control, bump versions in the currently active file (package.json, build.gradle, or Info.plist):

- **Version Bumper: Bump Patch Version in Current File (0.0.X)**
- **Version Bumper: Bump Minor Version in Current File (0.X.0)**
- **Version Bumper: Bump Major Version in Current File (X.0.0)**

### 5. Status Bar

Click the status bar item to quickly see the current `package.json` version or trigger the "Show Current Versions" command.

---

## ⚙️ Configuration

Adjust settings in `settings.json` to fit your workflow:

| Setting                                              | Description                                       | Default                      |
| ---------------------------------------------------- | ------------------------------------------------- | ---------------------------- |
| `reactNativeVersionBumper.skipPackageJson`           | Skip `package.json` version bump                  | `false`                      |
| `reactNativeVersionBumper.skipAndroid`               | Skip Android version bump                         | `false`                      |
| `reactNativeVersionBumper.android.buildGradlePath`   | Path to `build.gradle`                            | `"android/app/build.gradle"` |
| `reactNativeVersionBumper.skipIOS`                   | Skip iOS version bump                             | `false`                      |
| `reactNativeVersionBumper.ios.infoPlistPath`         | Path to `Info.plist` (auto-detected if null)      | `null`                       |
| `reactNativeVersionBumper.ios.projectPbxprojPath`    | Path to `project.pbxproj` (auto-detected if null) | `null`                       |
| `reactNativeVersionBumper.git.autoCommit`            | Auto-commit changes                               | `true`                       |
| `reactNativeVersionBumper.git.commitMessageTemplate` | Commit message template                           | `"chore: version bump"`      |
| `reactNativeVersionBumper.git.skipBranch`            | Skip branch creation                              | `false`                      |
| `reactNativeVersionBumper.git.autoCreateBranch`      | Auto-create branch                                | `false`                      |
| `reactNativeVersionBumper.git.branchNameTemplate`    | Branch name template                              | `"version-bump/{version}"`   |
| `reactNativeVersionBumper.git.skipTag`               | Skip tag creation                                 | `false`                      |
| `reactNativeVersionBumper.git.autoCreateTag`         | Auto-create tag                                   | `false`                      |
| `reactNativeVersionBumper.git.tagNameTemplate`       | Tag name template                                 | `"v{version}"`               |
| `reactNativeVersionBumper.git.skipPush`              | Skip pushing to remote                            | `false`                      |
| `reactNativeVersionBumper.enableCodeLens`            | Enable or disable CodeLens for version bumping    | `true`                       |

### Template Placeholders

- `{type}`: Bump type (e.g., "patch")
- `{platforms}`: Affected platforms (e.g., "android to v1.0.1 (2)")
- `{version}`: Latest version (from Git tag or `package.json`)
- `{date}`: Current date (YYYY-MM-DD)
- `{androidVersion}`, `{iosVersion}`: Platform-specific versions
- `{androidBuildNumber}`, `{iosBuildNumber}`: Build numbers

**Example `settings.json`:**

```json
{
    "reactNativeVersionBumper.git.autoCommit": true,
    "reactNativeVersionBumper.git.commitMessageTemplate": "chore: bump to v{version}",
    "reactNativeVersionBumper.git.autoCreateTag": true,
    "reactNativeVersionBumper.git.tagNameTemplate": "v{version}",
    "reactNativeVersionBumper.enableCodeLens": true
}
```

---

## ❓ FAQ

**Q: Why not use a CLI tool instead?**  
A: This extension keeps you in VS Code, offering an integrated experience with interactive prompts, visual feedback, Git support, and CodeLens for version bumping—no terminal required!

**Q: How do I create a release or merge request?**  
A: Use the "Bump All Platform Versions with Git Workflow 🔄" command. After a successful bump, the webview shows buttons to:

- Create a release for the new tag (e.g., on GitHub or GitLab).
- Create a merge request for the new branch (e.g., on GitHub or GitLab).
  These open in your browser for the configured Git remote.

**Q: How do I toggle CodeLens?**  
A: Click the editor title bar button when editing `package.json`, `build.gradle`, or `Info.plist`. The button shows a circle with an upward arrow (enabled) or a slashed version (disabled), toggling CodeLens instantly.

**Q: What if my project structure is different?**  
A: Customize file paths in the settings (e.g., `android.buildGradlePath`, `ios.infoPlistPath`, `ios.projectPbxprojPath`). The extension auto-detects `Info.plist` and `project.pbxproj` for iOS if not specified, ensuring compatibility with non-standard React Native project structures.

---

## 🛠️ Development Setup

- **Tools**: Bun, VS Code, TypeScript.
- **Build**: `bun compile`
- **Test**: `bun test`
- **Package**: `bun package` (creates `.vsix`)
- **Publish**: `bun publish` (for maintainers)

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

---

## 💬 Support

If you find this project helpful, please consider:

- ⭐️ [Starring the repository](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/stargazers)
- 🐛 [Reporting bugs](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues/new?labels=bug&template=bug_report.md)
- 💡 [Suggesting new features](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/issues/new?labels=enhancement&template=feature_request.md)
- 🔄 [Sharing with the React Native community](https://twitter.com/intent/tweet?text=🚀%20Discovered%20a%20great%20tool!%20React%20Native%20Version%20Bumper%20helps%20manage%20versions%20across%20all%20platforms%20with%20one%20click%20⚡️%20Try%20it%20out:%20https://marketplace.visualstudio.com/items?itemName=sandipshiwakoti.vscode-react-native-version-bumper)

---

## 📜 License

This project is licensed under the [MIT License](https://github.com/sandipshiwakoti/vscode-react-native-version-bumper/blob/main/LICENSE).
