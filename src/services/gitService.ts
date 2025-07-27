import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import { exec } from 'child_process';
import { promisify } from 'util';

import { CONFIG, DEFAULT_VALUES, EXTENSION_ID, REGEX_PATTERNS, RELEASE_TEMPLATE_PATHS, TEMPLATES } from '../constants';
import {
    BatchGitConfig,
    BatchOperation,
    BumpResult,
    BumpType,
    GitAction,
    GitWorkflowResult,
    OperationType,
    Platform,
} from '../types';
import { getPlaceholderValues, replacePlaceholders } from '../utils/helperUtils';
import { bumpSemanticVersion, getLatestGitTagVersion } from '../utils/versionUtils';

const execAsync = promisify(exec);

export async function collectGitConfiguration(
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
        .filter((op) => op.type === OperationType.VERSION)
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
        .filter((op) => op.type === OperationType.VERSION)
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
            const availableVersions = [];
            if (!skipPackageJson && versionMap['Package.json']) {
                availableVersions.push({ platform: 'package', version: versionMap['Package.json'] });
            }
            if (!skipAndroid && versionMap['Android']) {
                availableVersions.push({ platform: 'android', version: versionMap['Android'] });
            }
            if (!skipIOS && versionMap['iOS']) {
                availableVersions.push({ platform: 'ios', version: versionMap['iOS'] });
            }

            const uniqueVersions = [...new Set(availableVersions.map((v) => v.version))];

            if (uniqueVersions.length === 1 && availableVersions.length > 1) {
                defaultBranchName += `v${uniqueVersions[0]}`;
            } else if (!skipAndroid && !skipIOS && versionMap['Android'] && versionMap['iOS']) {
                if (versionMap['Android'] === versionMap['iOS']) {
                    defaultBranchName += `v${versionMap['Android']}`;
                } else {
                    defaultBranchName += `android-v${versionMap['Android']}-ios-v${versionMap['iOS']}`;
                }
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
                customBranchName !== 'release/' &&
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
                placeHolder: 'e.g., release/1.2.3',
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
        platforms.length > 0
            ? `chore: bump version to ${platforms.join(', ')}`
            : `chore: bump version to v${mainVersion}`;

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

export async function executeGitOperationsWithProgress(
    rootPath: string,
    bumpType: BumpType,
    results: BumpResult[],
    gitConfig: BatchGitConfig,
    gitOps: BatchOperation[],
    totalOps: number
): Promise<GitWorkflowResult> {
    let completedOps = gitOps.length > 0 ? totalOps - gitOps.length : 0;

    let branchCreated = false;
    let commitSuccess = false;
    let tagSuccess = false;
    let pushSuccess = false;

    return await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Executing Git operations...',
            cancellable: false,
        },
        async (progress) => {
            try {
                if (gitConfig.shouldCreateBranch && gitConfig.branchName) {
                    const branchOp = gitOps.find((op) => op.action === GitAction.CREATE_BRANCH);
                    if (branchOp) {
                        progress.report({
                            increment: 100 / totalOps,
                            message: `[${completedOps + 1}/${totalOps}] ${branchOp.action}...`,
                        });

                        try {
                            await execAsync(`git checkout -b "${gitConfig.branchName}"`, { cwd: rootPath });
                            branchCreated = true;
                            completedOps++;

                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ✅ ${branchOp.action}`,
                            });
                        } catch (error) {
                            completedOps++;
                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ❌ ${branchOp.action}`,
                            });
                            throw error;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                }

                const commitOp = gitOps.find((op) => op.action === GitAction.COMMIT_CHANGES);
                if (commitOp) {
                    progress.report({
                        increment: 100 / totalOps,
                        message: `[${completedOps + 1}/${totalOps}] ${commitOp.action}...`,
                    });

                    try {
                        await execAsync('git add .', { cwd: rootPath });
                        await execAsync(`git commit -m "${gitConfig.commitMessage}"`, { cwd: rootPath });
                        commitSuccess = true;
                        completedOps++;

                        await new Promise((resolve) => setTimeout(resolve, 200));
                        progress.report({
                            message: `[${completedOps}/${totalOps}] ✅ ${commitOp.action}`,
                        });
                    } catch (error) {
                        completedOps++;
                        await new Promise((resolve) => setTimeout(resolve, 200));
                        progress.report({
                            message: `[${completedOps}/${totalOps}] ❌ ${commitOp.action}`,
                        });
                        throw error;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 300));
                }

                if (gitConfig.shouldTag && gitConfig.tagName && commitSuccess) {
                    const tagOp = gitOps.find((op) => op.action === GitAction.CREATE_TAG);
                    if (tagOp) {
                        progress.report({
                            increment: 100 / totalOps,
                            message: `[${completedOps + 1}/${totalOps}] ${tagOp.action}...`,
                        });

                        try {
                            try {
                                await execAsync(`git tag ${gitConfig.tagName}`, { cwd: rootPath });
                            } catch (tagError: unknown) {
                                if (tagError instanceof Error && tagError.message.includes('already exists')) {
                                    await execAsync(`git tag -d ${gitConfig.tagName}`, { cwd: rootPath });
                                    await execAsync(`git tag ${gitConfig.tagName}`, { cwd: rootPath });
                                } else {
                                    throw tagError;
                                }
                            }
                            tagSuccess = true;
                            completedOps++;

                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ✅ ${tagOp.action}`,
                            });
                        } catch (error) {
                            completedOps++;
                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ❌ ${tagOp.action}`,
                            });
                            throw error;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                }

                if (gitConfig.shouldPush && commitSuccess) {
                    const pushOp = gitOps.find((op) => op.action === GitAction.PUSH_TO_REMOTE);
                    if (pushOp) {
                        progress.report({
                            increment: 100 / totalOps,
                            message: `[${completedOps + 1}/${totalOps}] ${pushOp.action}...`,
                        });

                        try {
                            if (gitConfig.shouldCreateBranch && gitConfig.branchName && branchCreated) {
                                await execAsync(`git push origin "${gitConfig.branchName}"`, { cwd: rootPath });
                            } else {
                                await execAsync('git push', { cwd: rootPath });
                            }

                            if (gitConfig.shouldTag && gitConfig.tagName && tagSuccess) {
                                await execAsync(`git push origin ${gitConfig.tagName}`, { cwd: rootPath });
                            }

                            pushSuccess = true;
                            completedOps++;

                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ✅ ${pushOp.action}`,
                            });
                        } catch (error) {
                            completedOps++;
                            await new Promise((resolve) => setTimeout(resolve, 200));
                            progress.report({
                                message: `[${completedOps}/${totalOps}] ❌ ${pushOp.action}`,
                            });
                            throw error;
                        }
                        await new Promise((resolve) => setTimeout(resolve, 300));
                    }
                }

                let gitMessage = '';
                if (branchCreated && gitConfig.branchName) {
                    gitMessage += `<strong>Branch:</strong> Created and switched to branch "${gitConfig.branchName}"<br>`;
                }
                if (commitSuccess) {
                    gitMessage += `<strong>Commit:</strong> Changes committed with message: "${gitConfig.commitMessage}"`;
                }
                if (gitConfig.shouldTag && gitConfig.tagName) {
                    gitMessage += `<br><strong>Tag:</strong> ${tagSuccess ? `Tagged ${gitConfig.tagName}` : '❌ Failed to create tag'}`;
                }
                if (gitConfig.shouldPush) {
                    gitMessage += `<br><strong>Push:</strong> ${pushSuccess ? `Pushed ${gitConfig.shouldCreateBranch ? 'branch and tag' : 'changes and tag'} to remote` : '❌ Failed to push to remote'}`;
                }

                results.push({
                    platform: Platform.GIT,
                    success: true,
                    oldVersion: '',
                    newVersion: '',
                    message: gitMessage,
                });

                return {
                    branchCreated,
                    branchName: gitConfig.branchName,
                    commitSuccess,
                    commitMessage: gitConfig.commitMessage,
                    tagSuccess,
                    tagName: gitConfig.tagName,
                    pushSuccess,
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    platform: Platform.GIT,
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: 'Git operations failed',
                    error: errorMessage,
                });

                return {
                    branchCreated,
                    branchName: gitConfig.branchName,
                    commitSuccess,
                    commitMessage: gitConfig.commitMessage,
                    tagSuccess,
                    tagName: gitConfig.tagName,
                    pushSuccess,
                };
            }
        }
    );
}

export async function executeGitWorkflow(
    rootPath: string,
    type: BumpType,
    results: BumpResult[]
): Promise<GitWorkflowResult> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    let branchCreated = false;
    let branchName: string | undefined;
    let commitSuccess = false;
    let commitMessage = '';
    let tagSuccess = false;
    let tagName = '';
    let pushSuccess = false;
    let shouldTag = false;
    let shouldPush = false;

    try {
        const skipAndroid = config.get(CONFIG.SKIP_ANDROID, false);
        const skipIOS = config.get(CONFIG.SKIP_IOS, false);
        const skipPackageJson = config.get(CONFIG.SKIP_PACKAGE_JSON, false);

        const versionMap: { [platform: string]: string } = {};
        const buildNumberMap: { [platform: string]: string } = {};

        const versionSources = results
            .filter(
                (r) =>
                    r.success &&
                    r.newVersion &&
                    ((r.platform === 'Android' && !skipAndroid) ||
                        (r.platform === 'iOS' && !skipIOS) ||
                        (r.platform === 'Package.json' && !skipPackageJson))
            )
            .map((r) => ({ platform: r.platform, newVersion: r.newVersion }));

        versionSources.forEach((source) => {
            const platformKey = source.platform;
            let semanticVersion = DEFAULT_VALUES.SEMANTIC_VERSION;
            let buildNumber = DEFAULT_VALUES.NOT_AVAILABLE;

            const versionMatch = source.newVersion.match(REGEX_PATTERNS.VERSION_MATCH);
            if (versionMatch) {
                semanticVersion = versionMatch[1];
                buildNumber = versionMatch[2] || DEFAULT_VALUES.NOT_AVAILABLE;
            } else {
                const result = results.find((r) => r.platform === source.platform);
                if (result && result.oldVersion) {
                    const oldVersionMatch = result.oldVersion.match(REGEX_PATTERNS.VERSION_MATCH);
                    if (oldVersionMatch) {
                        semanticVersion = oldVersionMatch[1];
                        buildNumber =
                            source.newVersion.match(REGEX_PATTERNS.BUILD_NUMBER_EXTRACT)?.[1] ||
                            DEFAULT_VALUES.NOT_AVAILABLE;
                    }
                } else {
                    buildNumber =
                        source.newVersion.match(REGEX_PATTERNS.BUILD_NUMBER_EXTRACT)?.[1] ||
                        DEFAULT_VALUES.NOT_AVAILABLE;
                }
            }

            versionMap[platformKey] = semanticVersion;
            buildNumberMap[platformKey] = buildNumber;
        });

        const mainVersion = await getLatestGitTagVersion(rootPath);

        const placeholderValues = getPlaceholderValues(type, results, mainVersion, versionMap, buildNumberMap);

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

        if (shouldCreateBranch) {
            let defaultBranchName = TEMPLATES.GIT_BRANCH_PREFIX;

            const isSyncOperation = results.some((result) => result.platform === 'SyncOperation');

            if (isSyncOperation) {
                const syncResult = results.find((result) => result.platform === 'SyncOperation');
                if (syncResult) {
                    defaultBranchName += `v${syncResult.newVersion}`;
                } else {
                    defaultBranchName += `v${mainVersion}`;
                }
            } else {
                const availableVersions = [];
                if (!skipPackageJson && versionMap['Package.json']) {
                    availableVersions.push({ platform: 'package', version: versionMap['Package.json'] });
                }
                if (!skipAndroid && versionMap['Android']) {
                    availableVersions.push({ platform: 'android', version: versionMap['Android'] });
                }
                if (!skipIOS && versionMap['iOS']) {
                    availableVersions.push({ platform: 'ios', version: versionMap['iOS'] });
                }

                const uniqueVersions = [...new Set(availableVersions.map((v) => v.version))];

                if (uniqueVersions.length === 1 && availableVersions.length > 1) {
                    defaultBranchName += `v${uniqueVersions[0]}`;
                } else if (!skipAndroid && !skipIOS && versionMap['Android'] && versionMap['iOS']) {
                    if (versionMap['Android'] === versionMap['iOS']) {
                        defaultBranchName += `v${versionMap['Android']}`;
                    } else {
                        defaultBranchName += `android-v${versionMap['Android']}-ios-v${versionMap['iOS']}`;
                    }
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
                    customBranchName !== 'release/' &&
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
                    placeHolder: 'e.g., release/1.2.3',
                    prompt: 'Enter branch name for version changes',
                    value: customBranchName,
                });
            }

            if (!branchName) {
                vscode.window.showErrorMessage('Branch name is required');
                return {
                    branchCreated: false,
                    commitSuccess: false,
                    tagSuccess: false,
                    pushSuccess: false,
                };
            }

            try {
                await execAsync(`git checkout -b "${branchName}"`, {
                    cwd: rootPath,
                });
                branchCreated = true;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to create branch: ${errorMessage}`);
                results.push({
                    platform: Platform.GIT,
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: `Branch: ❌ Failed to create branch "${branchName}": ${errorMessage}`,
                });
                return {
                    branchCreated: false,
                    commitSuccess: false,
                    tagSuccess: false,
                    pushSuccess: false,
                };
            }
        }

        await execAsync('git add .', { cwd: rootPath });
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
        commitMessage =
            platforms.length > 0
                ? `chore: bump version to ${platforms.join(', ')}`
                : `chore: bump version to v${mainVersion}`;

        const commitMessageTemplate = config.get(CONFIG.GIT_COMMIT_MESSAGE_TEMPLATE, commitMessage);
        const defaultCommitMessage = replacePlaceholders(commitMessageTemplate, placeholderValues);

        const customCommitMessage = await vscode.window.showInputBox({
            placeHolder: 'e.g., chore: bump version to 1.2.3',
            prompt: 'Customize commit message (or press Enter for default)',
            value: defaultCommitMessage,
        });

        if (!customCommitMessage) {
            vscode.window.showErrorMessage('Commit message is required');
            return {
                branchCreated,
                branchName,
                commitSuccess: false,
                tagSuccess: false,
                pushSuccess: false,
            };
        }

        try {
            await execAsync(`git commit -m "${customCommitMessage}"`, {
                cwd: rootPath,
            });
            commitSuccess = true;
            commitMessage = customCommitMessage;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({
                platform: Platform.GIT,
                success: false,
                oldVersion: '',
                newVersion: '',
                message: `${branchCreated ? `<strong>Branch:</strong> Created and switched to branch "${branchName}"<br>` : ''}<strong>Commit:</strong> ❌ Failed to commit changes: ${errorMessage}`,
            });
            return {
                branchCreated,
                branchName,
                commitSuccess: false,
                tagSuccess: false,
                pushSuccess: false,
            };
        }

        shouldTag = config.get(CONFIG.GIT_AUTO_CREATE_TAG, false);
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

        if (shouldTag) {
            const currentTagVersion = await getLatestGitTagVersion(rootPath);

            const bumpPatchTag = (version: string) => bumpSemanticVersion(version, BumpType.PATCH);
            const bumpMinorTag = (version: string) => bumpSemanticVersion(version, BumpType.MINOR);
            const bumpMajorTag = (version: string) => bumpSemanticVersion(version, BumpType.MAJOR);

            const tagBumpType = await vscode.window.showQuickPick(
                [
                    {
                        label: `Patch (v${bumpPatchTag(currentTagVersion)})`,
                        value: 'patch',
                    },
                    {
                        label: `Minor (v${bumpMinorTag(currentTagVersion)})`,
                        value: 'minor',
                    },
                    {
                        label: `Major (v${bumpMajorTag(currentTagVersion)})`,
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
                return {
                    branchCreated,
                    branchName,
                    commitSuccess,
                    commitMessage,
                    tagSuccess: false,
                    pushSuccess: false,
                };
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
                    return {
                        branchCreated,
                        branchName,
                        commitSuccess,
                        commitMessage,
                        tagSuccess: false,
                        pushSuccess: false,
                    };
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
                await execAsync(`git tag ${tagName}`, { cwd: rootPath });
                tagSuccess = true;
            } catch (tagError: unknown) {
                if (tagError instanceof Error && tagError.message.includes('already exists')) {
                    const overwrite = await vscode.window.showQuickPick(
                        [
                            { label: 'Yes', value: true },
                            { label: 'No', value: false },
                        ],
                        {
                            placeHolder: `Tag ${tagName} already exists. Overwrite?`,
                        }
                    );
                    if (overwrite?.value) {
                        await execAsync(`git tag -d ${tagName}`, {
                            cwd: rootPath,
                        });
                        await execAsync(`git tag ${tagName}`, {
                            cwd: rootPath,
                        });
                        tagSuccess = true;
                    }
                } else {
                    results.push({
                        platform: Platform.GIT,
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: `${branchCreated ? `<strong>Branch:</strong> Created and switched to branch "${branchName}"<br>` : ''}<strong>Commit:</strong> Changes committed with message: "${commitMessage}"<br><strong>Tag:</strong> ❌ Failed to create tag: ${tagError instanceof Error ? tagError.message : 'Unknown error'}`,
                    });
                }
            }
        }

        shouldPush = !config.get(CONFIG.GIT_SKIP_PUSH);
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

        if (shouldPush) {
            try {
                if (shouldCreateBranch && branchName) {
                    await execAsync(`git push origin "${branchName}"`, {
                        cwd: rootPath,
                    });
                } else {
                    await execAsync(`git push`, { cwd: rootPath });
                }
                if (shouldTag && tagSuccess) {
                    await execAsync(`git push origin ${tagName}`, {
                        cwd: rootPath,
                    });
                }
                pushSuccess = true;
            } catch (caughtError: unknown) {
                const pushError = caughtError instanceof Error ? caughtError.message : 'Unknown push error';

                let gitMessage = '';
                if (branchCreated && branchName) {
                    gitMessage += `<strong>Branch:</strong> Created and switched to branch "${branchName}"<br>`;
                }
                if (commitSuccess) {
                    gitMessage += `<strong>Commit:</strong> Changes committed with message: "${commitMessage}"<br>`;
                }
                if (shouldTag) {
                    gitMessage += `<strong>Tag:</strong> ${tagSuccess ? `Tagged ${tagName}` : '❌ Failed to create tag'}<br>`;
                }
                gitMessage += `<strong>Push:</strong> ❌ Failed to push to remote: ${pushError}`;

                results.push({
                    platform: Platform.GIT,
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: gitMessage,
                });

                vscode.window.showErrorMessage(`Push failed: ${pushError}`);
                return {
                    branchCreated,
                    branchName,
                    commitSuccess,
                    commitMessage,
                    tagSuccess,
                    tagName,
                    pushSuccess: false,
                };
            }
        }

        let gitMessage = '';
        if (branchCreated && branchName) {
            gitMessage += `<strong>Branch:</strong> Created and switched to branch "${branchName}"<br>`;
        }
        if (commitSuccess) {
            gitMessage += `<strong>Commit:</strong> Changes committed with message: "${commitMessage}"`;
        }
        if (shouldTag && tagName) {
            gitMessage += `<br><strong>Tag:</strong> ${tagSuccess ? `Tagged ${tagName}` : '❌ Failed to create tag'}`;
        }
        if (shouldPush) {
            gitMessage += `<br><strong>Push:</strong> ${pushSuccess ? `Pushed ${shouldCreateBranch ? 'branch and tag' : 'changes and tag'} to remote` : '❌ Failed to push to remote'}`;
        }

        results.push({
            platform: Platform.GIT,
            success: true,
            oldVersion: '',
            newVersion: '',
            message: gitMessage,
        });

        return {
            branchCreated,
            branchName,
            commitSuccess,
            commitMessage,
            tagSuccess,
            tagName,
            pushSuccess,
        };
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        let gitMessage = '';
        if (branchCreated && branchName) {
            gitMessage += `<strong>Branch:</strong> Created and switched to branch "${branchName}"<br>`;
        }
        if (commitSuccess) {
            gitMessage += `<strong>Commit:</strong> Changes committed with message: "${commitMessage}"<br>`;
        }
        if (shouldTag) {
            gitMessage += `<strong>Tag:</strong> ${tagSuccess ? `Tagged ${tagName}` : '❌ Failed to create tag'}<br>`;
        }
        gitMessage += `<strong>Operation failed:</strong> ${errorMessage}`;

        results.push({
            platform: Platform.GIT,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: gitMessage,
            error: errorMessage,
        });

        return {
            branchCreated,
            branchName,
            commitSuccess,
            commitMessage,
            tagSuccess,
            tagName,
            pushSuccess: false,
        };
    }
}

export async function checkForExistingReleaseTemplate(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;

    for (const templatePath of RELEASE_TEMPLATE_PATHS) {
        const fullPath = path.join(rootPath, templatePath);
        try {
            if (fs.existsSync(fullPath)) {
                const content = fs.readFileSync(fullPath, 'utf8');
                return content;
            }
        } catch {}
    }

    return null;
}

export async function generateReleaseNotes(
    type: BumpType,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const existingTemplate = await checkForExistingReleaseTemplate();

    if (existingTemplate) {
        return appendVersionInfoToTemplate(existingTemplate, results, tagName, repoUrl);
    } else {
        return await generateDefaultReleaseNotes(type, results, tagName, repoUrl);
    }
}

async function appendVersionInfoToTemplate(
    template: string,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const successfulResults = results.filter((r) => r.success && r.platform !== Platform.GIT);

    let notes = template;

    const hasVersionUpdates =
        /version\s+updates?/i.test(template) || /android.*ios/i.test(template) || /build.*number/i.test(template);

    if (!hasVersionUpdates && successfulResults.length > 0) {
        notes += `\n\n**Version Updates:**\n`;

        successfulResults.forEach((result) => {
            if (result.oldVersion && result.newVersion) {
                const platform = result.platform === 'Package.json' ? 'package.json' : result.platform;
                notes += `- ${platform}: ${result.oldVersion} → ${result.newVersion}\n`;
            }
        });

        const previousTag = await getPreviousTag();
        if (previousTag) {
            notes += `\n**Full Changelog**: ${repoUrl}/compare/${previousTag}...${tagName}`;
        }
    }

    return notes;
}

async function getPreviousTag(): Promise<string> {
    try {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const { stdout } = await execAsync('git describe --tags --abbrev=0 HEAD~1', {
                cwd: workspaceFolders[0].uri.fsPath,
            });
            return stdout.trim();
        }
    } catch {
        console.error('Something went wrong!');
    }
    return '';
}

async function generateDefaultReleaseNotes(
    type: BumpType,
    results: BumpResult[],
    tagName: string,
    repoUrl: string
): Promise<string> {
    const successfulResults = results.filter((r) => r.success && r.platform !== Platform.GIT);

    let notes = `**What's Changed:**\n`;
    notes += `<!-- Add your changes here -->\n`;
    notes += `- \n`;
    notes += `- \n`;

    if (successfulResults.length > 0) {
        notes += `\n\n**Version Updates:**\n`;

        successfulResults.forEach((result) => {
            if (result.oldVersion && result.newVersion) {
                const platform = result.platform === 'Package.json' ? 'package.json' : result.platform;
                notes += `- ${platform}: ${result.oldVersion} → ${result.newVersion}\n`;
            }
        });

        const previousTag = await getPreviousTag();
        if (previousTag) {
            notes += `\n**Full Changelog**: ${repoUrl}/compare/${previousTag}...${tagName}`;
        }
    }

    return notes;
}
