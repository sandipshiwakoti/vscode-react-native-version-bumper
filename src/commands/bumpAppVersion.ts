import * as vscode from 'vscode';

import { CONFIG_SKIP_ANDROID, CONFIG_SKIP_IOS, CONFIG_SKIP_PACKAGE_JSON, INITIAL_SEMANTIC_VERSION } from '../constants';
import { BumpResult, BumpType } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { bumpAndroidVersion } from '../utils/androidUtils';
import { detectProjectType, hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { executeGitWorkflow } from '../utils/gitUtils';
import { bumpIOSVersion } from '../utils/iosUtils';
import { bumpPackageJsonVersion } from '../utils/packageUtils';
import { updateStatusBar } from '../utils/statusBarUtils';
import { bumpSemanticVersion, getCurrentVersions } from '../utils/versionUtils';

export async function bumpAppVersion(withGit: boolean) {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
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
            'No React Native projects found. Please ensure you have:\n' +
                '• Android: android/app/build.gradle file\n' +
                '• iOS: ios/ folder with Info.plist\n' +
                'At least one platform is required.'
        );
        return;
    }

    const versions = await getCurrentVersions();
    const androidVersion = versions?.android ? versions.android.versionName : INITIAL_SEMANTIC_VERSION;
    const iosVersion = versions.ios ? versions.ios.version : INITIAL_SEMANTIC_VERSION;
    const packageJsonVersion = versions.packageJson || INITIAL_SEMANTIC_VERSION;

    const getPlatformLabel = (bumpType: BumpType) => {
        const platforms: string[] = [];
        if (!config.get(CONFIG_SKIP_ANDROID) && hasAndroid && versions?.android) {
            platforms.push(`Android: v${bumpSemanticVersion(androidVersion, bumpType)}`);
        }
        if (!config.get(CONFIG_SKIP_IOS) && hasIOS && versions.ios) {
            platforms.push(`iOS: v${bumpSemanticVersion(iosVersion, bumpType)}`);
        }
        return platforms.length > 0 ? platforms.join(', ') : 'No platforms available';
    };

    if (getPlatformLabel('patch') === 'No platforms available') {
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
                label: `🔧 Patch (${getPlatformLabel('patch')})`,
                value: 'patch',
            },
            {
                label: `⬆️ Minor (${getPlatformLabel('minor')})`,
                value: 'minor',
            },
            {
                label: `🚀 Major (${getPlatformLabel('major')})`,
                value: 'major',
            },
        ],
        { placeHolder: 'Select version bump type for available platforms' }
    );

    if (!bumpType) {
        return;
    }

    let includePackageJson = true;
    let packageBumpType: BumpType = bumpType.value as BumpType;

    if (config.get(CONFIG_SKIP_PACKAGE_JSON)) {
        includePackageJson = false;
    } else if (versions.packageJson) {
        const packageBumpTypeSelection = await vscode.window.showQuickPick(
            [
                {
                    label: `🔧 Patch (v${bumpSemanticVersion(packageJsonVersion, 'patch')})`,
                    value: 'patch',
                },
                {
                    label: `⬆️ Minor (v${bumpSemanticVersion(packageJsonVersion, 'minor')})`,
                    value: 'minor',
                },
                {
                    label: `🚀 Major (v${bumpSemanticVersion(packageJsonVersion, 'major')})`,
                    value: 'major',
                },
            ],
            { placeHolder: 'Select package.json version bump type' }
        );

        if (packageBumpTypeSelection) {
            packageBumpType = packageBumpTypeSelection.value as BumpType;
        } else {
            return;
        }
    }

    const type = bumpType.value as BumpType;
    const projectType = await detectProjectType(rootPath);
    const results: BumpResult[] = [];

    if (config.get(CONFIG_SKIP_PACKAGE_JSON) && config.get(CONFIG_SKIP_ANDROID) && config.get(CONFIG_SKIP_IOS)) {
        vscode.window.showWarningMessage(
            'All version bump operations (package.json, Android, iOS) are skipped. No changes will be made.'
        );
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Bumping ${type} version...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 0 });
            const tasks: Promise<BumpResult>[] = [];

            if (includePackageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
                try {
                    tasks.push(bumpPackageJsonVersion(rootPath, packageBumpType));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Package.json',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: 'Package.json bumping failed',
                        error: errorMessage,
                    });
                }
            }

            switch (projectType) {
                case 'react-native':
                    if (!config.get(CONFIG_SKIP_ANDROID) && hasAndroid) {
                        tasks.push(bumpAndroidVersion(rootPath, type));
                    }
                    if (!config.get(CONFIG_SKIP_IOS) && hasIOS) {
                        tasks.push(bumpIOSVersion(rootPath, type));
                    }
                    break;
                case 'unknown':
                    results.push({
                        platform: 'Project Detection',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: 'No React Native project detected. Android or iOS folders not found.',
                    });
                    break;
                default:
                    results.push({
                        platform: 'Unknown',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: `Unsupported project type: ${projectType}`,
                    });
            }

            progress.report({ increment: 20 });
            const taskResults = await Promise.allSettled(tasks);
            let completedTasks = 0;

            taskResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                    completedTasks++;
                } else {
                    results.push({
                        platform: `Task ${index + 1}`,
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: '',
                        error: result.reason.toString(),
                    });
                }
            });

            const totalTasks = tasks.length || 1;
            progress.report({
                increment: Math.min(60 * (completedTasks / totalTasks), 60),
            });

            if (withGit && tasks.length > 0) {
                try {
                    await executeGitWorkflow(rootPath, type, results);
                    progress.report({ increment: 90 });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Git',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: '',
                        error: errorMessage,
                    });
                    vscode.window.showErrorMessage(`Git operation failed: ${errorMessage}`);
                }
            } else if (tasks.length === 0) {
                return;
            }

            progress.report({ increment: 100 });

            const hasSuccessfulOperations = results.some((result) => result.success);
            const hasCompletedTasks = tasks.length > 0 && completedTasks > 0;

            if (hasSuccessfulOperations && hasCompletedTasks) {
                showBumpResults(type, results);
                updateStatusBar();
            } else if (results.length > 0 && !hasSuccessfulOperations) {
                const errorMessages = results
                    .filter((r) => !r.success)
                    .map((r) => `${r.platform}: ${r.error || r.message}`)
                    .join('\n');
                vscode.window.showErrorMessage(`Version bump failed:\n${errorMessages}`);
            }
        }
    );
}
