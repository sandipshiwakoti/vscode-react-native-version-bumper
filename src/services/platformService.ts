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
    IOSUpdateResult,
    IOSVersionInfo,
    PackageJsonContent,
    Platform,
    PlatformConfig,
    PlatformType,
} from '../types';
import { findInfoPlistPath } from '../utils/fileUtils';
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

export function getPackageJsonCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    // Get workspace root path
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
                    // Fallback to simple labels if version can't be read
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
                // Fallback to simple labels if there's an error
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

    // Get workspace root path
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
                    // Fallback to simple labels if version can't be read
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
                // Fallback to simple labels if there's an error
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

    // Get workspace root path
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
                    // Fallback to simple labels if version can't be read
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
                // Fallback to simple labels if there's an error
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

    // Check for custom Info.plist path first
    let plistPath: string | null = null;
    const customPlistPath = config.get<string>(CONFIG.IOS_INFO_PLIST_PATH);

    if (customPlistPath) {
        const fullCustomPath = path.join(rootPath, customPlistPath);
        if (fs.existsSync(fullCustomPath)) {
            plistPath = fullCustomPath;
        }
    }

    // Fall back to auto-detection if custom path not found
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
                        pbxprojContent.match(REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.QUOTED(versionVarName)) ||
                        pbxprojContent.match(REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SEMICOLON(versionVarName)) ||
                        pbxprojContent.match(REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SIMPLE(versionVarName));
                    if (versionMatch) {
                        version = versionMatch[1];
                    }
                }

                if (buildVarName) {
                    const buildMatch =
                        pbxprojContent.match(REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_QUOTED(buildVarName)) ||
                        pbxprojContent.match(REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_SIMPLE(buildVarName));
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

    // Check for custom Info.plist path first
    let plistPath: string | null = null;
    const customPlistPath = config.get<string>(CONFIG.IOS_INFO_PLIST_PATH);

    if (customPlistPath) {
        const fullCustomPath = path.join(rootPath, customPlistPath);
        if (fs.existsSync(fullCustomPath)) {
            plistPath = fullCustomPath;
        }
    }

    // Fall back to auto-detection if custom path not found
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

function readPackageJson(rootPath: string): { packageJson: PackageJsonContent; packageJsonPath: string } {
    const packageJsonPath = path.join(rootPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent);

    return { packageJson, packageJsonPath };
}
