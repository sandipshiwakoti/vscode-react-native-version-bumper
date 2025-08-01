import * as vscode from 'vscode';

import { CONFIG, DEFAULT_VALUES, EXTENSION_ID, REGEX_PATTERNS } from '../constants';
import { BumpResult, BumpType, ProjectVersions, SyncOption, SyncSource, VersionOperationOptions } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { hasAndroidProject, hasIOSProject, isExpoProject } from '../utils/fileUtils';
import {
    bumpSemanticVersion,
    getCurrentVersions,
    getCustomBuildNumber,
    getCustomVersionForPlatform,
    getHighestVersion,
} from '../utils/versionUtils';

import { executeVersionOperations } from './batchService';
import { updateStatusBar } from './uiService';

export async function executeVersionBump(options: VersionOperationOptions): Promise<void> {
    const { withGit, isSync = false, context } = options;
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const isExpo = isExpoProject(rootPath);
    const hasAndroid = hasAndroidProject(rootPath);
    const hasIOS = hasIOSProject(rootPath);

    if (!isExpo && !hasAndroid && !hasIOS) {
        const errorMessage = isSync
            ? 'No React Native or Expo projects found. This extension requires at least one platform to be present.'
            : 'No React Native or Expo platforms detected. Please ensure you have:\n• Expo: app.json with expo config\n• Android: android/app/build.gradle file\n• iOS: ios/ folder with Info.plist file\n\nAt least one platform is required for version bumping.';

        vscode.window.showErrorMessage(errorMessage);
        return;
    }

    try {
        const versions = await getCurrentVersions();

        if (isSync) {
            await handleSyncOperation(rootPath, versions, isExpo, hasAndroid, hasIOS, withGit, context, config);
        } else {
            await handleBumpOperation(rootPath, versions, isExpo, hasAndroid, hasIOS, withGit, context, config);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const operation = isSync ? 'sync versions' : 'bump version';
        vscode.window.showErrorMessage(`Failed to ${operation}: ${errorMessage}`);
    }
}

async function handleBumpOperation(
    rootPath: string,
    versions: ProjectVersions,
    isExpo: boolean,
    hasAndroid: boolean,
    hasIOS: boolean,
    withGit: boolean,
    context?: vscode.ExtensionContext,
    config?: vscode.WorkspaceConfiguration
) {
    const androidVersion = versions?.android ? versions.android.versionName : DEFAULT_VALUES.SEMANTIC_VERSION;
    const iosVersion = versions.ios ? versions.ios.version : DEFAULT_VALUES.SEMANTIC_VERSION;
    const expoVersion = versions.expo ? versions.expo.version : DEFAULT_VALUES.SEMANTIC_VERSION;
    const packageJsonVersion = versions.packageJson || DEFAULT_VALUES.SEMANTIC_VERSION;

    const getPlatformLabel = (bumpType: BumpType) => {
        const platforms: string[] = [];

        if (isExpo && versions.expo) {
            const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);
            const expoLabel = `Expo: v${bumpSemanticVersion(expoVersion, bumpType)}`;

            if (syncNativeFiles) {
                const syncPlatforms: string[] = [];
                if (hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
                    syncPlatforms.push('Android');
                }
                if (hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
                    syncPlatforms.push('iOS');
                }

                if (syncPlatforms.length > 0) {
                    platforms.push(`${expoLabel} (syncs to ${syncPlatforms.join(' & ')})`);
                } else {
                    platforms.push(expoLabel);
                }
            } else {
                platforms.push(expoLabel);
            }
        } else {
            if (!config?.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions?.android) {
                platforms.push(`Android: v${bumpSemanticVersion(androidVersion, bumpType)}`);
            }
            if (!config?.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
                platforms.push(`iOS: v${bumpSemanticVersion(iosVersion, bumpType)}`);
            }
        }

        return platforms.length > 0 ? platforms.join(', ') : 'No platforms available';
    };

    if (getPlatformLabel(BumpType.PATCH) === 'No platforms available') {
        const missingPlatforms: string[] = [];
        if (isExpo) {
            missingPlatforms.push('Expo (app.json with expo config not found)');
        } else {
            if (!hasAndroid) {
                missingPlatforms.push('Android (android/app/build.gradle not found)');
            }
            if (!hasIOS) {
                missingPlatforms.push('iOS (ios/ folder not found)');
            }
        }

        vscode.window.showErrorMessage(`Cannot bump version. Missing platform files: ${missingPlatforms.join(', ')}`);
        return;
    }

    const bumpType = await vscode.window.showQuickPick(
        [
            { label: `Patch (${getPlatformLabel(BumpType.PATCH)})`, value: BumpType.PATCH },
            { label: `Minor (${getPlatformLabel(BumpType.MINOR)})`, value: BumpType.MINOR },
            { label: `Major (${getPlatformLabel(BumpType.MAJOR)})`, value: BumpType.MAJOR },
            {
                label: 'Custom',
                value: BumpType.CUSTOM,
                description: isExpo
                    ? 'Set specific Expo version (will sync to native files if enabled)'
                    : 'Set specific version numbers for each platform',
            },
        ],
        {
            placeHolder:
                isExpo && config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false)
                    ? 'Choose how to increment Expo version (will sync to Android/iOS native files)'
                    : 'Choose how to increment versions (Patch: bug fixes, Minor: new features, Major: breaking changes)',
        }
    );

    if (!bumpType) {
        return;
    }

    let customVersions:
        | {
              android?: { version: string; buildNumber?: number };
              ios?: { version: string; buildNumber?: number };
              expo?: { version: string };
              packageJson?: string;
          }
        | undefined;

    if (bumpType.value === BumpType.CUSTOM) {
        const result = await getCustomVersions(
            versions,
            isExpo,
            hasAndroid,
            hasIOS,
            androidVersion,
            iosVersion,
            expoVersion,
            config
        );
        if (result === null) {
            return;
        }
        customVersions = result;
    } else if (isExpo && versions.expo) {
        const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);

        if (!syncNativeFiles && (hasAndroid || hasIOS)) {
            const nativePlatforms: string[] = [];
            if (hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
                nativePlatforms.push('Android');
            }
            if (hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
                nativePlatforms.push('iOS');
            }

            if (nativePlatforms.length > 0) {
                const syncChoice = await vscode.window.showQuickPick(
                    [
                        {
                            label: 'Yes, sync to native files',
                            value: true,
                            description: `Update ${nativePlatforms.join(' and ')} native files with Expo version`,
                        },
                        {
                            label: 'No, Expo only',
                            value: false,
                            description: 'Only update app.json, skip native files',
                        },
                    ],
                    {
                        placeHolder: `Sync Expo version to ${nativePlatforms.join(' and ')} native files?`,
                    }
                );

                if (syncChoice === undefined) {
                    return;
                }

                if (syncChoice.value) {
                    const newExpoVersion = bumpSemanticVersion(expoVersion, bumpType.value);

                    customVersions = {
                        expo: { version: newExpoVersion },
                        android:
                            hasAndroid && !config?.get(CONFIG.SKIP_ANDROID) && versions.android
                                ? {
                                      version: newExpoVersion,
                                      buildNumber: versions.expo.androidVersionCode
                                          ? versions.expo.androidVersionCode + 1
                                          : versions.android.versionCode + 1,
                                  }
                                : undefined,
                        ios:
                            hasIOS && !config?.get(CONFIG.SKIP_IOS) && versions.ios
                                ? {
                                      version: newExpoVersion,
                                      buildNumber: versions.expo.iosBuildNumber
                                          ? parseInt(versions.expo.iosBuildNumber) + 1
                                          : parseInt(versions.ios.buildNumber) + 1,
                                  }
                                : undefined,
                    };
                }
            }
        }
    }

    const packageBumpType = await getPackageJsonBumpType(versions, packageJsonVersion, config);
    if (packageBumpType === null) {
        return;
    }

    const skipPackageJson = config?.get(CONFIG.SKIP_PACKAGE_JSON) || packageBumpType.skipPackageJson;
    if (skipPackageJson && config?.get(CONFIG.SKIP_ANDROID) && config?.get(CONFIG.SKIP_IOS)) {
        vscode.window.showWarningMessage(
            'All platforms are disabled. Enable at least one platform or choose to update package.json.'
        );
        return;
    }

    await executeAndShowResults(
        rootPath,
        bumpType.value as BumpType,
        withGit,
        customVersions,
        packageBumpType.bumpType,
        packageBumpType.customVersion,
        context,
        false,
        packageBumpType.skipPackageJson
    );
}

async function handleSyncOperation(
    rootPath: string,
    versions: ProjectVersions,
    isExpo: boolean,
    hasAndroid: boolean,
    hasIOS: boolean,
    withGit: boolean,
    context?: vscode.ExtensionContext,
    config?: vscode.WorkspaceConfiguration
) {
    const availableVersions: string[] = [];
    if (versions.packageJson && !config?.get(CONFIG.SKIP_PACKAGE_JSON)) {
        availableVersions.push(versions.packageJson);
    }
    const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);

    if (isExpo && versions.expo) {
        availableVersions.push(versions.expo.version);

        if (syncNativeFiles) {
            if (versions.android && hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
                availableVersions.push(versions.android.versionName);
            }
            if (versions.ios && hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
                availableVersions.push(versions.ios.version);
            }
        }
    } else {
        if (versions.android && hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
            availableVersions.push(versions.android.versionName);
        }
        if (versions.ios && hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
            availableVersions.push(versions.ios.version);
        }
    }

    const uniqueVersions = [...new Set(availableVersions)];
    if (uniqueVersions.length === 1 && availableVersions.length > 1) {
        vscode.window.showInformationMessage(
            `All platforms are already synced to version ${uniqueVersions[0]}!\n\n` +
                `Package.json: ${versions.packageJson || DEFAULT_VALUES.NOT_AVAILABLE}\n` +
                `Android: ${versions.android?.versionName || DEFAULT_VALUES.NOT_AVAILABLE}\n` +
                `iOS: ${versions.ios?.version || DEFAULT_VALUES.NOT_AVAILABLE}`
        );
        return;
    }

    const syncOptions = buildSyncOptions(versions, isExpo, hasAndroid, hasIOS, config);
    if (syncOptions.length === 1) {
        vscode.window.showWarningMessage(
            'Only custom version option available. All platforms seem to have the same version or are disabled.'
        );
    }

    const selectedOption = await vscode.window.showQuickPick(syncOptions, {
        placeHolder: 'Select version to sync all platforms to (or enter custom version)',
        matchOnDescription: true,
    });

    if (!selectedOption) {
        return;
    }

    const targetVersion = await getTargetVersion(selectedOption, versions);
    if (!targetVersion) {
        return;
    }

    const batchMode = config?.get(CONFIG.BATCH_MODE, true);
    if (!batchMode) {
        const syncDetails = buildSyncDetails(versions, targetVersion, isExpo, hasAndroid, hasIOS, config);
        const confirmMessage = `Sync all platforms to version ${targetVersion}?\n\n${syncDetails.join('\n')}`;
        const confirmed = await vscode.window.showInformationMessage(
            confirmMessage,
            { modal: true },
            'Yes, Sync All',
            'Cancel'
        );
        if (confirmed !== 'Yes, Sync All') {
            return;
        }
    }

    const customVersions = {
        android: (!isExpo || syncNativeFiles) && versions.android ? { version: targetVersion } : undefined,
        ios: (!isExpo || syncNativeFiles) && versions.ios ? { version: targetVersion } : undefined,
        expo: isExpo && versions.expo ? { version: targetVersion } : undefined,
        packageJson: versions.packageJson ? targetVersion : undefined,
    };

    await executeAndShowResults(
        rootPath,
        BumpType.PATCH,
        withGit,
        customVersions,
        undefined,
        undefined,
        context,
        true,
        false
    );
}

async function getCustomVersions(
    versions: ProjectVersions,
    isExpo: boolean,
    hasAndroid: boolean,
    hasIOS: boolean,
    androidVersion: string,
    iosVersion: string,
    expoVersion: string,
    config?: vscode.WorkspaceConfiguration
): Promise<{
    android?: { version: string; buildNumber?: number };
    ios?: { version: string; buildNumber?: number };
    expo?: { version: string };
} | null> {
    const customVersions: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        expo?: { version: string };
    } = {};

    const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);

    if (isExpo && versions.expo) {
        const customExpoVersion = await getCustomVersionForPlatform('Expo', expoVersion);
        if (customExpoVersion === null) {
            return null;
        }

        customVersions.expo = {
            version: customExpoVersion,
        };

        let shouldSyncNative = syncNativeFiles;

        if (!syncNativeFiles && (hasAndroid || hasIOS)) {
            const nativePlatforms: string[] = [];
            if (hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
                nativePlatforms.push('Android');
            }
            if (hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
                nativePlatforms.push('iOS');
            }

            if (nativePlatforms.length > 0) {
                const syncChoice = await vscode.window.showQuickPick(
                    [
                        {
                            label: 'Yes, sync to native files',
                            value: true,
                            description: `Update ${nativePlatforms.join(' and ')} native files with Expo version`,
                        },
                        {
                            label: 'No, Expo only',
                            value: false,
                            description: 'Only update app.json, skip native files',
                        },
                    ],
                    {
                        placeHolder: `Sync Expo version to ${nativePlatforms.join(' and ')} native files?`,
                    }
                );

                if (syncChoice === undefined) {
                    return null;
                }

                shouldSyncNative = syncChoice.value;
            }
        }

        if (shouldSyncNative) {
            if (!config?.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions?.android) {
                customVersions.android = {
                    version: customExpoVersion,
                    buildNumber: versions.expo.androidVersionCode
                        ? versions.expo.androidVersionCode + 1
                        : versions.android.versionCode + 1,
                };
            }

            if (!config?.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
                customVersions.ios = {
                    version: customExpoVersion,
                    buildNumber: versions.expo.iosBuildNumber
                        ? parseInt(versions.expo.iosBuildNumber) + 1
                        : parseInt(versions.ios.buildNumber) + 1,
                };
            }
        }
    } else {
        if (!config?.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions?.android) {
            const customAndroidVersion = await getCustomVersionForPlatform('Android', androidVersion);
            if (customAndroidVersion === null) {
                return null;
            }

            const customAndroidBuildNumber = await getCustomBuildNumber('Android', versions.android.versionCode);
            if (customAndroidBuildNumber === null) {
                return null;
            }

            customVersions.android = {
                version: customAndroidVersion,
                buildNumber: customAndroidBuildNumber,
            };
        }

        if (!config?.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
            const customIOSVersion = await getCustomVersionForPlatform('iOS', iosVersion);
            if (customIOSVersion === null) {
                return null;
            }

            const customIOSBuildNumber = await getCustomBuildNumber('iOS', versions.ios.buildNumber);
            if (customIOSBuildNumber === null) {
                return null;
            }

            customVersions.ios = {
                version: customIOSVersion,
                buildNumber: customIOSBuildNumber,
            };
        }
    }

    return customVersions;
}

async function getPackageJsonBumpType(
    versions: ProjectVersions,
    packageJsonVersion: string,
    config?: vscode.WorkspaceConfiguration
): Promise<{ bumpType: BumpType; customVersion?: string; skipPackageJson: boolean } | null> {
    if (config?.get(CONFIG.SKIP_PACKAGE_JSON) || !versions.packageJson) {
        return { bumpType: BumpType.PATCH, customVersion: undefined, skipPackageJson: true };
    }

    const packageBumpTypeSelection = await vscode.window.showQuickPick(
        [
            { label: `Patch (v${bumpSemanticVersion(packageJsonVersion, BumpType.PATCH)})`, value: BumpType.PATCH },
            { label: `Minor (v${bumpSemanticVersion(packageJsonVersion, BumpType.MINOR)})`, value: BumpType.MINOR },
            { label: `Major (v${bumpSemanticVersion(packageJsonVersion, BumpType.MAJOR)})`, value: BumpType.MAJOR },
            {
                label: 'Custom',
                value: BumpType.CUSTOM,
                description: `Current: v${packageJsonVersion} → Set custom version`,
            },
            {
                label: 'Skip',
                value: 'SKIP',
                description: 'Do not update package.json',
            },
        ],
        { placeHolder: 'Choose package.json version increment type' }
    );

    if (!packageBumpTypeSelection) {
        return null;
    }

    if (packageBumpTypeSelection.value === 'SKIP') {
        return { bumpType: BumpType.PATCH, customVersion: undefined, skipPackageJson: true };
    }

    if (packageBumpTypeSelection.value === BumpType.CUSTOM) {
        const customPackageJsonVersion = await getCustomVersionForPlatform('package.json', packageJsonVersion);
        if (customPackageJsonVersion === null) {
            return null;
        }
        return { bumpType: BumpType.CUSTOM, customVersion: customPackageJsonVersion, skipPackageJson: false };
    }

    return { bumpType: packageBumpTypeSelection.value as BumpType, customVersion: undefined, skipPackageJson: false };
}

function buildSyncOptions(
    versions: ProjectVersions,
    isExpo: boolean,
    hasAndroid: boolean,
    hasIOS: boolean,
    config?: vscode.WorkspaceConfiguration
): SyncOption[] {
    const syncOptions: SyncOption[] = [];

    if (versions.packageJson && !config?.get(CONFIG.SKIP_PACKAGE_JSON)) {
        syncOptions.push({
            label: `Use package.json version: ${versions.packageJson}`,
            description: 'Sync all platforms to match package.json version',
            version: versions.packageJson,
            source: SyncSource.PACKAGE_JSON,
        });
    }

    if (isExpo && versions.expo) {
        const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);
        syncOptions.push({
            label: `Use Expo version: ${versions.expo.version}`,
            description: syncNativeFiles
                ? 'Sync all platforms to match Expo version (will sync Android/iOS native files)'
                : 'Sync all platforms to match Expo version',
            version: versions.expo.version,
            source: SyncSource.EXPO,
        });
    } else {
        if (versions.android && hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
            syncOptions.push({
                label: `Use Android version: ${versions.android.versionName}`,
                description: 'Sync all platforms to match Android versionName',
                version: versions.android.versionName,
                source: SyncSource.ANDROID,
            });
        }

        if (versions.ios && hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
            syncOptions.push({
                label: `Use iOS version: ${versions.ios.version}`,
                description: 'Sync all platforms to match iOS version',
                version: versions.ios.version,
                source: SyncSource.IOS,
            });
        }
    }

    syncOptions.push({
        label: 'Enter custom version',
        description: 'Specify a new version for all platforms',
        version: '',
        source: SyncSource.CUSTOM,
    });

    return syncOptions;
}

async function getTargetVersion(selectedOption: SyncOption, versions: ProjectVersions): Promise<string | null> {
    if (selectedOption.source !== SyncSource.CUSTOM) {
        return selectedOption.version;
    }

    const currentVersions = [versions.packageJson, versions.android?.versionName, versions.ios?.version].filter(
        Boolean
    );
    const suggestedVersion =
        currentVersions.length > 0 ? getHighestVersion(currentVersions as string[]) : DEFAULT_VALUES.SEMANTIC_VERSION;

    const result = await vscode.window.showInputBox({
        prompt: 'Enter version to sync all platforms (e.g., 1.2.3)',
        value: suggestedVersion,
        validateInput: (value) => {
            if (!value) {
                return 'Version cannot be empty';
            }
            if (!REGEX_PATTERNS.SEMANTIC_VERSION.test(value)) {
                return 'Version must be in format x.y.z (e.g., 1.2.3)';
            }
            return null;
        },
    });

    return result ?? null;
}

function buildSyncDetails(
    versions: ProjectVersions,
    targetVersion: string,
    isExpo: boolean,
    hasAndroid: boolean,
    hasIOS: boolean,
    config?: vscode.WorkspaceConfiguration
): string[] {
    const syncDetails: string[] = [];

    if (versions.packageJson && !config?.get(CONFIG.SKIP_PACKAGE_JSON)) {
        if (versions.packageJson !== targetVersion) {
            syncDetails.push(`package.json: ${versions.packageJson} → ${targetVersion}`);
        } else {
            syncDetails.push(`package.json: ${targetVersion} (no change)`);
        }
    }

    const syncNativeFiles = config?.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);

    if (isExpo && versions.expo) {
        if (versions.expo.version !== targetVersion) {
            syncDetails.push(`Expo: ${versions.expo.version} → ${targetVersion}`);
        } else {
            syncDetails.push(`Expo: ${targetVersion} (no change)`);
        }

        if (syncNativeFiles) {
            if (versions.android && hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
                const newBuildNumber = versions.expo.androidVersionCode
                    ? versions.expo.androidVersionCode + 1
                    : versions.android.versionCode + 1;
                syncDetails.push(
                    `Android: ${versions.android.versionName} → ${targetVersion} (synced from Expo, build: ${versions.android.versionCode} → ${newBuildNumber})`
                );
            }

            if (versions.ios && hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
                const newBuildNumber = versions.expo.iosBuildNumber
                    ? parseInt(versions.expo.iosBuildNumber) + 1
                    : parseInt(versions.ios.buildNumber) + 1;
                syncDetails.push(
                    `iOS: ${versions.ios.version} → ${targetVersion} (synced from Expo, build: ${versions.ios.buildNumber} → ${newBuildNumber})`
                );
            }
        }
    } else {
        if (versions.android && hasAndroid && !config?.get(CONFIG.SKIP_ANDROID)) {
            if (versions.android.versionName !== targetVersion) {
                syncDetails.push(
                    `Android: ${versions.android.versionName} → ${targetVersion} (build: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
                );
            } else {
                syncDetails.push(
                    `Android: ${targetVersion} (build will increment: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
                );
            }
        }

        if (versions.ios && hasIOS && !config?.get(CONFIG.SKIP_IOS)) {
            if (versions.ios.version !== targetVersion) {
                syncDetails.push(
                    `iOS: ${versions.ios.version} → ${targetVersion} (build: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
                );
            } else {
                syncDetails.push(
                    `iOS: ${targetVersion} (build will increment: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
                );
            }
        }
    }

    return syncDetails;
}

async function executeAndShowResults(
    rootPath: string,
    bumpType: BumpType,
    withGit: boolean,
    customVersions?: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        expo?: { version: string };
        packageJson?: string;
    },
    packageBumpType?: BumpType,
    customPackageJsonVersion?: string,
    context?: vscode.ExtensionContext,
    isSync: boolean = false,
    skipPackageJson: boolean = false
) {
    const finalCustomVersions = customVersions
        ? {
              ...customVersions,
              packageJson: customPackageJsonVersion ?? customVersions.packageJson,
          }
        : undefined;

    const { results, gitWorkflowResult } = await executeVersionOperations({
        rootPath,
        bumpType,
        withGit,
        customVersions: finalCustomVersions,
        packageBumpType,
        isSync,
        skipPackageJson,
    });

    const hasSuccessfulOperations = results.some((result: BumpResult) => result.success);
    if (hasSuccessfulOperations) {
        await showBumpResults(bumpType, results, context, gitWorkflowResult);
        updateStatusBar();
    } else if (results.length > 0) {
        const errorMessages = results
            .filter((r: BumpResult) => !r.success)
            .map((r: BumpResult) => `${r.platform}: ${r.error || r.message}`)
            .join('\n');
        const operation = isSync ? 'Sync operation' : 'Operation';
        vscode.window.showErrorMessage(`${operation} failed:\n${errorMessages}`);
    }
}
