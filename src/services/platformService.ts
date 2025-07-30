import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
    ANDROID_GRADLE_KEYS,
    COMMANDS,
    CONFIG,
    DEFAULT_VALUES,
    EXTENSION_ID,
    FILE_EXTENSIONS,
    FILE_PATTERNS,
    IOS_PLIST_KEYS,
    REGEX_PATTERNS,
} from '../constants';
import {
    AndroidVersionInfo,
    BumpResult,
    BumpType,
    EASBuildProfile,
    EASConfig,
    IOSUpdateResult,
    IOSVersionInfo,
    PackageJsonContent,
    Platform,
    PlatformConfig,
    PlatformType,
} from '../types';
import { findInfoPlistPath, hasAndroidProject, hasIOSProject } from '../utils/fileUtils';
import { bumpSemanticVersion } from '../utils/versionUtils';

export async function readIOSVersionInfo(rootPath: string): Promise<IOSVersionInfo | null> {
    return await readIOSVersionInfoInternal(rootPath);
}

export function getPackageJsonName(rootPath: string): string | null {
    try {
        const { packageJson } = readPackageJson(rootPath);
        return packageJson.name || null;
    } catch {
        return null;
    }
}

export function getPackageJsonVersion(rootPath: string): string | null {
    try {
        const { packageJson } = readPackageJson(rootPath);
        return packageJson.version || null;
    } catch {
        return null;
    }
}

export function getAndroidVersionInfo(rootPath: string): { versionCode: number; versionName: string } | null {
    try {
        const versionInfo = readAndroidVersionInfo(rootPath);
        return {
            versionCode: versionInfo.versionCode,
            versionName: versionInfo.versionName,
        };
    } catch {
        return null;
    }
}

export function getExpoVersionDetails(
    rootPath: string
): { version: string; iosBuildNumber?: string; androidVersionCode?: number } | null {
    try {
        const { expoConfig } = readExpoConfig(rootPath);
        const version = getExpoVersion(expoConfig);
        if (!version) {
            return null;
        }

        return {
            version,
            iosBuildNumber: expoConfig.expo?.ios?.buildNumber,
            androidVersionCode: expoConfig.expo?.android?.versionCode,
        };
    } catch {
        return null;
    }
}

export function getPackageJsonCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
        return codeLenses;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('"version"')) {
            const range = new vscode.Range(i, 0, i, line.length);

            try {
                const currentVersion = getPackageJsonVersion(rootPath);
                if (currentVersion) {
                    const patchVersion = bumpSemanticVersion(currentVersion, BumpType.PATCH);
                    const minorVersion = bumpSemanticVersion(currentVersion, BumpType.MINOR);
                    const majorVersion = bumpSemanticVersion(currentVersion, BumpType.MAJOR);

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Patch (${patchVersion})`,
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Minor (${minorVersion})`,
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Major (${majorVersion})`,
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                } else {
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Patch',
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Minor',
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Major',
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                }
            } catch {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Patch',
                        command: COMMANDS.BUMP_PATCH,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Minor',
                        command: COMMANDS.BUMP_MINOR,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Major',
                        command: COMMANDS.BUMP_MAJOR,
                    })
                );
            }
            break;
        }
    }

    return codeLenses;
}

export function getAndroidCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
        return codeLenses;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('versionName') || line.includes('versionCode')) {
            const range = new vscode.Range(i, 0, i, line.length);

            try {
                const androidInfo = getAndroidVersionInfo(rootPath);
                if (androidInfo) {
                    const patchVersion = bumpSemanticVersion(androidInfo.versionName, BumpType.PATCH);
                    const minorVersion = bumpSemanticVersion(androidInfo.versionName, BumpType.MINOR);
                    const majorVersion = bumpSemanticVersion(androidInfo.versionName, BumpType.MAJOR);

                    const newPatchVersion = `${patchVersion} (${androidInfo.versionCode + 1})`;
                    const newMinorVersion = `${minorVersion} (${androidInfo.versionCode + 1})`;
                    const newMajorVersion = `${majorVersion} (${androidInfo.versionCode + 1})`;

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Patch (${newPatchVersion})`,
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Minor (${newMinorVersion})`,
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Major (${newMajorVersion})`,
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                } else {
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Patch',
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Minor',
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Major',
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                }
            } catch {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Patch',
                        command: COMMANDS.BUMP_PATCH,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Minor',
                        command: COMMANDS.BUMP_MINOR,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Major',
                        command: COMMANDS.BUMP_MAJOR,
                    })
                );
            }
            break;
        }
    }

    return codeLenses;
}

export async function getIOSCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
        return codeLenses;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('CFBundleVersion') || line.includes('CFBundleShortVersionString')) {
            const range = new vscode.Range(i, 0, i, line.length);

            try {
                const iosInfo = await readIOSVersionInfo(rootPath);
                if (iosInfo) {
                    const patchVersion = bumpSemanticVersion(iosInfo.version, BumpType.PATCH);
                    const minorVersion = bumpSemanticVersion(iosInfo.version, BumpType.MINOR);
                    const majorVersion = bumpSemanticVersion(iosInfo.version, BumpType.MAJOR);

                    const newBuildNumber = (parseInt(iosInfo.buildNumber) + 1).toString();
                    const newPatchVersion = `${patchVersion} (${newBuildNumber})`;
                    const newMinorVersion = `${minorVersion} (${newBuildNumber})`;
                    const newMajorVersion = `${majorVersion} (${newBuildNumber})`;

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Patch (${newPatchVersion})`,
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Minor (${newMinorVersion})`,
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Major (${newMajorVersion})`,
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                } else {
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Patch',
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Minor',
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Major',
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                }
            } catch {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Patch',
                        command: COMMANDS.BUMP_PATCH,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Minor',
                        command: COMMANDS.BUMP_MINOR,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Major',
                        command: COMMANDS.BUMP_MAJOR,
                    })
                );
            }
            break;
        }
    }

    return codeLenses;
}

export function getExpoCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
        return codeLenses;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('"version"') && !line.includes('dependencies') && !line.includes('scripts')) {
            const range = new vscode.Range(i, 0, i, line.length);

            try {
                const versionDetails = getExpoVersionDetails(rootPath);
                if (versionDetails) {
                    const patchVersion = bumpSemanticVersion(versionDetails.version, BumpType.PATCH);
                    const minorVersion = bumpSemanticVersion(versionDetails.version, BumpType.MINOR);
                    const majorVersion = bumpSemanticVersion(versionDetails.version, BumpType.MAJOR);

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Patch (${patchVersion})`,
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Minor (${minorVersion})`,
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Major (${majorVersion})`,
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                } else {
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Patch',
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Minor',
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Major',
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                }
            } catch {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Patch',
                        command: COMMANDS.BUMP_PATCH,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Minor',
                        command: COMMANDS.BUMP_MINOR,
                    }),
                    new vscode.CodeLens(range, {
                        title: '$(arrow-up) Major',
                        command: COMMANDS.BUMP_MAJOR,
                    })
                );
            }
            break;
        }
    }

    return codeLenses;
}

export async function checkEASAutoIncrementWarning(rootPath: string): Promise<boolean> {
    const { hasAutoIncrement, profiles } = hasAutoIncrementEnabled(rootPath);

    if (!hasAutoIncrement) {
        return true;
    }

    const profileList = profiles.join(', ');
    const message =
        profiles.length === 1
            ? `EAS is configured for auto-increment in the "${profileList}" build profile.`
            : `EAS is configured for auto-increment in these build profiles: ${profileList}.`;

    const choice = await vscode.window.showWarningMessage(
        `${message}\n\nManually changing the Expo version may conflict with EAS auto-increment. Are you sure you want to proceed?`,
        { modal: true },
        'Yes, proceed anyway'
    );

    return choice === 'Yes, proceed anyway';
}

export function hasEASAutoIncrement(rootPath: string): { hasAutoIncrement: boolean; profiles: string[] } {
    return hasAutoIncrementEnabled(rootPath);
}

export function getAppConfigCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!rootPath) {
        return codeLenses;
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (/version\s*:\s*['"`][^'"`]+['"`]/.test(line)) {
            const range = new vscode.Range(i, 0, i, line.length);

            try {
                const versionDetails = getExpoVersionDetails(rootPath);
                if (versionDetails) {
                    const patchVersion = bumpSemanticVersion(versionDetails.version, BumpType.PATCH);
                    const minorVersion = bumpSemanticVersion(versionDetails.version, BumpType.MINOR);
                    const majorVersion = bumpSemanticVersion(versionDetails.version, BumpType.MAJOR);

                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Patch (${patchVersion})`,
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Minor (${minorVersion})`,
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: `$(arrow-up) Major (${majorVersion})`,
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                } else {
                    codeLenses.push(
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Patch',
                            command: COMMANDS.BUMP_PATCH,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Minor',
                            command: COMMANDS.BUMP_MINOR,
                        }),
                        new vscode.CodeLens(range, {
                            title: '$(arrow-up) Major',
                            command: COMMANDS.BUMP_MAJOR,
                        })
                    );
                }
            } catch {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: '⚠️ Dynamic config not supported',
                        command: '',
                    })
                );
            }
            break;
        }
    }

    return codeLenses;
}

export async function updatePlatformVersion(config: PlatformConfig): Promise<BumpResult> {
    switch (config.type) {
        case PlatformType.ANDROID:
            return config.targetVersion
                ? syncAndroidVersion(config.rootPath, config.targetVersion, config.buildNumber)
                : bumpAndroidVersion(config.rootPath, config.bumpType!);
        case PlatformType.IOS:
            return config.targetVersion
                ? syncIOSVersion(config.rootPath, config.targetVersion, config.buildNumber)
                : bumpIOSVersion(config.rootPath, config.bumpType!);
        case PlatformType.PACKAGE:
            return config.targetVersion
                ? syncPackageVersion(config.rootPath, config.targetVersion)
                : bumpPackageVersion(config.rootPath, config.bumpType!);
        case PlatformType.EXPO:
            return config.targetVersion
                ? syncExpoVersion(config.rootPath, config.targetVersion, config.runtimeSyncNative)
                : bumpExpoVersion(config.rootPath, config.bumpType!, config.runtimeSyncNative);
        default:
            throw new Error(`Unsupported platform: ${config.type}`);
    }
}

async function bumpAndroidVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    try {
        const versionInfo = readAndroidVersionInfo(rootPath);
        const newVersionCode = versionInfo.versionCode + 1;
        const newVersionName = bumpSemanticVersion(versionInfo.versionName, type);

        updateAndroidVersionInfo(versionInfo, newVersionName, newVersionCode);

        return {
            platform: Platform.ANDROID,
            success: true,
            oldVersion: `${versionInfo.versionName} (${versionInfo.versionCode})`,
            newVersion: `${newVersionName} (${newVersionCode})`,
            message: `Updated Android version from ${versionInfo.versionName} (${versionInfo.versionCode}) to ${newVersionName} (${newVersionCode})`,
        };
    } catch (error) {
        return {
            platform: Platform.ANDROID,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to update Android version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function syncAndroidVersion(rootPath: string, targetVersion: string, buildNumber?: number): Promise<BumpResult> {
    try {
        const versionInfo = readAndroidVersionInfo(rootPath);
        const newVersionCode = buildNumber ?? versionInfo.versionCode + 1;

        updateAndroidVersionInfo(versionInfo, targetVersion, newVersionCode);

        return {
            platform: Platform.ANDROID,
            success: true,
            oldVersion: `${versionInfo.versionName} (${versionInfo.versionCode})`,
            newVersion: `${targetVersion} (${newVersionCode})`,
            message: `Synced Android version from ${versionInfo.versionName} (${versionInfo.versionCode}) to ${targetVersion} (${newVersionCode})`,
        };
    } catch (error) {
        return {
            platform: Platform.ANDROID,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to sync Android version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function bumpIOSVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    try {
        const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
        if (!fs.existsSync(iosPath)) {
            throw new Error('iOS folder not found');
        }

        const versionInfo = await readIOSVersionInfoInternal(rootPath);
        if (!versionInfo) {
            throw new Error('Could not read iOS version information');
        }

        const newVersion = bumpSemanticVersion(versionInfo.version, type);
        const newBuildNumber = (parseInt(versionInfo.buildNumber) + 1).toString();

        const updateResult = await updateIOSVersion(rootPath, newVersion, newBuildNumber);

        return {
            platform: Platform.IOS,
            success: true,
            oldVersion: `${updateResult.oldVersion} (${updateResult.oldBuildNumber})`,
            newVersion: `${updateResult.newVersion} (${updateResult.newBuildNumber})`,
            message: `Updated iOS version from ${updateResult.oldVersion} (${updateResult.oldBuildNumber}) to ${updateResult.newVersion} (${updateResult.newBuildNumber})`,
        };
    } catch (error) {
        return {
            platform: Platform.IOS,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to update iOS version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function syncIOSVersion(rootPath: string, targetVersion: string, buildNumber?: number): Promise<BumpResult> {
    try {
        const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
        if (!fs.existsSync(iosPath)) {
            throw new Error('iOS folder not found');
        }

        const versionInfo = await readIOSVersionInfoInternal(rootPath);
        if (!versionInfo) {
            throw new Error('Could not read iOS version information');
        }

        const newBuildNumber = buildNumber?.toString() ?? (parseInt(versionInfo.buildNumber) + 1).toString();
        const updateResult = await updateIOSVersion(rootPath, targetVersion, newBuildNumber);

        return {
            platform: Platform.IOS,
            success: true,
            oldVersion: `${updateResult.oldVersion} (${updateResult.oldBuildNumber})`,
            newVersion: `${updateResult.newVersion} (${updateResult.newBuildNumber})`,
            message: `Synced iOS version from ${updateResult.oldVersion} (${updateResult.oldBuildNumber}) to ${updateResult.newVersion} (${updateResult.newBuildNumber})`,
        };
    } catch (error) {
        return {
            platform: Platform.IOS,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to sync iOS version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function bumpPackageVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    try {
        const { packageJson, packageJsonPath } = readPackageJson(rootPath);
        const oldVersion = packageJson.version || DEFAULT_VALUES.SEMANTIC_VERSION;
        const newVersion = bumpSemanticVersion(oldVersion, type);

        packageJson.version = newVersion;
        fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, DEFAULT_VALUES.JSON_INDENT) + DEFAULT_VALUES.NEWLINE
        );

        return {
            platform: Platform.PACKAGE_JSON,
            success: true,
            oldVersion,
            newVersion,
            message: `Updated package.json version from ${oldVersion} to ${newVersion}`,
        };
    } catch (error) {
        return {
            platform: Platform.PACKAGE_JSON,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to update package.json version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function syncPackageVersion(rootPath: string, targetVersion: string): Promise<BumpResult> {
    try {
        const { packageJson, packageJsonPath } = readPackageJson(rootPath);
        const oldVersion = packageJson.version || DEFAULT_VALUES.SEMANTIC_VERSION;

        packageJson.version = targetVersion;
        fs.writeFileSync(
            packageJsonPath,
            JSON.stringify(packageJson, null, DEFAULT_VALUES.JSON_INDENT) + DEFAULT_VALUES.NEWLINE
        );

        return {
            platform: Platform.PACKAGE_JSON,
            success: true,
            oldVersion,
            newVersion: targetVersion,
            message: `Synced package.json version from ${oldVersion} to ${targetVersion}`,
        };
    } catch (error) {
        return {
            platform: Platform.PACKAGE_JSON,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to sync package.json version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function bumpExpoVersion(rootPath: string, type: BumpType, runtimeSyncNative?: boolean): Promise<BumpResult> {
    try {
        const shouldProceed = await checkEASAutoIncrementWarning(rootPath);
        if (!shouldProceed) {
            return {
                platform: Platform.EXPO,
                success: false,
                oldVersion: '',
                newVersion: '',
                message: 'Version bump cancelled due to EAS auto-increment configuration',
            };
        }

        const { expoConfig, configPath } = readExpoConfig(rootPath);
        const versionDetails = getExpoVersionDetails(rootPath);
        if (!versionDetails) {
            throw new Error('Could not read Expo version information');
        }

        const oldVersion = versionDetails.version;
        const newVersion = bumpSemanticVersion(oldVersion, type);

        const newIosBuildNumber = versionDetails.iosBuildNumber
            ? (parseInt(versionDetails.iosBuildNumber) + 1).toString()
            : undefined;
        const newAndroidVersionCode = versionDetails.androidVersionCode
            ? versionDetails.androidVersionCode + 1
            : undefined;

        updateExpoVersion(expoConfig, newVersion, newIosBuildNumber, newAndroidVersionCode);
        writeExpoConfig(configPath, expoConfig);

        const config = vscode.workspace.getConfiguration(EXTENSION_ID);
        const configSyncNativeFiles = config.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);
        const shouldSyncNative = configSyncNativeFiles || runtimeSyncNative;

        if (shouldSyncNative) {
            if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroidProject(rootPath)) {
                try {
                    await syncAndroidVersion(rootPath, newVersion, newAndroidVersionCode);
                } catch (error) {
                    console.warn('Failed to update Android native files:', error);
                }
            }

            if (!config.get(CONFIG.SKIP_IOS) && hasIOSProject(rootPath)) {
                try {
                    await updateIOSVersion(rootPath, newVersion, newIosBuildNumber || '1');
                } catch (error) {
                    console.warn('Failed to update iOS native files:', error);
                }
            }
        }

        const oldVersionDisplay =
            versionDetails.iosBuildNumber || versionDetails.androidVersionCode
                ? `${oldVersion} (iOS: ${versionDetails.iosBuildNumber || 'N/A'}, Android: ${versionDetails.androidVersionCode || 'N/A'})`
                : oldVersion;

        const newVersionDisplay =
            newIosBuildNumber || newAndroidVersionCode
                ? `${newVersion} (iOS: ${newIosBuildNumber || versionDetails.iosBuildNumber || 'N/A'}, Android: ${newAndroidVersionCode || versionDetails.androidVersionCode || 'N/A'})`
                : newVersion;

        let message = `Updated Expo version from ${oldVersion} to ${newVersion}`;

        if (shouldSyncNative) {
            const nativeUpdates: string[] = [];
            if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroidProject(rootPath) && newAndroidVersionCode) {
                nativeUpdates.push(
                    `Android Version Code: ${versionDetails.androidVersionCode || 'N/A'} → ${newAndroidVersionCode}`
                );
            }
            if (!config.get(CONFIG.SKIP_IOS) && hasIOSProject(rootPath) && newIosBuildNumber) {
                nativeUpdates.push(
                    `iOS Build Number: ${versionDetails.iosBuildNumber || 'N/A'} → ${newIosBuildNumber}`
                );
            }
            if (nativeUpdates.length > 0) {
                message += `\n${nativeUpdates.join('\n')}`;
            }
        }

        return {
            platform: Platform.EXPO,
            success: true,
            oldVersion: oldVersionDisplay,
            newVersion: newVersionDisplay,
            message: message,
        };
    } catch (error) {
        return {
            platform: Platform.EXPO,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to update Expo version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

async function syncExpoVersion(
    rootPath: string,
    targetVersion: string,
    runtimeSyncNative?: boolean
): Promise<BumpResult> {
    try {
        const shouldProceed = await checkEASAutoIncrementWarning(rootPath);
        if (!shouldProceed) {
            return {
                platform: Platform.EXPO,
                success: false,
                oldVersion: '',
                newVersion: '',
                message: 'Version sync cancelled due to EAS auto-increment configuration',
            };
        }

        const { expoConfig, configPath } = readExpoConfig(rootPath);
        const versionDetails = getExpoVersionDetails(rootPath);
        if (!versionDetails) {
            throw new Error('Could not read Expo version information');
        }

        const oldVersion = versionDetails.version;

        const newIosBuildNumber = versionDetails.iosBuildNumber
            ? (parseInt(versionDetails.iosBuildNumber) + 1).toString()
            : undefined;
        const newAndroidVersionCode = versionDetails.androidVersionCode
            ? versionDetails.androidVersionCode + 1
            : undefined;

        updateExpoVersion(expoConfig, targetVersion, newIosBuildNumber, newAndroidVersionCode);
        writeExpoConfig(configPath, expoConfig);

        const config = vscode.workspace.getConfiguration(EXTENSION_ID);
        const configSyncNativeFiles = config.get(CONFIG.EXPO_SYNC_NATIVE_FILES, false);
        const shouldSyncNative = configSyncNativeFiles || runtimeSyncNative;

        if (shouldSyncNative) {
            if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroidProject(rootPath)) {
                try {
                    await syncAndroidVersion(rootPath, targetVersion, newAndroidVersionCode);
                } catch (error) {
                    console.warn('Failed to update Android native files:', error);
                }
            }

            if (!config.get(CONFIG.SKIP_IOS) && hasIOSProject(rootPath)) {
                try {
                    await updateIOSVersion(rootPath, targetVersion, newIosBuildNumber || '1');
                } catch (error) {
                    console.warn('Failed to update iOS native files:', error);
                }
            }
        }

        const oldVersionDisplay =
            versionDetails.iosBuildNumber || versionDetails.androidVersionCode
                ? `${oldVersion} (iOS: ${versionDetails.iosBuildNumber || 'N/A'}, Android: ${versionDetails.androidVersionCode || 'N/A'})`
                : oldVersion;

        const newVersionDisplay =
            newIosBuildNumber || newAndroidVersionCode
                ? `${targetVersion} (iOS: ${newIosBuildNumber || versionDetails.iosBuildNumber || 'N/A'}, Android: ${newAndroidVersionCode || versionDetails.androidVersionCode || 'N/A'})`
                : targetVersion;

        let message = `Synced Expo version from ${oldVersion} to ${targetVersion}`;

        if (shouldSyncNative) {
            const nativeUpdates: string[] = [];
            if (!config.get(CONFIG.SKIP_ANDROID) && hasAndroidProject(rootPath) && newAndroidVersionCode) {
                nativeUpdates.push(
                    `Android Version Code: ${versionDetails.androidVersionCode || 'N/A'} → ${newAndroidVersionCode}`
                );
            }
            if (!config.get(CONFIG.SKIP_IOS) && hasIOSProject(rootPath) && newIosBuildNumber) {
                nativeUpdates.push(
                    `iOS Build Number: ${versionDetails.iosBuildNumber || 'N/A'} → ${newIosBuildNumber}`
                );
            }
            if (nativeUpdates.length > 0) {
                message += `\n${nativeUpdates.join('\n')}`;
            }
        }

        return {
            platform: Platform.EXPO,
            success: true,
            oldVersion: oldVersionDisplay,
            newVersion: newVersionDisplay,
            message: message,
        };
    } catch (error) {
        return {
            platform: Platform.EXPO,
            success: false,
            oldVersion: '',
            newVersion: '',
            message: 'Failed to sync Expo version',
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

function readAndroidVersionInfo(rootPath: string): AndroidVersionInfo {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const buildGradleConfigPath = config.get(
        CONFIG.ANDROID_BUILD_GRADLE_PATH,
        FILE_PATTERNS.ANDROID_BUILD_GRADLE_DEFAULT
    );
    const buildGradlePath = path.join(rootPath, buildGradleConfigPath);

    if (!fs.existsSync(buildGradlePath)) {
        throw new Error(`Android build.gradle not found at ${buildGradlePath}`);
    }

    const content = fs.readFileSync(buildGradlePath, 'utf8');
    const lines = content.split('\n');
    let versionCode = DEFAULT_VALUES.VERSION_CODE;
    let versionName = DEFAULT_VALUES.VERSION_NAME;
    let versionCodeLineIndex = DEFAULT_VALUES.VERSION_LINE_INDEX;
    let versionNameLineIndex = DEFAULT_VALUES.VERSION_LINE_INDEX;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith(ANDROID_GRADLE_KEYS.VERSION_CODE)) {
            const match = line.match(REGEX_PATTERNS.VERSION_CODE);
            if (match) {
                versionCode = parseInt(match[1]);
                versionCodeLineIndex = i;
            }
        }
        if (line.startsWith(ANDROID_GRADLE_KEYS.VERSION_NAME)) {
            const match = line.match(REGEX_PATTERNS.VERSION_NAME);
            if (match) {
                versionName = match[1];
                versionNameLineIndex = i;
            }
        }
    }

    return {
        versionCode,
        versionName,
        versionCodeLineIndex,
        versionNameLineIndex,
        lines,
        buildGradlePath,
    };
}

function updateAndroidVersionInfo(
    versionInfo: AndroidVersionInfo,
    newVersionName: string,
    newVersionCode: number
): void {
    if (versionInfo.versionNameLineIndex >= 0) {
        versionInfo.lines[versionInfo.versionNameLineIndex] = versionInfo.lines[
            versionInfo.versionNameLineIndex
        ].replace(REGEX_PATTERNS.VERSION_NAME_REPLACE, `versionName "${newVersionName}"`);
    }

    if (versionInfo.versionCodeLineIndex >= 0) {
        versionInfo.lines[versionInfo.versionCodeLineIndex] = versionInfo.lines[
            versionInfo.versionCodeLineIndex
        ].replace(REGEX_PATTERNS.VERSION_CODE_REPLACE, `versionCode ${newVersionCode}`);
    }

    fs.writeFileSync(versionInfo.buildGradlePath, versionInfo.lines.join('\n'), 'utf8');
}

async function readIOSVersionInfoInternal(rootPath: string): Promise<IOSVersionInfo | null> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    let plistPath: string | null = null;
    const customPlistPath = config.get<string>(CONFIG.IOS_INFO_PLIST_PATH);

    if (customPlistPath) {
        const fullCustomPath = path.join(rootPath, customPlistPath);
        if (fs.existsSync(fullCustomPath)) {
            plistPath = fullCustomPath;
        }
    }

    if (!plistPath) {
        const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
        if (!fs.existsSync(iosPath)) {
            return null;
        }
        plistPath = await findInfoPlistPath(iosPath);
    }

    if (!plistPath) {
        return null;
    }

    try {
        const plistContent = fs.readFileSync(plistPath, 'utf8');
        const lines = plistContent.split('\n');

        let version = DEFAULT_VALUES.SEMANTIC_VERSION;
        let buildNumber = DEFAULT_VALUES.BUILD_NUMBER;
        let versionVarName: string | undefined;
        let buildVarName: string | undefined;
        let usesVariables = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const variableMatch = nextLine.match(REGEX_PATTERNS.PLIST_VARIABLE_MATCH);
                if (variableMatch) {
                    versionVarName = variableMatch[1];
                    usesVariables = true;
                } else {
                    const stringMatch = nextLine.match(REGEX_PATTERNS.PLIST_STRING_MATCH);
                    if (stringMatch) {
                        version = stringMatch[1];
                    }
                }
            }

            if (line === IOS_PLIST_KEYS.BUNDLE_VERSION && i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const variableMatch = nextLine.match(REGEX_PATTERNS.PLIST_VARIABLE_MATCH);
                if (variableMatch) {
                    buildVarName = variableMatch[1];
                    usesVariables = true;
                } else {
                    const stringMatch = nextLine.match(REGEX_PATTERNS.PLIST_STRING_MATCH);
                    if (stringMatch) {
                        buildNumber = stringMatch[1];
                    }
                }
            }
        }

        if (usesVariables) {
            const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
            const pbxprojPath = findPbxprojPath(iosPath, rootPath);
            if (pbxprojPath && (versionVarName || buildVarName)) {
                const pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

                if (versionVarName) {
                    const versionMatch =
                        REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.QUOTED(versionVarName).exec(pbxprojContent) ||
                        REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SEMICOLON(versionVarName).exec(pbxprojContent) ||
                        REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SIMPLE(versionVarName).exec(pbxprojContent);
                    if (versionMatch) {
                        version = versionMatch[1];
                    }
                }

                if (buildVarName) {
                    const buildMatch =
                        REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_QUOTED(buildVarName).exec(pbxprojContent) ||
                        REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_SIMPLE(buildVarName).exec(pbxprojContent);
                    if (buildMatch) {
                        buildNumber = buildMatch[1];
                    }
                }
            }
        }

        return {
            version,
            buildNumber,
            versionVarName,
            buildVarName,
            usesVariables,
        };
    } catch {
        return null;
    }
}

async function updateIOSVersion(
    rootPath: string,
    newVersion: string,
    newBuildNumber: string
): Promise<IOSUpdateResult> {
    const versionInfo = await readIOSVersionInfoInternal(rootPath);
    if (!versionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const oldVersion = versionInfo.version;
    const oldBuildNumber = versionInfo.buildNumber;

    if (versionInfo.usesVariables) {
        await updateIOSVersionInPbxproj(rootPath, newVersion, newBuildNumber, versionInfo);
    } else {
        await updateIOSVersionInPlist(rootPath, newVersion, newBuildNumber);
    }

    return {
        oldVersion,
        oldBuildNumber,
        newVersion,
        newBuildNumber,
    };
}

async function updateIOSVersionInPlist(rootPath: string, newVersion: string, newBuildNumber: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    let plistPath: string | null = null;
    const customPlistPath = config.get<string>(CONFIG.IOS_INFO_PLIST_PATH);

    if (customPlistPath) {
        const fullCustomPath = path.join(rootPath, customPlistPath);
        if (fs.existsSync(fullCustomPath)) {
            plistPath = fullCustomPath;
        }
    }

    if (!plistPath) {
        const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
        if (fs.existsSync(iosPath)) {
            plistPath = await findInfoPlistPath(iosPath);
        }
    }

    if (!plistPath) {
        throw new Error('Info.plist not found');
    }

    const plistContent = fs.readFileSync(plistPath, 'utf8');
    const plistLines = plistContent.split('\n');

    for (let i = 0; i < plistLines.length; i++) {
        const line = plistLines[i].trim();

        if (line === IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION && i + 1 < plistLines.length) {
            plistLines[i + 1] = plistLines[i + 1].replace(
                REGEX_PATTERNS.PLIST_STRING_REPLACE,
                `<string>${newVersion}</string>`
            );
        }

        if (line === IOS_PLIST_KEYS.BUNDLE_VERSION && i + 1 < plistLines.length) {
            plistLines[i + 1] = plistLines[i + 1].replace(
                REGEX_PATTERNS.PLIST_STRING_REPLACE,
                `<string>${newBuildNumber}</string>`
            );
        }
    }

    fs.writeFileSync(plistPath, plistLines.join('\n'), 'utf8');
}

async function updateIOSVersionInPbxproj(
    rootPath: string,
    newVersion: string,
    newBuildNumber: string,
    versionInfo: IOSVersionInfo
): Promise<void> {
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    const pbxprojPath = findPbxprojPath(iosPath, rootPath);

    if (!pbxprojPath) {
        throw new Error('project.pbxproj not found');
    }

    let pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

    if (versionInfo.versionVarName) {
        const patterns = [
            REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.QUOTED(versionInfo.versionVarName),
            REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SEMICOLON(versionInfo.versionVarName),
            REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SIMPLE(versionInfo.versionVarName),
        ];

        for (const pattern of patterns) {
            if (pattern.test(pbxprojContent)) {
                pbxprojContent = pbxprojContent.replaceAll(pattern, `${versionInfo.versionVarName} = ${newVersion};`);
                break;
            }
        }
    }

    if (versionInfo.buildVarName) {
        const patterns = [
            REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_QUOTED(versionInfo.buildVarName),
            REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_SIMPLE(versionInfo.buildVarName),
        ];

        for (const pattern of patterns) {
            if (pattern.test(pbxprojContent)) {
                pbxprojContent = pbxprojContent.replaceAll(pattern, `${versionInfo.buildVarName} = ${newBuildNumber};`);
                break;
            }
        }
    }

    fs.writeFileSync(pbxprojPath, pbxprojContent, 'utf8');
}

function findPbxprojPath(iosPath: string, rootPath: string): string | null {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);

    let pbxprojPath: string | null | undefined = config.get(CONFIG.IOS_PROJECT_PB_XPROJ_PATH);
    if (pbxprojPath) {
        pbxprojPath = path.join(rootPath, pbxprojPath);
        if (fs.existsSync(pbxprojPath)) {
            return pbxprojPath;
        }
    }

    try {
        const iosContents = fs.readdirSync(iosPath);
        const xcodeprojDir = iosContents.find((item) => item.endsWith(FILE_EXTENSIONS.XCODEPROJ));
        if (xcodeprojDir) {
            const autoPath = path.join(iosPath, xcodeprojDir, FILE_EXTENSIONS.PROJECT_PBXPROJ);
            if (fs.existsSync(autoPath)) {
                return autoPath;
            }
        }
    } catch {}

    return null;
}

function readAppConfigFile(configPath: string): { expoConfig: any; configPath: string } {
    try {
        const content = fs.readFileSync(configPath, 'utf8');

        validateStaticVersionConfig(content, configPath);

        const config = parseAppConfigContent(content, configPath);

        return { expoConfig: config, configPath };
    } catch (error) {
        throw new Error(
            `Failed to parse ${path.basename(configPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function validateStaticVersionConfig(content: string, configPath: string): void {
    const fileName = path.basename(configPath);

    const dynamicPatterns = [
        /version\s*:\s*process\.env/i,
        /version\s*:\s*require\(/i,
        /version\s*:\s*import\(/i,
        /version\s*:\s*\$\{/i,
        /version\s*:\s*`[^`]*\$\{/i, // template literals with variables
        /version\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/i, // function calls
        /version\s*:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\[/i, // array/object access
    ];

    for (const pattern of dynamicPatterns) {
        if (pattern.test(content)) {
            throw new Error(
                `Dynamic version configuration detected in ${fileName}. ` +
                    `For security reasons, only static string versions are supported. ` +
                    `Please use a static version like: version: '1.0.0'`
            );
        }
    }

    const staticVersionPattern = /version\s*:\s*['"`]([^'"`]+)['"`]/i;
    const expoVersionPattern = /expo\s*:\s*\{[^}]*version\s*:\s*['"`]([^'"`]+)['"`]/i;

    if (!staticVersionPattern.test(content) && !expoVersionPattern.test(content)) {
        throw new Error(
            `No static version string found in ${fileName}. ` +
                `Please define version as a static string like: version: '1.0.0' or expo: { version: '1.0.0' }`
        );
    }
}

function parseAppConfigContent(content: string, configPath: string): any {
    const fileName = path.basename(configPath);

    try {
        const config: any = {};

        const rootVersionMatch = content.match(/version\s*:\s*['"`]([^'"`]+)['"`]/i);
        if (rootVersionMatch) {
            config.version = rootVersionMatch[1];
        }

        const expoVersionMatch = content.match(/expo\s*:\s*\{[\s\S]*?version\s*:\s*['"`]([^'"`]+)['"`]/i);
        if (expoVersionMatch) {
            if (!config.expo) {
                config.expo = {};
            }
            config.expo.version = expoVersionMatch[1];
        }

        const iosBuildMatch = content.match(/ios\s*:\s*\{[\s\S]*?buildNumber\s*:\s*['"`]([^'"`]+)['"`]/i);
        if (iosBuildMatch) {
            if (!config.expo) {
                config.expo = {};
            }
            if (!config.expo.ios) {
                config.expo.ios = {};
            }
            config.expo.ios.buildNumber = iosBuildMatch[1];
        }

        const androidVersionCodeMatch = content.match(/android\s*:\s*\{[\s\S]*?versionCode\s*:\s*(\d+)/i);
        if (androidVersionCodeMatch) {
            if (!config.expo) {
                config.expo = {};
            }
            if (!config.expo.android) {
                config.expo.android = {};
            }
            config.expo.android.versionCode = parseInt(androidVersionCodeMatch[1]);
        }

        return config;
    } catch (error) {
        throw new Error(
            `Failed to extract static values from ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function writeAppConfigFile(configPath: string, config: any): void {
    try {
        const content = fs.readFileSync(configPath, 'utf8');
        let updatedContent = content;

        if (config.version) {
            updatedContent = updatedContent.replace(/version\s*:\s*['"`][^'"`]+['"`]/i, `version: '${config.version}'`);
        }

        if (config.expo?.version) {
            updatedContent = updatedContent.replace(
                /(expo\s*:\s*\{[\s\S]*?version\s*:\s*)['"`][^'"`]+['"`]/i,
                `$1'${config.expo.version}'`
            );
        }

        if (config.expo?.ios?.buildNumber) {
            updatedContent = updatedContent.replace(
                /(ios\s*:\s*\{[\s\S]*?buildNumber\s*:\s*)['"`][^'"`]+['"`]/i,
                `$1'${config.expo.ios.buildNumber}'`
            );
        }

        if (config.expo?.android?.versionCode) {
            updatedContent = updatedContent.replace(
                /(android\s*:\s*\{[\s\S]*?versionCode\s*:\s*)\d+/i,
                `$1${config.expo.android.versionCode}`
            );
        }

        fs.writeFileSync(configPath, updatedContent, 'utf8');
    } catch (error) {
        throw new Error(
            `Failed to write ${path.basename(configPath)}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

function readExpoConfig(rootPath: string): { expoConfig: any; configPath: string } {
    const appJsonPath = path.join(rootPath, FILE_EXTENSIONS.APP_JSON);
    const appConfigJsPath = path.join(rootPath, FILE_EXTENSIONS.APP_CONFIG_JS);
    const appConfigTsPath = path.join(rootPath, FILE_EXTENSIONS.APP_CONFIG_TS);

    if (fs.existsSync(appConfigTsPath)) {
        return readAppConfigFile(appConfigTsPath);
    }

    if (fs.existsSync(appConfigJsPath)) {
        return readAppConfigFile(appConfigJsPath);
    }

    if (fs.existsSync(appJsonPath)) {
        try {
            const content = fs.readFileSync(appJsonPath, 'utf8');
            const config = JSON.parse(content);
            return { expoConfig: config, configPath: appJsonPath };
        } catch (error) {
            throw new Error(`Failed to parse app.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    throw new Error('No Expo configuration file found (app.json, app.config.js, or app.config.ts)');
}

function getExpoVersion(expoConfig: any): string | null {
    if (expoConfig.expo?.version) {
        return expoConfig.expo.version;
    }
    if (expoConfig.version) {
        return expoConfig.version;
    }
    return null;
}

function updateExpoVersion(
    expoConfig: any,
    newVersion: string,
    iosBuildNumber?: string,
    androidVersionCode?: number
): void {
    if (expoConfig.expo) {
        expoConfig.expo.version = newVersion;

        if (iosBuildNumber !== undefined) {
            if (!expoConfig.expo.ios) {
                expoConfig.expo.ios = {};
            }
            expoConfig.expo.ios.buildNumber = iosBuildNumber;
        }

        if (androidVersionCode !== undefined) {
            if (!expoConfig.expo.android) {
                expoConfig.expo.android = {};
            }
            expoConfig.expo.android.versionCode = androidVersionCode;
        }
    } else {
        const expo: any = { version: newVersion };

        if (iosBuildNumber !== undefined) {
            expo.ios = { buildNumber: iosBuildNumber };
        }

        if (androidVersionCode !== undefined) {
            expo.android = { versionCode: androidVersionCode };
        }

        expoConfig.expo = expo;
    }

    if (expoConfig.version !== undefined) {
        expoConfig.version = newVersion;
    }
}

function writeExpoConfig(configPath: string, expoConfig: any): void {
    if (configPath.endsWith('.json')) {
        fs.writeFileSync(
            configPath,
            JSON.stringify(expoConfig, null, DEFAULT_VALUES.JSON_INDENT) + DEFAULT_VALUES.NEWLINE
        );
    } else if (configPath.endsWith('.js') || configPath.endsWith('.ts')) {
        writeAppConfigFile(configPath, expoConfig);
    } else {
        throw new Error('Unsupported configuration file type');
    }
}

function readEASConfig(rootPath: string): EASConfig | null {
    const easJsonPath = path.join(rootPath, FILE_EXTENSIONS.EAS_JSON);

    if (!fs.existsSync(easJsonPath)) {
        return null;
    }

    try {
        const content = fs.readFileSync(easJsonPath, 'utf8');
        return JSON.parse(content) as EASConfig;
    } catch (error) {
        console.warn(`Failed to parse eas.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return null;
    }
}

function getEASBuildProfiles(rootPath: string): EASBuildProfile[] {
    const easConfig = readEASConfig(rootPath);
    if (!easConfig?.build) {
        return [];
    }

    return Object.entries(easConfig.build).map(([name, profile]) => ({
        name,
        autoIncrement: profile.autoIncrement,
    }));
}

function hasAutoIncrementEnabled(rootPath: string): { hasAutoIncrement: boolean; profiles: string[] } {
    const profiles = getEASBuildProfiles(rootPath);
    const autoIncrementProfiles = profiles.filter(
        (profile) =>
            profile.autoIncrement === true ||
            profile.autoIncrement === 'version' ||
            profile.autoIncrement === 'buildNumber'
    );

    return {
        hasAutoIncrement: autoIncrementProfiles.length > 0,
        profiles: autoIncrementProfiles.map((p) => p.name),
    };
}

function readPackageJson(rootPath: string): { packageJson: PackageJsonContent; packageJsonPath: string } {
    const packageJsonPath = path.join(rootPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    return { packageJson, packageJsonPath };
}
