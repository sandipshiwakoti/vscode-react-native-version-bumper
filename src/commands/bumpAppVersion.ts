import * as vscode from 'vscode';

import { CONFIG, DEFAULT_VALUES, EXTENSION_ID } from '../constants';
import { BumpType } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { executeVersionOperations } from '../utils/batchUtils';
import { hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { updateStatusBar } from '../utils/statusBarUtils';
import {
    bumpSemanticVersion,
    getCurrentVersions,
    getCustomBuildNumber,
    getCustomVersionForPlatform,
} from '../utils/versionUtils';

export async function bumpAppVersion(withGit: boolean, context?: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const hasAndroid = hasAndroidProject(rootPath);
    const hasIOS = hasIOSProject(rootPath);

    if (!hasAndroid && !hasIOS) {
        vscode.window.showErrorMessage(
            'No React Native platforms detected. Please ensure you have:\n• Android: android/app/build.gradle file\n• iOS: ios/ folder with Info.plist file\n\nAt least one platform is required for version bumping.'
        );
        return;
    }

    const versions = await getCurrentVersions();
    const androidVersion = versions?.android ? versions.android.versionName : DEFAULT_VALUES.SEMANTIC_VERSION;
    const iosVersion = versions.ios ? versions.ios.version : DEFAULT_VALUES.SEMANTIC_VERSION;
    const packageJsonVersion = versions.packageJson || DEFAULT_VALUES.SEMANTIC_VERSION;

    const getPlatformLabel = (bumpType: BumpType) => {
        const platforms: string[] = [];
        if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions?.android) {
            platforms.push(`Android: v${bumpSemanticVersion(androidVersion, bumpType)}`);
        }
        if (!config.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
            platforms.push(`iOS: v${bumpSemanticVersion(iosVersion, bumpType)}`);
        }
        return platforms.length > 0 ? platforms.join(', ') : 'No platforms available';
    };

    if (getPlatformLabel(BumpType.PATCH) === 'No platforms available') {
        const missingPlatforms: string[] = [];
        if (!hasAndroid) {
            missingPlatforms.push('Android (android/app/build.gradle not found)');
        }
        if (!hasIOS) {
            missingPlatforms.push('iOS (ios/ folder not found)');
        }

        vscode.window.showErrorMessage(`Cannot bump version. Missing platform files: ${missingPlatforms.join(', ')}`);
        return;
    }

    const bumpType = await vscode.window.showQuickPick(
        [
            {
                label: `Patch (${getPlatformLabel(BumpType.PATCH)})`,
                value: BumpType.PATCH,
            },
            {
                label: `Minor (${getPlatformLabel(BumpType.MINOR)})`,
                value: BumpType.MINOR,
            },
            {
                label: `Major (${getPlatformLabel(BumpType.MAJOR)})`,
                value: BumpType.MAJOR,
            },
            {
                label: 'Custom',
                value: BumpType.CUSTOM,
                description: 'Set specific version numbers for each platform',
            },
        ],
        {
            placeHolder:
                'Choose how to increment versions (Patch: bug fixes, Minor: new features, Major: breaking changes)',
        }
    );

    if (!bumpType) {
        return;
    }

    let customAndroidVersion: string | null = null;
    let customAndroidBuildNumber: number | null = null;
    let customIOSVersion: string | null = null;
    let customIOSBuildNumber: number | null = null;

    if (bumpType.value === BumpType.CUSTOM) {
        if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions?.android) {
            customAndroidVersion = await getCustomVersionForPlatform('Android', androidVersion);
            if (customAndroidVersion === null) {
                return;
            }

            customAndroidBuildNumber = await getCustomBuildNumber('Android', versions.android.versionCode);

            if (customAndroidBuildNumber === null) {
                return;
            }
        }

        if (!config.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
            customIOSVersion = await getCustomVersionForPlatform('iOS', iosVersion);
            if (customIOSVersion === null) {
                return;
            }

            customIOSBuildNumber = await getCustomBuildNumber('iOS', versions.ios.buildNumber);

            if (customIOSBuildNumber === null) {
                return;
            }
        }
    }

    let packageBumpType: BumpType = bumpType.value as BumpType;
    let customPackageJsonVersion: string | null = null;

    if (!config.get(CONFIG.SKIP_PACKAGE_JSON) && versions.packageJson) {
        const packageBumpTypeSelection = await vscode.window.showQuickPick(
            [
                {
                    label: `Patch (v${bumpSemanticVersion(packageJsonVersion, BumpType.PATCH)})`,
                    value: BumpType.PATCH,
                },
                {
                    label: `Minor (v${bumpSemanticVersion(packageJsonVersion, BumpType.MINOR)})`,
                    value: BumpType.MINOR,
                },
                {
                    label: `Major (v${bumpSemanticVersion(packageJsonVersion, BumpType.MAJOR)})`,
                    value: BumpType.MAJOR,
                },
                {
                    label: 'Custom',
                    value: BumpType.CUSTOM,
                    description: `Current: v${packageJsonVersion} → Set custom version`,
                },
            ],
            { placeHolder: 'Choose package.json version increment type' }
        );

        if (packageBumpTypeSelection) {
            packageBumpType = packageBumpTypeSelection.value as BumpType;

            if (packageBumpType === BumpType.CUSTOM) {
                customPackageJsonVersion = await getCustomVersionForPlatform('package.json', packageJsonVersion);
                if (customPackageJsonVersion === null) {
                    return;
                }
            }
        } else {
            return;
        }
    }

    const type = bumpType.value as BumpType;

    if (config.get(CONFIG.SKIP_PACKAGE_JSON) && config.get(CONFIG.SKIP_ANDROID) && config.get(CONFIG.SKIP_IOS)) {
        vscode.window.showWarningMessage(
            'All platforms are disabled in settings. Enable at least one platform:\n• reactNativeVersionBumper.skipPackageJson\n• reactNativeVersionBumper.skipAndroid\n• reactNativeVersionBumper.skipIOS'
        );
        return;
    }

    const customVersions =
        type === BumpType.CUSTOM
            ? {
                  android: customAndroidVersion
                      ? {
                            version: customAndroidVersion,
                            buildNumber: customAndroidBuildNumber ?? undefined,
                        }
                      : undefined,
                  ios: customIOSVersion
                      ? {
                            version: customIOSVersion,
                            buildNumber: customIOSBuildNumber ?? undefined,
                        }
                      : undefined,
                  packageJson: customPackageJsonVersion ?? undefined,
              }
            : undefined;

    const { results, gitWorkflowResult } = await executeVersionOperations({
        rootPath,
        bumpType: type,
        withGit,
        customVersions,
        packageBumpType,
    });

    const hasSuccessfulOperations = results.some((result) => result.success);
    if (hasSuccessfulOperations) {
        showBumpResults(type, results, context, gitWorkflowResult);
        updateStatusBar();
    } else if (results.length > 0) {
        const errorMessages = results
            .filter((r) => !r.success)
            .map((r) => `${r.platform}: ${r.error || r.message}`)
            .join('\n');
        vscode.window.showErrorMessage(`Operation failed:\n${errorMessages}`);
    }
    return;
}
