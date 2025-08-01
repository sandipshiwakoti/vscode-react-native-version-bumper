import * as vscode from 'vscode';

import { exec } from 'child_process';
import { promisify } from 'util';

import { DEFAULT_VALUES, VERSION_PART_INDICES } from '../constants';
import {
    getAndroidVersionInfo,
    getExpoVersionDetails,
    getPackageJsonVersion,
    readIOSVersionInfo,
} from '../services/platformService';
import { BumpType, ProjectVersions } from '../types';

const execAsync = promisify(exec);

export async function getCurrentVersions(): Promise<ProjectVersions> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error('No workspace folder found');
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const versions: ProjectVersions = {};

    try {
        versions.packageJson = getPackageJsonVersion(rootPath) || undefined;

        const androidVersion = getAndroidVersionInfo(rootPath);
        if (androidVersion) {
            versions.android = androidVersion;
        }

        const iosVersionInfo = await readIOSVersionInfo(rootPath);
        if (iosVersionInfo) {
            versions.ios = {
                buildNumber: iosVersionInfo.buildNumber,
                version: iosVersionInfo.version,
            };
        }

        const expoVersionDetails = getExpoVersionDetails(rootPath);
        if (expoVersionDetails) {
            versions.expo = {
                version: expoVersionDetails.version,
                iosBuildNumber: expoVersionDetails.iosBuildNumber,
                androidVersionCode: expoVersionDetails.androidVersionCode,
            };
        }
    } catch (error) {
        console.error('Error in getCurrentVersions:', error);
    }

    return versions;
}

export function bumpSemanticVersion(version: string, type: BumpType): string {
    const versionParts = version.split('.').map((part) => parseInt(part) || 0);
    while (versionParts.length < 3) {
        versionParts.push(0);
    }

    switch (type) {
        case BumpType.MAJOR:
            versionParts[VERSION_PART_INDICES.MAJOR] += 1;
            versionParts[VERSION_PART_INDICES.MINOR] = 0;
            versionParts[VERSION_PART_INDICES.PATCH] = 0;
            break;
        case BumpType.MINOR:
            versionParts[VERSION_PART_INDICES.MINOR] += 1;
            versionParts[VERSION_PART_INDICES.PATCH] = 0;
            break;
        case BumpType.PATCH:
            versionParts[VERSION_PART_INDICES.PATCH] += 1;
            break;
    }
    return versionParts.join('.');
}

export async function getLatestGitTagVersion(rootPath: string): Promise<string> {
    try {
        try {
            const { stdout } = await execAsync('git describe --tags --abbrev=0', { cwd: rootPath });
            const latestTag = stdout.trim();

            if (latestTag) {
                const versionMatch = latestTag.match(/v?(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return versionMatch[1];
                }
            }
        } catch {
            console.log('getLatestGitTagVersion: git describe failed, trying git tag list approach');
        }

        const { stdout } = await execAsync('git tag -l', { cwd: rootPath });
        const tags = stdout
            .trim()
            .split('\n')
            .filter((tag) => tag.trim());

        if (tags.length === 0) {
            return DEFAULT_VALUES.SEMANTIC_VERSION;
        }

        const versionTags = tags
            .map((tag) => {
                const match = tag.match(/v?(\d+\.\d+\.\d+)/);
                return match
                    ? {
                          tag,
                          version: match[1],
                          parts: match[1].split('.').map(Number),
                      }
                    : null;
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (!a || !b) {
                    return 0;
                }
                for (let i = 0; i < 3; i++) {
                    if (a?.parts[i] !== b?.parts[i]) {
                        return b?.parts[i] - a?.parts[i];
                    }
                }
                return 0;
            });

        if (versionTags.length > 0) {
            return versionTags[0]!.version;
        }

        return DEFAULT_VALUES.SEMANTIC_VERSION;
    } catch {
        try {
            const versions = await getCurrentVersions();
            const fallbackVersion = versions.packageJson || DEFAULT_VALUES.SEMANTIC_VERSION;
            return fallbackVersion;
        } catch {
            return DEFAULT_VALUES.SEMANTIC_VERSION;
        }
    }
}

export function getHighestVersion(versions: string[]): string {
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

export function validateVersion(version: string): string | null {
    if (!version.trim()) {
        return 'Version cannot be empty';
    }

    const semverRegex = /^\d+\.\d+\.\d+$/;
    if (!semverRegex.test(version.trim())) {
        return 'Version must be in format x.y.z (e.g., 1.2.3)';
    }

    return null;
}

export async function getCustomVersionForPlatform(
    platformName: string,
    currentVersion: string
): Promise<string | null> {
    const customVersion = await vscode.window.showInputBox({
        prompt: `Enter custom ${platformName} version`,
        value: currentVersion,
        validateInput: validateVersion,
        placeHolder: `Current: ${currentVersion} → New: e.g., 2.1.0`,
        ignoreFocusOut: true,
    });

    return customVersion?.trim() || null;
}

export async function getCustomBuildNumber(
    platformName: string,
    currentBuildNumber: string | number
): Promise<number | null> {
    const buildNumberStr = currentBuildNumber.toString();
    const customBuildNumber = await vscode.window.showInputBox({
        prompt: `Enter custom ${platformName} build number (leave empty to keep current: ${buildNumberStr})`,
        value: (parseInt(buildNumberStr) + 1).toString(),
        validateInput: (value) => {
            if (!value.trim()) {
                return null;
            }
            const num = parseInt(value.trim());
            if (isNaN(num) || num < 1) {
                return 'Build number must be a positive integer';
            }
            return null;
        },
        placeHolder: `Current: ${buildNumberStr} → Auto-increment: ${parseInt(buildNumberStr) + 1} (or leave empty to keep ${buildNumberStr})`,
        ignoreFocusOut: true,
    });

    if (customBuildNumber === undefined) {
        return null;
    }
    if (!customBuildNumber.trim()) {
        return null;
    }
    return parseInt(customBuildNumber.trim());
}
