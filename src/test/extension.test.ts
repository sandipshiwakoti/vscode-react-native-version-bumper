import {
    CONFIG_ANDROID_BUILD_GRADLE_PATH,
    CONFIG_IOS_INFO_PLIST_PATH,
    CONFIG_SKIP_ANDROID,
    CONFIG_SKIP_IOS,
    CONFIG_SKIP_PACKAGE_JSON,
} from '../constants';

import { checkFileExists, createQuickPickMock, setExtensionSettings } from './utilites';

const assert = require('assert');
const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { before, beforeEach, after, afterEach } = require('mocha');
const { runTests } = require('@vscode/test-electron');

// Test suite for React Native Version Bumper Extension
suite('React Native Version Bumper Extension Tests', function () {
    // Extended timeout for VS Code extension tests which can be slow
    this.timeout(30000);

    // Define all file paths used in tests
    const workspacePath = path.resolve(__dirname, '../../testWorkspace');
    const backupPath = path.resolve(__dirname, '../../testWorkspaceBackup');
    const packageJsonPath = path.join(workspacePath, 'package.json');
    const buildGradlePath = path.join(workspacePath, 'android', 'app', 'build.gradle');
    const infoPlistPath = path.join(workspacePath, 'ios', 'Info.plist');
    const customBuildGradlePath = path.join(workspacePath, 'custom', 'build.gradle');
    const customInfoPlistPath = path.join(workspacePath, 'custom', 'Info.plist');
    const customXcodeProjPath = path.join(workspacePath, 'custom', 'project.pbxproj');

    // Validate test workspace structure and activates the extension before all tests
    before(async function () {
        // Check if all required test files exist
        const fileChecks = [
            { path: workspacePath, name: 'workspace' },
            { path: packageJsonPath, name: 'package.json' },
            { path: buildGradlePath, name: 'build.gradle' },
            { path: infoPlistPath, name: 'Info.plist' },
            { path: customBuildGradlePath, name: 'custom build.gradle' },
            { path: customInfoPlistPath, name: 'custom Info.plist' },
            { path: customXcodeProjPath, name: 'custom project.pbxproj' },
        ];

        // Validate all required files exist
        const missingFiles = [];
        for (const { path: filePath, name } of fileChecks) {
            if (!(await checkFileExists(filePath))) {
                missingFiles.push(name);
            }
        }

        if (missingFiles.length > 0) {
            throw new Error(
                `Missing test files: ${missingFiles.join(', ')}. ` +
                    'Ensure testWorkspace has all required files for testing.'
            );
        }

        // Set up VS Code workspace
        await vscode.workspace.updateWorkspaceFolders(0, 0, {
            uri: vscode.Uri.file(workspacePath),
        });

        // Activate the extension under test
        const extension = vscode.extensions.getExtension('sandipshiwakoti.vscode-react-native-version-bumper');
        if (!extension) {
            throw new Error("Extension 'sandipshiwakoti.vscode-react-native-version-bumper' not found.");
        }
        await extension.activate();
    });

    // Creates a backup of the test workspace to restore before each test
    beforeEach(async function () {
        try {
            // Remove existing backup if it exists
            await fs.access(backupPath);
            await fs.rm(backupPath, { recursive: true, force: true });
        } catch (error) {
            // ENOENT is expected if backup doesn't exist
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }

        // Create fresh backup of workspace
        await fs.cp(workspacePath, backupPath, { recursive: true });
    });

    // Restores workspace from backup and resets all extension configurations after each test
    afterEach(async function () {
        // Restore workspace from backup
        await fs.rm(workspacePath, { recursive: true, force: true });
        await fs.cp(backupPath, workspacePath, { recursive: true });
        await fs.rm(backupPath, { recursive: true, force: true });

        // Reset all extension configuration settings to defaults
        const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
        const settingsToReset = [
            CONFIG_SKIP_ANDROID,
            CONFIG_SKIP_IOS,
            CONFIG_SKIP_PACKAGE_JSON,
            CONFIG_ANDROID_BUILD_GRADLE_PATH,
            CONFIG_IOS_INFO_PLIST_PATH,
            'ios.projectPbxprojPath',
        ];

        for (const setting of settingsToReset) {
            await config.update(setting, undefined, vscode.ConfigurationTarget.Workspace);
        }
    });

    // Final cleanup after all tests
    after(async function () {
        try {
            await fs.rm(backupPath, { recursive: true, force: true });
        } catch (error) {
            // Ignore errors during cleanup
            console.warn('Warning: Could not clean up backup directory:', error.message);
        }
    });

    // Test 1: Bump version across all platforms (package.json, Android, iOS)
    test('Bump all platforms together', async function () {
        // Configure extension to update all platforms
        await setExtensionSettings('reactNativeVersionBumper', {
            skipAndroid: false,
            skipIOS: false,
            skipPackageJson: false,
        });

        // Mock user responses: patch version bump, confirm changes, patch for iOS
        const originalShowQuickPick = createQuickPickMock(['patch', 'Yes', 'patch']);

        try {
            // Execute the version bump command
            await vscode.commands.executeCommand('vscode-react-native-version-bumper.bumpAppVersion');

            // Wait for file system operations to complete (only needed for desktop VS Code)
            if (vscode.env.uiKind === vscode.UIKind.Desktop) {
                await new Promise((resolve) => setTimeout(resolve, 10000));
            }

            // Verify package.json was updated
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            assert.strictEqual(
                packageJson.version,
                '1.0.1',
                `Expected package.json version to be 1.0.1, but got ${packageJson.version}`
            );

            // Verify Android build.gradle was updated
            const buildGradleContent = await fs.readFile(buildGradlePath, 'utf8');
            assert.match(
                buildGradleContent,
                /versionCode 2/,
                'Expected versionCode to be incremented to 2 in Android build.gradle'
            );
            assert.match(
                buildGradleContent,
                /versionName "1.0.1"/,
                'Expected versionName to be updated to 1.0.1 in Android build.gradle'
            );

            // Verify iOS Info.plist was updated
            const infoPlistContent = await fs.readFile(infoPlistPath, 'utf8');
            assert.match(
                infoPlistContent,
                /<string>1.0.1<\/string>/,
                'Expected CFBundleShortVersionString to be 1.0.1 in iOS Info.plist'
            );
            assert.match(
                infoPlistContent,
                /<string>2<\/string>/,
                'Expected CFBundleVersion to be incremented to 2 in iOS Info.plist'
            );
        } finally {
            // Always restore the original QuickPick function
            vscode.window.showQuickPick = originalShowQuickPick;
        }
    });

    // Test 2: Bump version for Android only using custom paths
    test('Bump custom android only', async function () {
        // Configure extension to use custom file paths and skip iOS/package.json
        await setExtensionSettings('reactNativeVersionBumper', {
            CONFIG_ANDROID_BUILD_GRADLE_PATH: 'custom/build.gradle',
            CONFIG_IOS_INFO_PLIST_PATH: 'custom/Info.plist',
            'ios.projectPbxprojPath': 'custom/project.pbxproj',
            skipAndroid: false,
            skipIOS: true,
            skipPackageJson: true,
        });

        // Mock user responses
        const originalShowQuickPick = createQuickPickMock(['patch', 'Yes', 'patch']);

        try {
            // Execute the version bump command
            await vscode.commands.executeCommand('vscode-react-native-version-bumper.bumpAppVersion');

            // Wait for file system operations to complete
            if (vscode.env.uiKind === vscode.UIKind.Desktop) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            // Verify package.json was NOT updated (should remain 1.0.0)
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            assert.strictEqual(
                packageJson.version,
                '1.0.0',
                `Expected package.json version to remain 1.0.0, but got ${packageJson.version}`
            );

            // Verify custom Android build.gradle was updated
            const customBuildGradleContent = await fs.readFile(customBuildGradlePath, 'utf8');
            assert.match(
                customBuildGradleContent,
                /versionCode 2/,
                'Expected versionCode to be incremented to 2 in custom Android build.gradle'
            );
            assert.match(
                customBuildGradleContent,
                /versionName "1.0.1"/,
                'Expected versionName to be updated to 1.0.1 in custom Android build.gradle'
            );

            // Verify iOS project file was NOT updated (should remain unchanged)
            const customXcodeProjContent = await fs.readFile(customXcodeProjPath, 'utf8');
            assert.match(
                customXcodeProjContent,
                /APP_VERSION_CODE = 1;/,
                'Expected APP_VERSION_CODE to remain unchanged at 1 in iOS project file'
            );
            assert.match(
                customXcodeProjContent,
                /APP_VERSION_NAME = 1.0.0;/,
                'Expected APP_VERSION_NAME to remain unchanged at 1.0.0 in iOS project file'
            );
        } finally {
            vscode.window.showQuickPick = originalShowQuickPick;
        }
    });

    // Test 3: Bump version for iOS only using custom paths
    test('Bump custom iOS only', async function () {
        // Configure extension to use custom file paths and skip Android/package.json
        await setExtensionSettings('reactNativeVersionBumper', {
            CONFIG_ANDROID_BUILD_GRADLE_PATH: 'custom/build.gradle',
            CONFIG_IOS_INFO_PLIST_PATH: 'custom/Info.plist',
            'ios.projectPbxprojPath': 'custom/project.pbxproj',
            skipAndroid: true,
            skipIOS: false,
            skipPackageJson: true,
        });

        // Mock user responses
        const originalShowQuickPick = createQuickPickMock(['patch', 'Yes', 'patch']);

        try {
            // Execute the version bump command
            await vscode.commands.executeCommand('vscode-react-native-version-bumper.bumpAppVersion');

            // Wait for file system operations to complete
            if (vscode.env.uiKind === vscode.UIKind.Desktop) {
                await new Promise((resolve) => setTimeout(resolve, 5000));
            }

            // Verify package.json was NOT updated (should remain 1.0.0)
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            assert.strictEqual(
                packageJson.version,
                '1.0.0',
                `Expected package.json version to remain 1.0.0, but got ${packageJson.version}`
            );

            // Verify Android build.gradle was NOT updated (should remain unchanged)
            const customBuildGradleContent = await fs.readFile(customBuildGradlePath, 'utf8');
            assert.match(
                customBuildGradleContent,
                /versionCode 1/,
                'Expected versionCode to remain unchanged at 1 in Android build.gradle'
            );
            assert.match(
                customBuildGradleContent,
                /versionName "1.0.0"/,
                'Expected versionName to remain unchanged at 1.0.0 in Android build.gradle'
            );

            // Verify iOS project file was updated
            const updatedXcodeProjContent = await fs.readFile(customXcodeProjPath, 'utf8');
            assert.match(
                updatedXcodeProjContent,
                /APP_VERSION_CODE = 2;/,
                'Expected APP_VERSION_CODE to be incremented to 2 in iOS project file'
            );
            assert.match(
                updatedXcodeProjContent,
                /APP_VERSION_NAME = 1.0.1;/,
                'Expected APP_VERSION_NAME to be updated to 1.0.1 in iOS project file'
            );
        } finally {
            vscode.window.showQuickPick = originalShowQuickPick;
        }
    });
});

// Main function to run the tests
async function main() {
    try {
        await runTests({
            extensionDevelopmentPath: path.resolve(__dirname, '../..'),
            extensionTestsPath: __filename,
            launchArgs: [
                '--disable-extensions',
                `--folder-uri=${vscode.Uri.file(path.resolve(__dirname, '../../testWorkspace')).toString()}`,
            ],
        });
    } catch (err) {
        console.error('Test failed:', err);
        process.exit(1);
    }
}

// Run main function if this file is executed directly
if (require.main === module) {
    main();
}
