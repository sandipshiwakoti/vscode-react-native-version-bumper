import * as vscode from 'vscode';

import { CONFIG, DEFAULT_VALUES, EXTENSION_ID, PROGRESS_INCREMENTS, REGEX_PATTERNS } from '../constants';
import { BumpResult, BumpType, SyncOption } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { syncAndroidVersion } from '../utils/androidUtils';
import { hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { executeGitWorkflow } from '../utils/gitUtils';
import { syncIOSVersion } from '../utils/iosUtils';
import { syncPackageJsonVersion } from '../utils/packageUtils';
import { updateStatusBar } from '../utils/statusBarUtils';
import { getCurrentVersions, getHighestVersion } from '../utils/versionUtils';

export async function bumpSyncVersion(withGit: boolean) {
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
            'No React Native projects found. This extension requires at least one React Native platform (android/ or ios/ folder) to be present.'
        );
        return;
    }

    try {
        const versions = await getCurrentVersions();

        const availableVersions: string[] = [];
        if (versions.packageJson && !config.get(CONFIG.SKIP_PACKAGE_JSON)) {
            availableVersions.push(versions.packageJson);
        }
        if (versions.android && hasAndroid && !config.get(CONFIG.SKIP_ANDROID)) {
            availableVersions.push(versions.android.versionName);
        }
        if (versions.ios && hasIOS && !config.get(CONFIG.SKIP_IOS)) {
            availableVersions.push(versions.ios.version);
        }

        const uniqueVersions = [...new Set(availableVersions)];
        if (uniqueVersions.length === 1 && availableVersions.length > 1) {
            vscode.window.showInformationMessage(
                `✅ All platforms are already synced to version ${uniqueVersions[0]}!\n\n` +
                    `📦 Package.json: ${versions.packageJson || DEFAULT_VALUES.NOT_AVAILABLE}\n` +
                    `🤖 Android: ${versions.android?.versionName || DEFAULT_VALUES.NOT_AVAILABLE}\n` +
                    `🍎 iOS: ${versions.ios?.version || DEFAULT_VALUES.NOT_AVAILABLE}`
            );
            return;
        }

        const syncOptions: SyncOption[] = [];

        if (versions.packageJson && !config.get(CONFIG.SKIP_PACKAGE_JSON)) {
            syncOptions.push({
                label: `📦 Use package.json version: ${versions.packageJson}`,
                description: 'Sync all platforms to match package.json version',
                version: versions.packageJson,
                source: 'package.json',
            });
        }

        if (versions.android && hasAndroid && !config.get(CONFIG.SKIP_ANDROID)) {
            syncOptions.push({
                label: `🤖 Use Android version: ${versions.android.versionName}`,
                description: 'Sync all platforms to match Android versionName',
                version: versions.android.versionName,
                source: 'android',
            });
        }

        if (versions.ios && hasIOS && !config.get(CONFIG.SKIP_IOS)) {
            syncOptions.push({
                label: `🍎 Use iOS version: ${versions.ios.version}`,
                description: 'Sync all platforms to match iOS version',
                version: versions.ios.version,
                source: 'ios',
            });
        }

        syncOptions.push({
            label: '✏️ Enter custom version',
            description: 'Specify a new version for all platforms',
            version: '',
            source: 'custom',
        });

        if (syncOptions.length === 1) {
            vscode.window.showWarningMessage(
                'Only custom version option available. All platforms seem to have the same version or are disabled.'
            );
        }

        const selectedOption = await vscode.window.showQuickPick(syncOptions, {
            placeHolder: 'Choose which version to sync all platforms to',
            matchOnDescription: true,
        });

        if (!selectedOption) {
            return;
        }

        let targetVersion = selectedOption.version;

        if (selectedOption.source === 'custom') {
            const currentVersions = [versions.packageJson, versions.android?.versionName, versions.ios?.version].filter(
                Boolean
            );

            const suggestedVersion =
                currentVersions.length > 0
                    ? getHighestVersion(currentVersions as string[])
                    : DEFAULT_VALUES.SEMANTIC_VERSION;

            const customVersion = await vscode.window.showInputBox({
                prompt: 'Enter the version to sync all platforms to',
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

            if (!customVersion) {
                return;
            }

            targetVersion = customVersion;
        }

        const syncDetails: string[] = [];

        if (versions.packageJson && !config.get(CONFIG.SKIP_PACKAGE_JSON)) {
            if (versions.packageJson !== targetVersion) {
                syncDetails.push(`📦 package.json: ${versions.packageJson} → ${targetVersion}`);
            } else {
                syncDetails.push(`📦 package.json: ${targetVersion} (no change)`);
            }
        }

        if (versions.android && hasAndroid && !config.get(CONFIG.SKIP_ANDROID)) {
            if (versions.android.versionName !== targetVersion) {
                syncDetails.push(
                    `🤖 Android: ${versions.android.versionName} → ${targetVersion} (build: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
                );
            } else {
                syncDetails.push(
                    `🤖 Android: ${targetVersion} (build will increment: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
                );
            }
        }

        if (versions.ios && hasIOS && !config.get(CONFIG.SKIP_IOS)) {
            if (versions.ios.version !== targetVersion) {
                syncDetails.push(
                    `🍎 iOS: ${versions.ios.version} → ${targetVersion} (build: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
                );
            } else {
                syncDetails.push(
                    `🍎 iOS: ${targetVersion} (build will increment: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
                );
            }
        }

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

        const results: BumpResult[] = [];

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: `Syncing all platforms to version ${targetVersion}...`,
                cancellable: false,
            },
            async (progress) => {
                progress.report({ increment: PROGRESS_INCREMENTS.START });
                const tasks: Promise<BumpResult>[] = [];

                if (versions.packageJson && !config.get(CONFIG.SKIP_PACKAGE_JSON)) {
                    tasks.push(syncPackageJsonVersion(rootPath, targetVersion, versions.packageJson));
                }

                if (hasAndroid && !config.get(CONFIG.SKIP_ANDROID)) {
                    tasks.push(syncAndroidVersion(rootPath, targetVersion, versions.android));
                }

                if (hasIOS && !config.get(CONFIG.SKIP_IOS)) {
                    tasks.push(syncIOSVersion(rootPath, targetVersion, versions.ios));
                }

                progress.report({ increment: PROGRESS_INCREMENTS.TASKS_PREPARED });
                const taskResults = await Promise.allSettled(tasks);
                let completedTasks = 0;

                taskResults.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        results.push(result.value);
                        completedTasks++;
                    } else {
                        results.push({
                            platform: `Sync Task ${index + 1}`,
                            success: false,
                            oldVersion: '',
                            newVersion: targetVersion,
                            message: 'Sync failed',
                            error: result.reason.toString(),
                        });
                    }
                });

                const totalTasks = tasks.length || 1;
                progress.report({
                    increment: Math.min(
                        PROGRESS_INCREMENTS.TASKS_COMPLETED_MAX * (completedTasks / totalTasks),
                        PROGRESS_INCREMENTS.TASKS_COMPLETED_MAX
                    ),
                });

                if (withGit && tasks.length > 0) {
                    try {
                        const syncResults: BumpResult[] = results.map((result) => ({
                            ...result,
                            platform: result.platform === 'Package.json' ? 'Sync' : result.platform,
                            newVersion: targetVersion,
                        }));

                        syncResults.push({
                            platform: 'SyncOperation',
                            success: true,
                            oldVersion: '',
                            newVersion: targetVersion,
                            message: `Sync to version ${targetVersion}`,
                        });

                        await executeGitWorkflow(rootPath, BumpType.PATCH, syncResults);
                        progress.report({ increment: PROGRESS_INCREMENTS.GIT_COMPLETED });
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                        results.push({
                            platform: 'Git',
                            success: false,
                            oldVersion: '',
                            newVersion: targetVersion,
                            message: 'Git sync failed',
                            error: errorMessage,
                        });
                        vscode.window.showErrorMessage(`Git operation failed: ${errorMessage}`);
                    }
                }

                progress.report({ increment: PROGRESS_INCREMENTS.FINISHED });

                const hasSuccessfulOperations = results.some((result) => result.success);
                const hasCompletedTasks = tasks.length > 0 && completedTasks > 0;

                if (hasSuccessfulOperations && hasCompletedTasks) {
                    showBumpResults(BumpType.PATCH, results);
                    updateStatusBar();
                } else if (results.length > 0 && !hasSuccessfulOperations) {
                    const errorMessages = results
                        .filter((r) => !r.success)
                        .map((r) => `${r.platform}: ${r.error || r.message}`)
                        .join('\n');
                    vscode.window.showErrorMessage(`Version sync failed:\n${errorMessages}`);
                }
            }
        );
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to sync versions: ${errorMessage}`);
    }
}
