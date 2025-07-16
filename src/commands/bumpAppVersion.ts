import * as vscode from 'vscode';

import { CONFIG_SKIP_ANDROID, CONFIG_SKIP_IOS, CONFIG_SKIP_PACKAGE_JSON, INITIAL_SEMANTIC_VERSION } from '../constants';
import { bumpVersion } from '../services/bumpService';
import { BumpType } from '../types';
import { bumpSemanticVersion, getCurrentVersions } from '../utils/versionUtils';

export async function bumpAppVersion(withGit: boolean) {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const versions = await getCurrentVersions();
    const androidVersion = versions?.android ? versions.android.versionName : INITIAL_SEMANTIC_VERSION;
    const iosVersion = versions.ios ? versions.ios.version : INITIAL_SEMANTIC_VERSION;
    const packageJsonVersion = versions.packageJson || INITIAL_SEMANTIC_VERSION;

    const bumpPatchVersion = (version: string) => bumpSemanticVersion(version, 'patch');
    const bumpMinorVersion = (version: string) => bumpSemanticVersion(version, 'minor');
    const bumpMajorVersion = (version: string) => bumpSemanticVersion(version, 'major');

    const getPlatformLabel = (bumpType: BumpType) => {
        const platforms: string[] = [];
        if (!config.get(CONFIG_SKIP_ANDROID) && versions?.android) {
            platforms.push(`Android: v${bumpSemanticVersion(androidVersion, bumpType)}`);
        }
        if (!config.get(CONFIG_SKIP_IOS) && versions.ios) {
            platforms.push(`iOS: v${bumpSemanticVersion(iosVersion, bumpType)}`);
        }
        return platforms.length > 0 ? platforms.join(', ') : 'No platforms';
    };

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
        { placeHolder: 'Select version bump type for Android and iOS' }
    );

    if (!bumpType) {
        return;
    }

    let includePackageJson: { value: boolean } | undefined = { value: false };
    let packageBumpType: BumpType = bumpType.value as BumpType;
    if (!config.get(CONFIG_SKIP_PACKAGE_JSON)) {
        includePackageJson = await vscode.window.showQuickPick(
            [
                { label: 'Yes', value: true },
                { label: 'No', value: false },
            ],
            { placeHolder: 'Include package.json version bump?' }
        );
        if (includePackageJson === undefined) {
            return;
        }

        if (includePackageJson.value) {
            const packageBumpTypeSelection = await vscode.window.showQuickPick(
                [
                    {
                        label: `🔧 Patch (v${bumpPatchVersion(packageJsonVersion)})`,
                        value: 'patch',
                    },
                    {
                        label: `⬆️ Minor (v${bumpMinorVersion(packageJsonVersion)})`,
                        value: 'minor',
                    },
                    {
                        label: `🚀 Major (v${bumpMajorVersion(packageJsonVersion)})`,
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
    }

    await bumpVersion(bumpType.value as BumpType, includePackageJson.value, packageBumpType, withGit);
}
