import * as vscode from 'vscode';

import { BUMP_TYPE_LABELS, CONFIG, DEFAULT_VALUES, EXTENSION_ID, PROGRESS_INCREMENTS } from '../constants';
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
                label: `${BUMP_TYPE_LABELS.PATCH.ICON} ${BUMP_TYPE_LABELS.PATCH.LABEL} (${getPlatformLabel(BumpType.PATCH)})`,
                value: BumpType.PATCH,
            },
            {
                label: `${BUMP_TYPE_LABELS.MINOR.ICON} ${BUMP_TYPE_LABELS.MINOR.LABEL} (${getPlatformLabel(BumpType.MINOR)})`,
                value: BumpType.MINOR,
            },
            {
                label: `${BUMP_TYPE_LABELS.MAJOR.ICON} ${BUMP_TYPE_LABELS.MAJOR.LABEL} (${getPlatformLabel(BumpType.MAJOR)})`,
                value: BumpType.MAJOR,
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

    let includePackageJson = true;
    let packageBumpType: BumpType = bumpType.value as BumpType;

    if (config.get(CONFIG.SKIP_PACKAGE_JSON)) {
        includePackageJson = false;
    } else if (versions.packageJson) {
        const packageBumpTypeSelection = await vscode.window.showQuickPick(
            [
                {
                    label: `${BUMP_TYPE_LABELS.PATCH.ICON} ${BUMP_TYPE_LABELS.PATCH.LABEL} (v${bumpSemanticVersion(packageJsonVersion, BumpType.PATCH)})`,
                    value: BumpType.PATCH,
                },
                {
                    label: `${BUMP_TYPE_LABELS.MINOR.ICON} ${BUMP_TYPE_LABELS.MINOR.LABEL} (v${bumpSemanticVersion(packageJsonVersion, BumpType.MINOR)})`,
                    value: BumpType.MINOR,
                },
                {
                    label: `${BUMP_TYPE_LABELS.MAJOR.ICON} ${BUMP_TYPE_LABELS.MAJOR.LABEL} (v${bumpSemanticVersion(packageJsonVersion, BumpType.MAJOR)})`,
                    value: BumpType.MAJOR,
                },
            ],
            { placeHolder: 'Choose package.json version increment type' }
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

    if (config.get(CONFIG.SKIP_PACKAGE_JSON) && config.get(CONFIG.SKIP_ANDROID) && config.get(CONFIG.SKIP_IOS)) {
        vscode.window.showWarningMessage(
            'All platforms are disabled in settings. Enable at least one platform:\n• reactNativeVersionBumper.skipPackageJson\n• reactNativeVersionBumper.skipAndroid\n• reactNativeVersionBumper.skipIOS'
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
            progress.report({ increment: PROGRESS_INCREMENTS.START });
            const tasks: Promise<BumpResult>[] = [];

            if (includePackageJson && !config.get(CONFIG.SKIP_PACKAGE_JSON)) {
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
                    if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroid) {
                        tasks.push(bumpAndroidVersion(rootPath, type));
                    }
                    if (!config.get(CONFIG.SKIP_IOS) && hasIOS) {
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

            progress.report({ increment: PROGRESS_INCREMENTS.TASKS_PREPARED });
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
                increment: Math.min(
                    PROGRESS_INCREMENTS.TASKS_COMPLETED_MAX * (completedTasks / totalTasks),
                    PROGRESS_INCREMENTS.TASKS_COMPLETED_MAX
                ),
            });

            if (withGit && tasks.length > 0) {
                try {
                    await executeGitWorkflow(rootPath, type, results);
                    progress.report({ increment: PROGRESS_INCREMENTS.GIT_COMPLETED });
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

            progress.report({ increment: PROGRESS_INCREMENTS.FINISHED });

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
