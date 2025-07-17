import * as vscode from 'vscode';

import { CONFIG_SKIP_ANDROID, CONFIG_SKIP_IOS, CONFIG_SKIP_PACKAGE_JSON, INITIAL_SEMANTIC_VERSION } from '../constants';
import { bumpVersion } from '../services/bumpService';
import { BumpType } from '../types';
import { hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
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

    await bumpVersion(bumpType.value as BumpType, includePackageJson, packageBumpType, withGit);
}
