import * as vscode from 'vscode';

import { CONFIG_SKIP_ANDROID, CONFIG_SKIP_IOS, CONFIG_SKIP_PACKAGE_JSON, INITIAL_SEMANTIC_VERSION } from '../constants';
import { hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { getCurrentVersions } from '../utils/versionUtils';

interface SyncOption {
    label: string;
    description: string;
    version: string;
    source: 'package.json' | 'android' | 'ios' | 'custom';
}

export async function bumpSyncVersion(withGit: boolean) {
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
            'No React Native projects found. This extension requires at least one React Native platform (android/ or ios/ folder) to be present.'
        );
        return;
    }

    try {
        const versions = await getCurrentVersions();

        const availableVersions: string[] = [];
        if (versions.packageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
            availableVersions.push(versions.packageJson);
        }
        if (versions.android && hasAndroid && !config.get(CONFIG_SKIP_ANDROID)) {
            availableVersions.push(versions.android.versionName);
        }
        if (versions.ios && hasIOS && !config.get(CONFIG_SKIP_IOS)) {
            availableVersions.push(versions.ios.version);
        }

        const uniqueVersions = [...new Set(availableVersions)];
        if (uniqueVersions.length === 1 && availableVersions.length > 1) {
            vscode.window.showInformationMessage(
                `✅ All platforms are already synced to version ${uniqueVersions[0]}!\n\n` +
                    `📦 Package.json: ${versions.packageJson || 'N/A'}\n` +
                    `🤖 Android: ${versions.android?.versionName || 'N/A'}\n` +
                    `🍎 iOS: ${versions.ios?.version || 'N/A'}`
            );
            return;
        }

        const syncOptions: SyncOption[] = [];

        if (versions.packageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
            syncOptions.push({
                label: `📦 Use package.json version: ${versions.packageJson}`,
                description: 'Sync all platforms to match package.json version',
                version: versions.packageJson,
                source: 'package.json',
            });
        }

        if (versions.android && hasAndroid && !config.get(CONFIG_SKIP_ANDROID)) {
            syncOptions.push({
                label: `🤖 Use Android version: ${versions.android.versionName}`,
                description: 'Sync all platforms to match Android versionName',
                version: versions.android.versionName,
                source: 'android',
            });
        }

        if (versions.ios && hasIOS && !config.get(CONFIG_SKIP_IOS)) {
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
                currentVersions.length > 0 ? getHighestVersion(currentVersions as string[]) : INITIAL_SEMANTIC_VERSION;

            const customVersion = await vscode.window.showInputBox({
                prompt: 'Enter the version to sync all platforms to',
                value: suggestedVersion,
                validateInput: (value) => {
                    if (!value) {
                        return 'Version cannot be empty';
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

            targetVersion = customVersion;
        }

        const syncDetails = await buildSyncDetails(versions, targetVersion, hasAndroid, hasIOS, config);

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

        await performSync(targetVersion, versions, hasAndroid, hasIOS, withGit);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`Failed to sync versions: ${errorMessage}`);
    }
}

function getHighestVersion(versions: string[]): string {
    return versions
        .map((v) => ({
            original: v,
            parts: v.split('.').map(Number),
        }))
        .sort((a, b) => {
            for (let i = 0; i < 3; i++) {
                if (a.parts[i] !== b.parts[i]) {
                    return b.parts[i] - a.parts[i];
                }
            }
            return 0;
        })[0].original;
}

async function buildSyncDetails(
    versions: any,
    targetVersion: string,
    hasAndroid: boolean,
    hasIOS: boolean,
    config: any
): Promise<string[]> {
    const details: string[] = [];

    if (versions.packageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
        if (versions.packageJson !== targetVersion) {
            details.push(`📦 package.json: ${versions.packageJson} → ${targetVersion}`);
        } else {
            details.push(`📦 package.json: ${targetVersion} (no change)`);
        }
    }

    if (versions.android && hasAndroid && !config.get(CONFIG_SKIP_ANDROID)) {
        if (versions.android.versionName !== targetVersion) {
            details.push(
                `🤖 Android: ${versions.android.versionName} → ${targetVersion} (build: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
            );
        } else {
            details.push(
                `🤖 Android: ${targetVersion} (build will increment: ${versions.android.versionCode} → ${versions.android.versionCode + 1})`
            );
        }
    }

    if (versions.ios && hasIOS && !config.get(CONFIG_SKIP_IOS)) {
        if (versions.ios.version !== targetVersion) {
            details.push(
                `🍎 iOS: ${versions.ios.version} → ${targetVersion} (build: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
            );
        } else {
            details.push(
                `🍎 iOS: ${targetVersion} (build will increment: ${versions.ios.buildNumber} → ${parseInt(versions.ios.buildNumber) + 1})`
            );
        }
    }

    return details;
}

async function performSync(
    targetVersion: string,
    versions: any,
    hasAndroid: boolean,
    hasIOS: boolean,
    withGit: boolean
): Promise<void> {
    const { syncVersions } = await import('../services/syncService.js');

    await syncVersions(targetVersion, versions, hasAndroid, hasIOS, withGit);
}
