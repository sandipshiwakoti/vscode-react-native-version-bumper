import * as vscode from 'vscode';

import { CONFIG, EXTENSION_ID, PROGRESS_INCREMENTS } from '../constants';
import {
    BatchExecutionPlan,
    BatchOperation,
    BumpResult,
    BumpType,
    ExecutionOptions,
    GitAction,
    GitWorkflowResult,
    OperationType,
    Platform,
    PlatformType,
    ProjectVersions,
} from '../types';
import { detectProjectType, hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { bumpSemanticVersion, getCurrentVersions } from '../utils/versionUtils';

import { collectGitConfiguration, executeGitOperationsWithProgress, executeGitWorkflow } from './gitService';
import { updatePlatformVersion } from './platformService';
import { showBatchPreview } from './previewService';

export async function createBatchExecutionPlan(
    rootPath: string,
    bumpType: BumpType,
    withGit: boolean,
    customVersions?: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        packageJson?: string;
    },
    isSync: boolean = false,
    skipPackageJson: boolean = false,
    packageBumpType?: BumpType
): Promise<BatchExecutionPlan> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const operations: BatchOperation[] = [];
    const versions = await getCurrentVersions();

    if (!config.get(CONFIG.SKIP_PACKAGE_JSON) && !skipPackageJson && versions.packageJson) {
        const oldVersion = versions.packageJson;
        let newVersion: string;

        if (customVersions?.packageJson) {
            newVersion = customVersions.packageJson;
        } else if (isSync) {
            newVersion = customVersions?.packageJson || oldVersion;
        } else {
            newVersion = bumpSemanticVersion(oldVersion, packageBumpType ?? bumpType);
        }

        if (oldVersion !== newVersion || !isSync) {
            operations.push({
                type: OperationType.VERSION,
                platform: Platform.PACKAGE_JSON,
                action: isSync ? 'Sync version' : 'Update version',
                oldValue: oldVersion,
                newValue: newVersion,
                description: `package.json: ${oldVersion} → ${newVersion}`,
            });
        }
    }

    if (!config.get(CONFIG.SKIP_ANDROID) && versions.android) {
        const oldVersion = versions.android.versionName;
        const oldBuildNumber = versions.android.versionCode;
        let newVersion: string;
        let newBuildNumber: number;

        if (customVersions?.android) {
            newVersion = customVersions.android.version;
            newBuildNumber = customVersions.android.buildNumber ?? (isSync ? oldBuildNumber + 1 : oldBuildNumber + 1);
        } else if (isSync) {
            newVersion = customVersions?.android?.version || oldVersion;
            newBuildNumber = oldBuildNumber + 1;
        } else {
            newVersion = bumpSemanticVersion(oldVersion, bumpType);
            newBuildNumber = oldBuildNumber + 1;
        }

        operations.push({
            type: OperationType.VERSION,
            platform: Platform.ANDROID,
            action: isSync ? 'Sync version and increment build' : 'Update version and build number',
            oldValue: `${oldVersion} (${oldBuildNumber})`,
            newValue: `${newVersion} (${newBuildNumber})`,
            description: `Android: ${oldVersion} (${oldBuildNumber}) → ${newVersion} (${newBuildNumber})`,
        });
    }

    if (!config.get(CONFIG.SKIP_IOS) && versions.ios) {
        const oldVersion = versions.ios.version;
        const oldBuildNumber = versions.ios.buildNumber;
        let newVersion: string;
        let newBuildNumber: number;

        if (customVersions?.ios) {
            newVersion = customVersions.ios.version;
            newBuildNumber =
                customVersions.ios.buildNumber ??
                (isSync ? parseInt(oldBuildNumber) + 1 : parseInt(oldBuildNumber) + 1);
        } else if (isSync) {
            newVersion = customVersions?.ios?.version || oldVersion;
            newBuildNumber = parseInt(oldBuildNumber) + 1;
        } else {
            newVersion = bumpSemanticVersion(oldVersion, bumpType);
            newBuildNumber = parseInt(oldBuildNumber) + 1;
        }

        operations.push({
            type: OperationType.VERSION,
            platform: Platform.IOS,
            action: isSync ? 'Sync version and increment build' : 'Update version and build number',
            oldValue: `${oldVersion} (${oldBuildNumber})`,
            newValue: `${newVersion} (${newBuildNumber.toString()})`,
            description: `iOS: ${oldVersion} (${oldBuildNumber}) → ${newVersion} (${newBuildNumber})`,
        });
    }

    const versionOpsCount = operations.filter((op) => op.type === 'version').length;
    const summary = `${versionOpsCount} version update${versionOpsCount !== 1 ? 's' : ''}`;

    return {
        operations,
        summary,
    };
}

export async function executeBatchOperations(
    rootPath: string,
    plan: BatchExecutionPlan,
    bumpType: BumpType,
    customVersions?: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        packageJson?: string;
    },
    isSync: boolean = false,
    packageBumpType?: BumpType
): Promise<{ results: BumpResult[]; gitWorkflowResult?: GitWorkflowResult }> {
    const results: BumpResult[] = [];
    const versions = await getCurrentVersions();

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Executing batch operations...',
            cancellable: false,
        },
        async (progress) => {
            const versionOps = plan.operations.filter((op) => op.type === 'version');
            const totalOps = plan.operations.length;
            let completedOps = 0;

            for (const op of versionOps) {
                progress.report({
                    increment: 100 / totalOps,
                    message: `[${completedOps + 1}/${totalOps}] ${op.action} ${op.platform}...`,
                });

                try {
                    let result: BumpResult;

                    switch (op.platform) {
                        case Platform.PACKAGE_JSON:
                            result = await updatePlatformVersion({
                                type: PlatformType.PACKAGE,
                                rootPath,
                                targetVersion: customVersions?.packageJson,
                                bumpType: customVersions?.packageJson ? undefined : (packageBumpType ?? bumpType),
                            });
                            break;

                        case Platform.ANDROID:
                            result = await updatePlatformVersion({
                                type: PlatformType.ANDROID,
                                rootPath,
                                targetVersion:
                                    isSync || customVersions?.android
                                        ? customVersions?.android?.version || versions.android!.versionName
                                        : undefined,
                                buildNumber: customVersions?.android?.buildNumber,
                                bumpType: isSync || customVersions?.android ? undefined : bumpType,
                            });
                            break;

                        case Platform.IOS:
                            result = await updatePlatformVersion({
                                type: PlatformType.IOS,
                                rootPath,
                                targetVersion:
                                    isSync || customVersions?.ios
                                        ? customVersions?.ios?.version || versions.ios!.version
                                        : undefined,
                                buildNumber: customVersions?.ios?.buildNumber,
                                bumpType: isSync || customVersions?.ios ? undefined : bumpType,
                            });
                            break;

                        default:
                            result = {
                                platform: op.platform,
                                success: false,
                                oldVersion: op.oldValue,
                                newVersion: op.newValue,
                                message: `Unknown platform: ${op.platform}`,
                            };
                    }

                    results.push(result);
                    completedOps++;

                    await new Promise((resolve) => setTimeout(resolve, 200));
                    progress.report({
                        message: `[${completedOps}/${totalOps}] ${result.success ? '✅' : '❌'} ${op.platform}`,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    const result = {
                        platform: op.platform,
                        success: false,
                        oldVersion: op.oldValue,
                        newVersion: op.newValue,
                        message: `${op.action} failed`,
                        error: errorMessage,
                    };
                    results.push(result);
                    completedOps++;

                    await new Promise((resolve) => setTimeout(resolve, 200));
                    progress.report({
                        message: `[${completedOps}/${totalOps}] ❌ ${op.platform}`,
                    });
                }

                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            return { results };
        }
    );
}

export async function executeVersionOperations(
    options: ExecutionOptions
): Promise<{ results: BumpResult[]; gitWorkflowResult?: GitWorkflowResult }> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const batchMode = config.get(CONFIG.BATCH_MODE, true);

    if (batchMode) {
        return await executeBatchMode(options);
    } else {
        return await executeNormalMode(options);
    }
}

async function executeBatchMode(
    options: ExecutionOptions
): Promise<{ results: BumpResult[]; gitWorkflowResult?: GitWorkflowResult }> {
    const plan = await createBatchExecutionPlan(
        options.rootPath,
        options.bumpType,
        options.withGit,
        options.customVersions,
        options.isSync || false,
        options.skipPackageJson || false,
        options.packageBumpType
    );

    let gitConfig;
    if (options.withGit) {
        gitConfig = await collectGitConfiguration(options.rootPath, options.bumpType, plan.operations);
        if (gitConfig) {
            if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
                plan.operations.push({
                    type: OperationType.GIT,
                    platform: Platform.GIT,
                    action: GitAction.CREATE_BRANCH,
                    oldValue: 'current branch',
                    newValue: gitConfig.branchName,
                    description: `Create branch: ${gitConfig.branchName}`,
                });
            }

            plan.operations.push({
                type: OperationType.GIT,
                platform: Platform.GIT,
                action: GitAction.COMMIT_CHANGES,
                oldValue: '',
                newValue: gitConfig.commitMessage,
                description: `Commit: "${gitConfig.commitMessage}"`,
            });

            if (gitConfig.shouldTag && gitConfig.tagName) {
                plan.operations.push({
                    type: OperationType.GIT,
                    platform: Platform.GIT,
                    action: GitAction.CREATE_TAG,
                    oldValue: '',
                    newValue: gitConfig.tagName,
                    description: `Tag: ${gitConfig.tagName}`,
                });
            }

            if (gitConfig.shouldPush) {
                plan.operations.push({
                    type: OperationType.GIT,
                    platform: Platform.GIT,
                    action: GitAction.PUSH_TO_REMOTE,
                    oldValue: '',
                    newValue: 'origin',
                    description: `Push changes to remote repository`,
                });
            }
        }

        const versionOpsCount = plan.operations.filter((op) => op.type === 'version').length;
        const gitOpsCount = plan.operations.filter((op) => op.type === 'git').length;
        plan.summary = `${versionOpsCount} version update${versionOpsCount !== 1 ? 's' : ''}${gitOpsCount > 0 ? ` + ${gitOpsCount} Git operation${gitOpsCount !== 1 ? 's' : ''}` : ''}`;
    }

    const confirmed = await showBatchPreview(plan);
    if (!confirmed) {
        return { results: [] };
    }

    const batchResult = await executeBatchOperations(
        options.rootPath,
        plan,
        options.bumpType,
        options.customVersions,
        options.isSync || false,
        options.packageBumpType
    );

    if (gitConfig) {
        const gitOps = plan.operations.filter((op) => op.type === 'git');
        const gitWorkflowResult = await executeGitOperationsWithProgress(
            options.rootPath,
            options.bumpType,
            batchResult.results,
            gitConfig,
            gitOps,
            plan.operations.length
        );
        return { ...batchResult, gitWorkflowResult };
    }

    return batchResult;
}

async function executeNormalMode(
    options: ExecutionOptions
): Promise<{ results: BumpResult[]; gitWorkflowResult?: GitWorkflowResult }> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const results: BumpResult[] = [];
    const versions = await getCurrentVersions();
    const projectType = await detectProjectType(options.rootPath);
    const hasAndroid = hasAndroidProject(options.rootPath);
    const hasIOS = hasIOSProject(options.rootPath);

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title:
                options.bumpType === 'custom'
                    ? 'Applying custom versions...'
                    : `Bumping ${options.bumpType} version...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: PROGRESS_INCREMENTS.START });
            const tasks: Promise<BumpResult>[] = [];

            await executeVersionTasks(options, tasks, versions, projectType, hasAndroid, hasIOS, config);

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

            let gitWorkflowResult: GitWorkflowResult | undefined;
            if (options.withGit && tasks.length > 0) {
                try {
                    gitWorkflowResult = await executeGitWorkflow(options.rootPath, options.bumpType, results);
                    progress.report({ increment: PROGRESS_INCREMENTS.GIT_COMPLETED });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: Platform.GIT,
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: '',
                        error: errorMessage,
                    });
                }
            }

            progress.report({ increment: PROGRESS_INCREMENTS.FINISHED });
            return { results, gitWorkflowResult };
        }
    );
}

async function executeVersionTasks(
    options: ExecutionOptions,
    tasks: Promise<BumpResult>[],
    versions: ProjectVersions,
    projectType: string,
    hasAndroid: boolean,
    hasIOS: boolean,
    config: vscode.WorkspaceConfiguration
): Promise<void> {
    if (!config.get(CONFIG.SKIP_PACKAGE_JSON) && !options.skipPackageJson && versions.packageJson) {
        try {
            const targetVersion =
                options.customVersions?.packageJson || (options.isSync ? versions.packageJson : undefined);

            tasks.push(
                updatePlatformVersion({
                    type: PlatformType.PACKAGE,
                    rootPath: options.rootPath,
                    targetVersion,
                    bumpType: targetVersion ? undefined : (options.packageBumpType ?? options.bumpType),
                })
            );
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            tasks.push(
                Promise.resolve({
                    platform: Platform.PACKAGE_JSON,
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: 'Package.json operation failed',
                    error: errorMessage,
                })
            );
        }
    }

    switch (projectType) {
        case 'react-native':
            if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroid && versions.android) {
                const targetVersion = options.isSync
                    ? options.customVersions?.android?.version || versions.android.versionName
                    : options.customVersions?.android?.version;

                tasks.push(
                    updatePlatformVersion({
                        type: PlatformType.ANDROID,
                        rootPath: options.rootPath,
                        targetVersion,
                        buildNumber: options.customVersions?.android?.buildNumber,
                        bumpType: targetVersion ? undefined : options.bumpType,
                    })
                );
            }

            if (!config.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
                const targetVersion = options.isSync
                    ? options.customVersions?.ios?.version || versions.ios.version
                    : options.customVersions?.ios?.version;

                tasks.push(
                    updatePlatformVersion({
                        type: PlatformType.IOS,
                        rootPath: options.rootPath,
                        targetVersion,
                        buildNumber: options.customVersions?.ios?.buildNumber,
                        bumpType: targetVersion ? undefined : options.bumpType,
                    })
                );
            }
            break;

        case 'unknown':
            tasks.push(
                Promise.resolve({
                    platform: 'Project Detection',
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: 'No React Native project detected. Android or iOS folders not found.',
                })
            );
            break;

        default:
            tasks.push(
                Promise.resolve({
                    platform: 'Unknown',
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: `Unsupported project type: ${projectType}`,
                })
            );
    }
}
