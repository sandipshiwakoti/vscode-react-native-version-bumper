import * as vscode from 'vscode';

import { exec } from 'child_process';
import { promisify } from 'util';

import { CONFIG, DEFAULT_VALUES, EXTENSION_ID, REGEX_PATTERNS, TEMPLATES } from '../constants';
import { BumpResult, BumpType } from '../types';

import { getPlaceholderValues, replacePlaceholders } from './helperUtils';
import { bumpSemanticVersion, getLatestGitTagVersion } from './versionUtils';

const execAsync = promisify(exec);

export async function executeGitWorkflow(rootPath: string, type: BumpType, results: BumpResult[]): Promise<void> {
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
                vscode.window.showErrorMessage('Branch name is required');
                return;
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
                    platform: 'Git',
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: `Branch: ❌ Failed to create branch "${branchName}": ${errorMessage}`,
                });
                return;
            }
        }

        await execAsync('git add .', { cwd: rootPath });
        let commitMessage: string;
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
            platforms.length > 0 ? `chore: bump ${platforms.join(' and ')}` : `chore: bump version to v${mainVersion}`;

        const commitMessageTemplate = config.get(CONFIG.GIT_COMMIT_MESSAGE_TEMPLATE, commitMessage);
        const defaultCommitMessage = replacePlaceholders(commitMessageTemplate, placeholderValues);

        const customCommitMessage = await vscode.window.showInputBox({
            placeHolder: 'e.g., chore: bump version to 1.2.3',
            prompt: 'Customize commit message (or press Enter for default)',
            value: defaultCommitMessage,
        });

        if (!customCommitMessage) {
            vscode.window.showErrorMessage('Commit message is required');
            return;
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
                platform: 'Git',
                success: false,
                oldVersion: '',
                newVersion: '',
                message: `${branchCreated ? `Branch: ✅ Created and switched to branch "${branchName}"<br>` : ''}Commit: ❌ Failed to commit changes: ${errorMessage}`,
            });
            return;
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
                        label: `🔧 Patch (v${bumpPatchTag(currentTagVersion)})`,
                        value: 'patch',
                    },
                    {
                        label: `⬆️ Minor (v${bumpMinorTag(currentTagVersion)})`,
                        value: 'minor',
                    },
                    {
                        label: `🚀 Major (v${bumpMajorTag(currentTagVersion)})`,
                        value: 'major',
                    },
                    {
                        label: '✏️ Custom Version',
                        value: 'custom',
                    },
                ],
                { placeHolder: 'Select tag version bump type' }
            );

            if (!tagBumpType) {
                return;
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
                    return;
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
                        platform: 'Git',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: `${branchCreated ? `Branch: ✅ Created and switched to branch "${branchName}"<br>` : ''}Commit: ✅ Changes committed with message: "${commitMessage}"<br>Tag: ❌ Failed to create tag: ${tagError instanceof Error ? tagError.message : 'Unknown error'}`,
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
                    gitMessage += `Branch: ✅ Created and switched to branch "${branchName}"<br>`;
                }
                if (commitSuccess) {
                    gitMessage += `Commit: ✅ Changes committed with message: "${commitMessage}"<br>`;
                }
                if (shouldTag) {
                    gitMessage += `Tag: ${tagSuccess ? '✅' : '❌'} ${tagSuccess ? `Tagged ${tagName}` : 'Failed to create tag'}<br>`;
                }
                gitMessage += `Push: ❌ Failed to push to remote: ${pushError}`;

                results.push({
                    platform: 'Git',
                    success: false,
                    oldVersion: '',
                    newVersion: '',
                    message: gitMessage,
                });

                vscode.window.showErrorMessage(`Push failed: ${pushError}`);
                return;
            }
        }

        let gitMessage = '';
        if (branchCreated && branchName) {
            gitMessage += `Branch: ✅ Created and switched to branch "${branchName}"<br>`;
        }
        if (commitSuccess) {
            gitMessage += `Commit: ✅ Changes committed with message: "${commitMessage}"`;
        }
        if (shouldTag && tagName) {
            gitMessage += `<br>Tag: ${tagSuccess ? '✅' : '❌'} ${tagSuccess ? `Tagged ${tagName}` : 'Failed to create tag'}`;
        }
        if (shouldPush) {
            gitMessage += `<br>Push: ${pushSuccess ? '✅' : '❌'} ${pushSuccess ? `Pushed ${shouldCreateBranch ? 'branch and tag' : 'changes and tag'} to remote` : 'Failed to push to remote'}`;
        }

        results.push({
            platform: 'Git',
            success: true,
            oldVersion: '',
            newVersion: '',
            message: gitMessage,
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        let gitMessage = '';
        if (branchCreated && branchName) {
            gitMessage += `Branch: ✅ Created and switched to branch "${branchName}"<br>`;
        }
        if (commitSuccess) {
            gitMessage += `Commit: ✅ Changes committed with message: "${commitMessage}"<br>`;
        }
        if (shouldTag) {
            gitMessage += `Tag: ${tagSuccess ? '✅' : '❌'} ${tagSuccess ? `Tagged ${tagName}` : 'Failed to create tag'}<br>`;
        }
        gitMessage += `Operation failed: ${errorMessage}`;

        results.push({
            platform: 'Git',
            success: false,
            oldVersion: '',
            newVersion: '',
            message: gitMessage,
            error: errorMessage,
        });
    }
}
