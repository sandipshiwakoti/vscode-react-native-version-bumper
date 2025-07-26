import * as vscode from 'vscode';

import { exec } from 'child_process';
import { promisify } from 'util';

import { CONFIG, EXTENSION_ID, PROGRESS_INCREMENTS, TEMPLATES } from '../constants';
import {
    BatchExecutionPlan,
    BatchGitConfig,
    BatchOperation,
    BumpResult,
    BumpType,
    ExecutionOptions,
    GitWorkflowResult,
    ProjectVersions,
} from '../types';

import {
    bumpAndroidVersion,
    syncAndroidVersion,
    syncAndroidVersionOnly,
    syncAndroidVersionWithBuildNumber,
} from './androidUtils';
import { detectProjectType, hasAndroidProject, hasIOSProject } from './fileUtils';
import { executeGitWorkflow } from './gitUtils';
import { getPlaceholderValues, replacePlaceholders } from './helperUtils';
import { bumpIOSVersion, syncIOSVersion, syncIOSVersionOnly, syncIOSVersionWithBuildNumber } from './iosUtils';
import { bumpPackageJsonVersion, syncPackageJsonVersion } from './packageUtils';
import { bumpSemanticVersion, getCurrentVersions, getLatestGitTagVersion } from './versionUtils';

export async function createBatchExecutionPlan(
    rootPath: string,
    bumpType: BumpType,
    withGit: boolean,
    customVersions?: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        packageJson?: string;
    },
    isSync: boolean = false
): Promise<BatchExecutionPlan> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const operations: BatchOperation[] = [];
    const versions = await getCurrentVersions();

    if (!config.get(CONFIG.SKIP_PACKAGE_JSON) && versions.packageJson) {
        const oldVersion = versions.packageJson;
        let newVersion: string;

        if (customVersions?.packageJson) {
            newVersion = customVersions.packageJson;
        } else if (isSync) {
            newVersion = customVersions?.packageJson || oldVersion;
        } else {
            newVersion = bumpSemanticVersion(oldVersion, bumpType);
        }

        if (oldVersion !== newVersion || !isSync) {
            operations.push({
                type: 'version',
                platform: 'Package.json',
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
            type: 'version',
            platform: 'Android',
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
            type: 'version',
            platform: 'iOS',
            action: isSync ? 'Sync version and increment build' : 'Update version and build number',
            oldValue: `${oldVersion} (${oldBuildNumber})`,
            newValue: `${newVersion} (${newBuildNumber.toString()})`,
            description: `iOS: ${oldVersion} (${oldBuildNumber}) → ${newVersion} (${newBuildNumber})`,
        });
    }

    let gitConfig: BatchGitConfig | undefined;
    if (withGit) {
        gitConfig = await collectGitConfiguration(rootPath, bumpType, operations);
        if (gitConfig) {
            if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
                operations.push({
                    type: 'git',
                    platform: 'Git',
                    action: 'Create branch',
                    oldValue: 'current branch',
                    newValue: gitConfig.branchName,
                    description: `Create branch: ${gitConfig.branchName}`,
                });
            }

            operations.push({
                type: 'git',
                platform: 'Git',
                action: 'Commit changes',
                oldValue: '',
                newValue: gitConfig.commitMessage,
                description: `Commit: "${gitConfig.commitMessage}"`,
            });

            if (gitConfig.shouldTag && gitConfig.tagName) {
                operations.push({
                    type: 'git',
                    platform: 'Git',
                    action: 'Create tag',
                    oldValue: '',
                    newValue: gitConfig.tagName,
                    description: `Tag: ${gitConfig.tagName}`,
                });
            }

            if (gitConfig.shouldPush) {
                operations.push({
                    type: 'git',
                    platform: 'Git',
                    action: 'Push to remote',
                    oldValue: '',
                    newValue: 'origin',
                    description: `Push changes to remote repository`,
                });
            }
        }
    }

    const versionOpsCount = operations.filter((op) => op.type === 'version').length;
    const gitOpsCount = operations.filter((op) => op.type === 'git').length;
    const summary = `${versionOpsCount} version update${versionOpsCount !== 1 ? 's' : ''}${gitOpsCount > 0 ? ` + ${gitOpsCount} Git operation${gitOpsCount !== 1 ? 's' : ''}` : ''}`;

    return {
        operations,
        gitConfig,
        summary,
    };
}

async function collectGitConfiguration(
    rootPath: string,
    bumpType: BumpType,
    operations: BatchOperation[]
): Promise<BatchGitConfig | undefined> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    const skipAndroid = config.get(CONFIG.SKIP_ANDROID, false);
    const skipIOS = config.get(CONFIG.SKIP_IOS, false);
    const skipPackageJson = config.get(CONFIG.SKIP_PACKAGE_JSON, false);

    const versionMap: { [platform: string]: string } = {};
    const buildNumberMap: { [platform: string]: string } = {};

    operations
        .filter((op) => op.type === 'version')
        .forEach((op) => {
            const platformKey = op.platform;
            let semanticVersion = '0.0.0';
            let buildNumber = 'N/A';

            if (op.newValue.includes('(')) {
                const match = op.newValue.match(/^([^\s]+)\s*\((\d+)\)$/);
                if (match) {
                    semanticVersion = match[1];
                    buildNumber = match[2];
                }
            } else {
                semanticVersion = op.newValue;
            }

            versionMap[platformKey] = semanticVersion;
            buildNumberMap[platformKey] = buildNumber;
        });

    const mainVersion = await getLatestGitTagVersion(rootPath);

    const mockResults: BumpResult[] = [];
    operations
        .filter((op) => op.type === 'version')
        .forEach((op) => {
            if (op.platform === 'Android' || op.platform === 'iOS') {
                mockResults.push({
                    platform: op.platform,
                    success: true,
                    oldVersion: op.oldValue,
                    newVersion: op.newValue,
                    message: `Mock result for ${op.platform}`,
                });
            }
        });

    const placeholderValues = getPlaceholderValues(bumpType, mockResults, mainVersion, versionMap, buildNumberMap);

    let shouldCreateBranch = config.get(CONFIG.GIT_AUTO_CREATE_BRANCH, false);
    if (!config.get(CONFIG.GIT_SKIP_BRANCH) && !shouldCreateBranch) {
        const createBranchResponse = await vscode.window.showQuickPick(
            [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
            { placeHolder: 'Create a new branch for version changes? (Useful for pull request workflow)' }
        );
        shouldCreateBranch = createBranchResponse?.value ?? false;
    }

    let branchName: string | undefined;
    if (shouldCreateBranch) {
        let defaultBranchName = TEMPLATES.GIT_BRANCH_PREFIX;

        const isSyncOperation = operations.some((op) => op.action.includes('Sync'));

        if (isSyncOperation) {
            const syncVersion = versionMap['Package.json'] || versionMap['Android'] || versionMap['iOS'] || mainVersion;
            defaultBranchName += `v${syncVersion}`;
        } else {
            if (!skipAndroid && !skipIOS && versionMap['Android'] && versionMap['iOS']) {
                defaultBranchName += `android-v${versionMap['Android']}-ios-v${versionMap['iOS']}`;
            } else if (!skipAndroid && versionMap['Android']) {
                defaultBranchName += `android-v${versionMap['Android']}`;
            } else if (!skipIOS && versionMap['iOS']) {
                defaultBranchName += `ios-v${versionMap['iOS']}`;
            } else if (!skipPackageJson && versionMap['Package.json']) {
                defaultBranchName += `v${versionMap['Package.json']}`;
            } else {
                defaultBranchName += `v${mainVersion}`;
            }
        }

        const branchNameTemplate = config.get(CONFIG.GIT_BRANCH_NAME_TEMPLATE, '');
        let customBranchName = defaultBranchName;
        if (branchNameTemplate) {
            customBranchName = replacePlaceholders(branchNameTemplate, placeholderValues);
            const isValidBranchName =
                customBranchName !== branchNameTemplate &&
                customBranchName !== 'version-bump/' &&
                customBranchName !== '' &&
                !customBranchName.includes('unknown') &&
                (!versionMap['Android'] || skipAndroid || customBranchName.includes(versionMap['Android'])) &&
                (!versionMap['iOS'] || skipIOS || customBranchName.includes(versionMap['iOS'])) &&
                (!versionMap['Package.json'] ||
                    skipPackageJson ||
                    customBranchName.includes(versionMap['Package.json']));
            if (!isValidBranchName) {
                customBranchName = defaultBranchName;
            }
        }

        if (config.get(CONFIG.GIT_AUTO_CREATE_BRANCH)) {
            branchName = customBranchName;
        } else {
            branchName = await vscode.window.showInputBox({
                placeHolder: 'e.g., feature/version-bump-1.2.3',
                prompt: 'Enter branch name for version changes',
                value: customBranchName,
            });
        }

        if (!branchName) {
            return undefined;
        }
    }

    const platforms: string[] = [];
    if (!skipAndroid && versionMap['Android']) {
        platforms.push(`android to v${versionMap['Android']} (${buildNumberMap['Android']})`);
    }
    if (!skipIOS && versionMap['iOS']) {
        platforms.push(`ios to v${versionMap['iOS']} (${buildNumberMap['iOS']})`);
    }
    if (!skipPackageJson && versionMap['Package.json']) {
        platforms.push(`package.json to v${versionMap['Package.json']}`);
    }

    const fallbackCommitMessage =
        platforms.length > 0 ? `chore: bump ${platforms.join(' and ')}` : `chore: bump version to v${mainVersion}`;

    const commitMessageTemplate = config.get(CONFIG.GIT_COMMIT_MESSAGE_TEMPLATE, fallbackCommitMessage);
    const templateCommitMessage = replacePlaceholders(commitMessageTemplate, placeholderValues);

    const commitMessage = await vscode.window.showInputBox({
        placeHolder: 'e.g., chore: bump version to 1.2.3',
        prompt: 'Customize commit message (or press Enter for default)',
        value: templateCommitMessage,
    });

    if (!commitMessage) {
        return undefined;
    }

    let shouldTag = config.get(CONFIG.GIT_AUTO_CREATE_TAG, false);
    if (!config.get(CONFIG.GIT_SKIP_TAG) && !shouldTag) {
        const response = await vscode.window.showQuickPick(
            [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
            { placeHolder: 'Create Git tag for this version? (Essential for releases and deployments)' }
        );
        shouldTag = response?.value ?? false;
    }

    let tagName: string | undefined;
    if (shouldTag) {
        const currentTagVersion = await getLatestGitTagVersion(rootPath);
        const tagBumpType = await vscode.window.showQuickPick(
            [
                {
                    label: `Patch (v${bumpSemanticVersion(currentTagVersion, BumpType.PATCH)})`,
                    value: 'patch',
                },
                {
                    label: `Minor (v${bumpSemanticVersion(currentTagVersion, BumpType.MINOR)})`,
                    value: 'minor',
                },
                {
                    label: `Major (v${bumpSemanticVersion(currentTagVersion, BumpType.MAJOR)})`,
                    value: 'major',
                },
                {
                    label: 'Custom Version',
                    value: 'custom',
                },
            ],
            { placeHolder: 'Select tag version bump type' }
        );

        if (!tagBumpType) {
            return undefined;
        }

        let newTagVersion: string;
        if (tagBumpType.value === 'custom') {
            const customVersion = await vscode.window.showInputBox({
                placeHolder: '1.2.3',
                prompt: 'Enter custom version for Git tag',
                value: currentTagVersion,
                validateInput: (value) => {
                    if (!value) {
                        return 'Version is required';
                    }
                    if (!/^\d+\.\d+\.\d+$/.test(value)) {
                        return 'Version must be in format x.y.z (e.g., 1.2.3)';
                    }
                    return null;
                },
            });

            if (!customVersion) {
                return undefined;
            }
            newTagVersion = customVersion;
        } else {
            newTagVersion = bumpSemanticVersion(currentTagVersion, tagBumpType.value as BumpType);
        }

        const tagNameTemplate = config.get(CONFIG.GIT_TAG_NAME_TEMPLATE, TEMPLATES.GIT_TAG_NAME);
        tagName = replacePlaceholders(tagNameTemplate, {
            ...placeholderValues,
            version: newTagVersion,
        });

        try {
            const execAsync = promisify(exec);
            await execAsync(`git tag -l ${tagName}`, { cwd: rootPath });

            const tagOutput = await execAsync(`git tag -l ${tagName}`, { cwd: rootPath });
            if (tagOutput.stdout.trim() === tagName) {
                const overwrite = await vscode.window.showQuickPick(
                    [
                        { label: 'Yes', value: true },
                        { label: 'No', value: false },
                    ],
                    {
                        placeHolder: `Tag ${tagName} already exists. Overwrite?`,
                    }
                );
                if (!overwrite?.value) {
                    return undefined;
                }
            }
        } catch {}
    }

    let shouldPush = !config.get(CONFIG.GIT_SKIP_PUSH);
    if (shouldPush) {
        const pushResponse = await vscode.window.showQuickPick(
            [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
            { placeHolder: 'Push changes to remote repository? (Share with team and trigger CI/CD)' }
        );
        shouldPush = pushResponse?.value ?? false;
    }

    return {
        shouldCreateBranch,
        branchName,
        commitMessage,
        shouldTag,
        tagName,
        shouldPush,
    };
}

export async function showBatchPreview(plan: BatchExecutionPlan): Promise<boolean> {
    const versionOps = plan.operations.filter((op) => op.type === 'version');
    const gitOps = plan.operations.filter((op) => op.type === 'git');

    let previewMessage = `Review Changes Before Execution\n\n`;
    previewMessage += `The following operations will be performed:\n\n`;

    if (versionOps.length > 0) {
        previewMessage += `File Updates (${versionOps.length}):\n`;
        versionOps.forEach((op, index) => {
            previewMessage += `  ${index + 1}. ${op.description}\n`;
        });
        previewMessage += `\n`;
    }

    if (gitOps.length > 0) {
        previewMessage += `Git Operations (${gitOps.length}):\n`;
        gitOps.forEach((op, index) => {
            previewMessage += `  ${index + 1}. ${op.description}\n`;
        });
        previewMessage += `\n`;
    }

    previewMessage += `All operations will be executed together. You can safely cancel if anything looks incorrect.`;

    const confirmed = await vscode.window.showInformationMessage(
        previewMessage,
        { modal: true },
        'Proceed with Changes'
    );

    return confirmed === 'Proceed with Changes';
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
    isSync: boolean = false
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
                        case 'Package.json':
                            if (customVersions?.packageJson) {
                                result = await syncPackageJsonVersion(
                                    rootPath,
                                    customVersions.packageJson,
                                    versions.packageJson!
                                );
                            } else {
                                result = await bumpPackageJsonVersion(rootPath, bumpType);
                            }
                            break;

                        case 'Android':
                            if (isSync || customVersions?.android) {
                                const targetVersion = customVersions?.android?.version || versions.android!.versionName;
                                if (customVersions?.android?.buildNumber !== undefined) {
                                    result = await syncAndroidVersionWithBuildNumber(
                                        rootPath,
                                        targetVersion,
                                        customVersions.android.buildNumber,
                                        versions.android!
                                    );
                                } else {
                                    result = await syncAndroidVersion(rootPath, targetVersion, versions.android!);
                                }
                            } else {
                                result = await bumpAndroidVersion(rootPath, bumpType);
                            }
                            break;

                        case 'iOS':
                            if (isSync || customVersions?.ios) {
                                const targetVersion = customVersions?.ios?.version || versions.ios!.version;
                                if (customVersions?.ios?.buildNumber !== undefined) {
                                    result = await syncIOSVersionWithBuildNumber(
                                        rootPath,
                                        targetVersion,
                                        customVersions.ios.buildNumber,
                                        versions.ios!
                                    );
                                } else {
                                    result = await syncIOSVersion(rootPath, targetVersion, versions.ios!);
                                }
                            } else {
                                result = await bumpIOSVersion(rootPath, bumpType);
                            }
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
                        message: `[${completedOps}/${totalOps}] ✅ ${op.platform}`,
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: op.platform,
                        success: false,
                        oldVersion: op.oldValue,
                        newVersion: op.newValue,
                        message: `${op.action} failed`,
                        error: errorMessage,
                    });
                    completedOps++;
                }

                await new Promise((resolve) => setTimeout(resolve, 300));
            }

            if (plan.gitConfig) {
                const gitOps = plan.operations.filter((op) => op.type === 'git');
                for (let i = 0; i < gitOps.length; i++) {
                    const op = gitOps[i];
                    progress.report({
                        increment: 100 / totalOps,
                        message: `[${completedOps + 1}/${totalOps}] ${op.action}...`,
                    });

                    completedOps++;
                    await new Promise((resolve) => setTimeout(resolve, 200));
                    progress.report({
                        message: `[${completedOps}/${totalOps}] ✅ ${op.action}`,
                    });
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }

                let gitWorkflowResult: GitWorkflowResult | undefined;
                try {
                    gitWorkflowResult = await executeBatchGitWorkflow(rootPath, bumpType, results, plan.gitConfig);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Git',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: 'Git operations failed',
                        error: errorMessage,
                    });
                }
                return { results, gitWorkflowResult };
            }

            return { results };
        }
    );
}

async function executeBatchGitWorkflow(
    rootPath: string,
    bumpType: BumpType,
    results: BumpResult[],
    gitConfig: BatchGitConfig
): Promise<GitWorkflowResult> {
    const execAsync = promisify(exec);

    try {
        if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
            await execAsync(`git checkout -b "${gitConfig.branchName}"`, { cwd: rootPath });
        }

        await execAsync('git add .', { cwd: rootPath });
        await execAsync(`git commit -m "${gitConfig.commitMessage}"`, { cwd: rootPath });

        if (gitConfig.shouldTag && gitConfig.tagName) {
            try {
                await execAsync(`git tag ${gitConfig.tagName}`, { cwd: rootPath });
            } catch (tagError: unknown) {
                if (tagError instanceof Error && tagError.message.includes('already exists')) {
                    await execAsync(`git tag -d ${gitConfig.tagName}`, { cwd: rootPath });
                    await execAsync(`git tag ${gitConfig.tagName}`, { cwd: rootPath });
                }
            }
        }

        if (gitConfig.shouldPush) {
            if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
                await execAsync(`git push origin "${gitConfig.branchName}"`, { cwd: rootPath });
            } else {
                await execAsync('git push', { cwd: rootPath });
            }

            if (gitConfig.shouldTag && gitConfig.tagName) {
                await execAsync(`git push origin ${gitConfig.tagName}`, { cwd: rootPath });
            }
        }

        let gitMessage = '';
        if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
            gitMessage += `Branch: Created and switched to branch "${gitConfig.branchName}"<br>`;
        }
        gitMessage += `Commit: Changes committed with message: "${gitConfig.commitMessage}"`;
        if (gitConfig.shouldTag && gitConfig.tagName) {
            gitMessage += `<br>Tag: Tagged ${gitConfig.tagName}`;
        }
        if (gitConfig.shouldPush) {
            gitMessage += `<br>Push: Pushed ${gitConfig.shouldCreateBranch ? 'branch and tag' : 'changes and tag'} to remote`;
        }

        results.push({
            platform: 'Git',
            success: true,
            oldVersion: '',
            newVersion: '',
            message: gitMessage,
        });

        return {
            branchCreated: gitConfig.shouldCreateBranch,
            branchName: gitConfig.branchName,
            commitSuccess: true,
            commitMessage: gitConfig.commitMessage,
            tagSuccess: gitConfig.shouldTag,
            tagName: gitConfig.tagName,
            pushSuccess: gitConfig.shouldPush,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
            platform: 'Git',
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Git operations failed',
            error: errorMessage,
        });

        return {
            branchCreated: gitConfig.shouldCreateBranch,
            branchName: gitConfig.branchName,
            commitSuccess: false,
            commitMessage: gitConfig.commitMessage,
            tagSuccess: false,
            tagName: gitConfig.tagName,
            pushSuccess: false,
        };
    }
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
        options.isSync || false
    );

    const confirmed = await showBatchPreview(plan);
    if (!confirmed) {
        return { results: [] };
    }

    return await executeBatchOperations(
        options.rootPath,
        plan,
        options.bumpType,
        options.customVersions,
        options.isSync || false
    );
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
                        platform: 'Git',
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
    if (!config.get(CONFIG.SKIP_PACKAGE_JSON) && versions.packageJson) {
        try {
            if (options.customVersions?.packageJson) {
                tasks.push(
                    syncPackageJsonVersion(options.rootPath, options.customVersions.packageJson, versions.packageJson)
                );
            } else if (options.isSync) {
                const targetVersion = options.customVersions?.packageJson || versions.packageJson;
                tasks.push(syncPackageJsonVersion(options.rootPath, targetVersion, versions.packageJson));
            } else {
                tasks.push(bumpPackageJsonVersion(options.rootPath, options.packageBumpType || options.bumpType));
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            tasks.push(
                Promise.resolve({
                    platform: 'Package.json',
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
                if (options.isSync) {
                    const targetVersion = options.customVersions?.android?.version || versions.android.versionName;
                    tasks.push(syncAndroidVersion(options.rootPath, targetVersion, versions.android));
                } else if (options.customVersions?.android) {
                    if (options.customVersions.android.buildNumber !== undefined) {
                        tasks.push(
                            syncAndroidVersionWithBuildNumber(
                                options.rootPath,
                                options.customVersions.android.version,
                                options.customVersions.android.buildNumber,
                                versions.android
                            )
                        );
                    } else {
                        tasks.push(
                            syncAndroidVersionOnly(
                                options.rootPath,
                                options.customVersions.android.version,
                                versions.android
                            )
                        );
                    }
                } else {
                    tasks.push(bumpAndroidVersion(options.rootPath, options.bumpType));
                }
            }

            if (!config.get(CONFIG.SKIP_IOS) && hasIOS && versions.ios) {
                if (options.isSync) {
                    const targetVersion = options.customVersions?.ios?.version || versions.ios.version;
                    tasks.push(syncIOSVersion(options.rootPath, targetVersion, versions.ios));
                } else if (options.customVersions?.ios) {
                    if (options.customVersions.ios.buildNumber !== undefined) {
                        tasks.push(
                            syncIOSVersionWithBuildNumber(
                                options.rootPath,
                                options.customVersions.ios.version,
                                options.customVersions.ios.buildNumber,
                                versions.ios
                            )
                        );
                    } else {
                        tasks.push(
                            syncIOSVersionOnly(options.rootPath, options.customVersions.ios.version, versions.ios)
                        );
                    }
                } else {
                    tasks.push(bumpIOSVersion(options.rootPath, options.bumpType));
                }
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
