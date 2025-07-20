import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import {
    COMMANDS,
    CONFIG,
    DEFAULT_VALUES,
    EXTENSION_ID,
    FILE_EXTENSIONS,
    FILE_PATTERNS,
    IOS_PLIST_KEYS,
    REGEX_PATTERNS,
} from '../constants';
import { BumpResult, BumpType, IOSUpdateResult, IOSVersionInfo } from '../types';

import { findInfoPlistPath } from './fileUtils';
import { bumpSemanticVersion } from './versionUtils';

export function findPbxprojPath(iosPath: string, rootPath: string): string | null {
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
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {}

    return null;
}

export async function readIOSVersionInfo(rootPath: string): Promise<IOSVersionInfo | null> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);

    if (!fs.existsSync(iosPath)) {
        return null;
    }

    let plistPath: string | null | undefined = config.get(CONFIG.IOS_INFO_PLIST_PATH);
    if (plistPath) {
        plistPath = path.join(rootPath, plistPath);
    } else {
        plistPath = await findInfoPlistPath(iosPath);
    }

    if (!plistPath || !fs.existsSync(plistPath)) {
        return null;
    }

    const plistContent = fs.readFileSync(plistPath, 'utf8');
    const plistLines = plistContent.split('\n');
    const usesVariables = REGEX_PATTERNS.PLIST_VARIABLE.test(plistContent);

    let version = DEFAULT_VALUES.VERSION_NAME;
    let buildNumber = DEFAULT_VALUES.VERSION_NAME;
    let versionVarName = DEFAULT_VALUES.VERSION_NAME;
    let buildVarName = DEFAULT_VALUES.VERSION_NAME;

    if (usesVariables) {
        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes(IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION) && i + 1 < plistLines.length) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(REGEX_PATTERNS.PLIST_VARIABLE_MATCH);
                if (match) {
                    versionVarName = match[1];
                }
            }
            if (line.includes(IOS_PLIST_KEYS.BUNDLE_VERSION) && i + 1 < plistLines.length) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(REGEX_PATTERNS.PLIST_VARIABLE_MATCH);
                if (match) {
                    buildVarName = match[1];
                }
            }
        }

        if (versionVarName || buildVarName) {
            const pbxprojPath = findPbxprojPath(iosPath, rootPath);
            if (pbxprojPath) {
                const values = readVariableValuesFromPbxproj(pbxprojPath, versionVarName, buildVarName);
                version = values.version;
                buildNumber = values.buildNumber;
            }
        }
    } else {
        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes(IOS_PLIST_KEYS.BUNDLE_VERSION) && i + 1 < plistLines.length) {
                const match = plistLines[i + 1].trim().match(REGEX_PATTERNS.PLIST_STRING_MATCH);
                if (match) {
                    buildNumber = match[1];
                }
            }
            if (line.includes(IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION) && i + 1 < plistLines.length) {
                const match = plistLines[i + 1].trim().match(REGEX_PATTERNS.PLIST_STRING_MATCH);
                if (match) {
                    version = match[1];
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
}

function readVariableValuesFromPbxproj(
    pbxprojPath: string,
    versionVarName: string,
    buildVarName: string
): { version: string; buildNumber: string } {
    let version = DEFAULT_VALUES.VERSION_NAME;
    let buildNumber = DEFAULT_VALUES.VERSION_NAME;

    try {
        const pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

        if (versionVarName) {
            const patterns = [
                REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.QUOTED(versionVarName),
                REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SEMICOLON(versionVarName),
                REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.SIMPLE(versionVarName),
            ];

            for (const pattern of patterns) {
                const match = pbxprojContent.match(pattern);
                if (match && match[1]) {
                    version = match[1];
                    break;
                }
            }
        }

        if (buildVarName) {
            const patterns = [
                REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_QUOTED(buildVarName),
                REGEX_PATTERNS.PBXPROJ_VERSION_PATTERNS.BUILD_SIMPLE(buildVarName),
            ];

            for (const pattern of patterns) {
                const match = pbxprojContent.match(pattern);
                if (match && match[1]) {
                    buildNumber = match[1];
                    break;
                }
            }
        }
    } catch (error) {
        console.error('Error reading project.pbxproj:', error);
    }

    return { version: version || DEFAULT_VALUES.VERSION_NAME, buildNumber: buildNumber || DEFAULT_VALUES.BUILD_NUMBER };
}

export async function updateIOSVersion(
    rootPath: string,
    newVersion: string,
    incrementBuild: boolean = true
): Promise<IOSUpdateResult> {
    const versionInfo = await readIOSVersionInfo(rootPath);
    if (!versionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const oldVersion = versionInfo.version;
    const oldBuildNumber = versionInfo.buildNumber;
    const newBuildNumber = incrementBuild ? (parseInt(oldBuildNumber) + 1).toString() : oldBuildNumber;

    if (versionInfo.usesVariables) {
        await updateIOSVariables(rootPath, versionInfo, newVersion, newBuildNumber);
    } else {
        await updateIOSDirectValues(rootPath, newVersion, newBuildNumber);
    }

    return {
        oldVersion,
        oldBuildNumber,
        newVersion,
        newBuildNumber,
    };
}

async function updateIOSVariables(
    rootPath: string,
    versionInfo: IOSVersionInfo,
    newVersion: string,
    newBuildNumber: string
): Promise<void> {
    const iosPath = path.join(rootPath, 'ios');
    const pbxprojPath = findPbxprojPath(iosPath, rootPath);

    if (!pbxprojPath) {
        throw new Error('project.pbxproj not found');
    }

    let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
    const pbxLines = pbxContent.split('\n');
    let foundVersion = false;
    let foundBuildNumber = false;

    for (let i = 0; i < pbxLines.length; i++) {
        const line = pbxLines[i].trim();

        if (versionInfo.versionVarName && line.includes(versionInfo.versionVarName)) {
            const patterns = [
                {
                    regex: new RegExp(`${versionInfo.versionVarName}\\s*=\\s*"[^"]+"`),
                    replacement: `${versionInfo.versionVarName} = "${newVersion}"`,
                },
                {
                    regex: new RegExp(`${versionInfo.versionVarName}\\s*=\\s*'[^']+'`),
                    replacement: `${versionInfo.versionVarName} = '${newVersion}'`,
                },
                {
                    regex: new RegExp(`${versionInfo.versionVarName}\\s*=\\s*[^;]+;`),
                    replacement: `${versionInfo.versionVarName} = ${newVersion};`,
                },
            ];

            for (const pattern of patterns) {
                if (pattern.regex.test(pbxLines[i])) {
                    pbxLines[i] = pbxLines[i].replace(pattern.regex, pattern.replacement);
                    foundVersion = true;
                    break;
                }
            }
        }

        if (versionInfo.buildVarName && line.includes(versionInfo.buildVarName)) {
            const patterns = [
                {
                    regex: new RegExp(`${versionInfo.buildVarName}\\s*=\\s*"\\d+"`),
                    replacement: `${versionInfo.buildVarName} = "${newBuildNumber}"`,
                },
                {
                    regex: new RegExp(`${versionInfo.buildVarName}\\s*=\\s*'\\d+'`),
                    replacement: `${versionInfo.buildVarName} = '${newBuildNumber}'`,
                },
                {
                    regex: new RegExp(`${versionInfo.buildVarName}\\s*=\\s*\\d+;`),
                    replacement: `${versionInfo.buildVarName} = ${newBuildNumber};`,
                },
            ];

            for (const pattern of patterns) {
                if (pattern.regex.test(pbxLines[i])) {
                    pbxLines[i] = pbxLines[i].replace(pattern.regex, pattern.replacement);
                    foundBuildNumber = true;
                    break;
                }
            }
        }
    }

    if (!foundVersion && versionInfo.versionVarName) {
        const globalRegex = new RegExp(`${versionInfo.versionVarName}\\s*=\\s*[\\d\\.]+`, 'g');
        pbxContent = pbxContent.replace(globalRegex, `${versionInfo.versionVarName} = ${newVersion}`);
        foundVersion = true;
    }

    if (!foundBuildNumber && versionInfo.buildVarName) {
        const globalRegex = new RegExp(`${versionInfo.buildVarName}\\s*=\\s*\\d+`, 'g');
        pbxContent = pbxContent.replace(globalRegex, `${versionInfo.buildVarName} = ${newBuildNumber}`);
        foundBuildNumber = true;
    }

    if (foundVersion || foundBuildNumber) {
        const finalContent = foundVersion || foundBuildNumber ? pbxLines.join('\n') : pbxContent;
        fs.writeFileSync(pbxprojPath, finalContent, 'utf8');
    } else {
        throw new Error(
            `Could not find ${versionInfo.versionVarName} or ${versionInfo.buildVarName} in project.pbxproj`
        );
    }
}

async function updateIOSDirectValues(rootPath: string, newVersion: string, newBuildNumber: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const iosPath = path.join(rootPath, 'ios');

    let plistPath: string | null | undefined = config.get(CONFIG.IOS_INFO_PLIST_PATH);
    if (plistPath) {
        plistPath = path.join(rootPath, plistPath);
    } else {
        plistPath = await findInfoPlistPath(iosPath);
    }

    if (!plistPath || !fs.existsSync(plistPath)) {
        throw new Error('Info.plist not found');
    }

    const plistContent = fs.readFileSync(plistPath, 'utf8');
    const plistLines = plistContent.split('\n');
    let bundleVersionLineIndex = DEFAULT_VALUES.VERSION_LINE_INDEX;
    let bundleShortVersionLineIndex = DEFAULT_VALUES.VERSION_LINE_INDEX;

    for (let i = 0; i < plistLines.length; i++) {
        const line = plistLines[i].trim();
        if (line.includes(IOS_PLIST_KEYS.BUNDLE_VERSION) && i + 1 < plistLines.length) {
            bundleVersionLineIndex = i + 1;
        }
        if (line.includes(IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION) && i + 1 < plistLines.length) {
            bundleShortVersionLineIndex = i + 1;
        }
    }

    if (
        bundleVersionLineIndex === DEFAULT_VALUES.VERSION_LINE_INDEX ||
        bundleShortVersionLineIndex === DEFAULT_VALUES.VERSION_LINE_INDEX
    ) {
        throw new Error(
            `Could not find ${IOS_PLIST_KEYS.BUNDLE_VERSION} or ${IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION} in Info.plist`
        );
    }

    plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
        REGEX_PATTERNS.PLIST_STRING_REPLACE,
        `<string>${newBuildNumber}</string>`
    );
    plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
        REGEX_PATTERNS.PLIST_STRING_REPLACE,
        `<string>${newVersion}</string>`
    );

    fs.writeFileSync(plistPath, plistLines.join('\n'), 'utf8');
}
export async function bumpIOSVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    if (!fs.existsSync(iosPath)) {
        throw new Error('iOS project not found');
    }

    const currentVersionInfo = await readIOSVersionInfo(rootPath);

    if (!currentVersionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const newVersion = bumpSemanticVersion(currentVersionInfo.version, type);

    const result = await updateIOSVersion(rootPath, newVersion, true);

    return {
        platform: 'iOS',
        success: true,
        oldVersion: `${result.oldVersion} (${result.oldBuildNumber})`,
        newVersion: `${result.newVersion} (${result.newBuildNumber})`,
        message: `Build Number: ${result.oldBuildNumber} → ${result.newBuildNumber}\nVersion: ${result.oldVersion} → ${result.newVersion}`,
    };
}

export async function syncIOSVersion(
    rootPath: string,
    targetVersion: string,
    currentIOS: { buildNumber: string; version: string } | undefined
): Promise<BumpResult> {
    if (!currentIOS) {
        throw new Error('iOS version information not available');
    }

    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    if (!fs.existsSync(iosPath)) {
        throw new Error('iOS project not found');
    }

    const currentVersionInfo = await readIOSVersionInfo(rootPath);

    if (!currentVersionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const result = await updateIOSVersion(rootPath, targetVersion, true);

    return {
        platform: 'iOS',
        success: true,
        oldVersion: `${result.oldVersion} (${result.oldBuildNumber})`,
        newVersion: `${result.newVersion} (${result.newBuildNumber})`,
        message: `Build Number: ${result.oldBuildNumber} → ${result.newBuildNumber}\nVersion: ${result.oldVersion} → ${result.newVersion}`,
    };
}

export async function syncIOSVersionWithBuildNumber(
    rootPath: string,
    targetVersion: string,
    targetBuildNumber: number,
    currentIOS: { buildNumber: string; version: string } | undefined
): Promise<BumpResult> {
    if (!currentIOS) {
        throw new Error('iOS version information not available');
    }

    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    if (!fs.existsSync(iosPath)) {
        throw new Error('iOS project not found');
    }

    const currentVersionInfo = await readIOSVersionInfo(rootPath);
    if (!currentVersionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const oldVersion = currentVersionInfo.version;
    const oldBuildNumber = currentVersionInfo.buildNumber;
    const newBuildNumber = targetBuildNumber.toString();

    if (currentVersionInfo.usesVariables) {
        await updateIOSVariables(rootPath, currentVersionInfo, targetVersion, newBuildNumber);
    } else {
        await updateIOSDirectValues(rootPath, targetVersion, newBuildNumber);
    }

    return {
        platform: 'iOS',
        success: true,
        oldVersion: `${oldVersion} (${oldBuildNumber})`,
        newVersion: `${targetVersion} (${newBuildNumber})`,
        message: `Build Number: ${oldBuildNumber} → ${newBuildNumber}\nVersion: ${oldVersion} → ${targetVersion}`,
    };
}

export async function syncIOSVersionOnly(
    rootPath: string,
    targetVersion: string,
    currentIOS: { buildNumber: string; version: string } | undefined
): Promise<BumpResult> {
    if (!currentIOS) {
        throw new Error('iOS version information not available');
    }

    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    if (!fs.existsSync(iosPath)) {
        throw new Error('iOS project not found');
    }

    const currentVersionInfo = await readIOSVersionInfo(rootPath);
    if (!currentVersionInfo) {
        throw new Error('Could not read iOS version information');
    }

    const oldVersion = currentVersionInfo.version;
    const oldBuildNumber = currentVersionInfo.buildNumber;

    if (currentVersionInfo.usesVariables) {
        await updateIOSVariables(rootPath, currentVersionInfo, targetVersion, oldBuildNumber);
    } else {
        await updateIOSDirectValues(rootPath, targetVersion, oldBuildNumber);
    }

    return {
        platform: 'iOS',
        success: true,
        oldVersion: `${oldVersion} (${oldBuildNumber})`,
        newVersion: `${targetVersion} (${oldBuildNumber})`,
        message: `Build Number: ${oldBuildNumber} (unchanged)\nVersion: ${oldVersion} → ${targetVersion}`,
    };
}
export async function getIOSCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    try {
        const docPath = document.fileName;
        let rootPath = '';

        if (docPath.includes(`/${FILE_PATTERNS.IOS_FOLDER}/`)) {
            rootPath = docPath.split(`/${FILE_PATTERNS.IOS_FOLDER}/`)[0];
        } else {
            rootPath = path.dirname(path.dirname(path.dirname(docPath)));
        }

        const iosVersionInfo = await readIOSVersionInfo(rootPath);

        if (!iosVersionInfo) {
            return codeLenses;
        }

        const text = document.getText();
        const lines = text.split('\n');
        let versionLine = DEFAULT_VALUES.VERSION_LINE_INDEX;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(IOS_PLIST_KEYS.BUNDLE_SHORT_VERSION) && i + 1 < lines.length) {
                versionLine = i + 1;
                break;
            }
        }

        if (versionLine !== DEFAULT_VALUES.VERSION_LINE_INDEX) {
            const versionStartIndex = lines[versionLine].indexOf('<string>');
            const position = new vscode.Position(versionLine, versionStartIndex);
            const range = new vscode.Range(position, new vscode.Position(versionLine, lines[versionLine].length));

            const displayVersion = iosVersionInfo.version || '1.0.0';
            const displayBuildNumber = iosVersionInfo.buildNumber || DEFAULT_VALUES.BUILD_NUMBER;

            if (displayVersion.includes('_VERSION') || displayBuildNumber.includes('_VERSION')) {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Patch (iOS)`,
                        command: COMMANDS.BUMP_PATCH,
                        tooltip: 'Bump the iOS patch version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Minor (iOS)`,
                        command: COMMANDS.BUMP_MINOR,
                        tooltip: 'Bump the iOS minor version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Major (iOS)`,
                        command: COMMANDS.BUMP_MAJOR,
                        tooltip: 'Bump the iOS major version and build number',
                    })
                );
            } else {
                const patchVersion = bumpSemanticVersion(displayVersion, BumpType.PATCH);
                const minorVersion = bumpSemanticVersion(displayVersion, BumpType.MINOR);
                const majorVersion = bumpSemanticVersion(displayVersion, BumpType.MAJOR);
                const newBuildNumber = (parseInt(displayBuildNumber) + 1).toString();

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Patch: ${displayVersion} (${displayBuildNumber}) → ${patchVersion} (${newBuildNumber})`,
                        command: COMMANDS.BUMP_PATCH,
                        tooltip: 'Bump the iOS patch version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Minor: ${displayVersion} (${displayBuildNumber}) → ${minorVersion} (${newBuildNumber})`,
                        command: COMMANDS.BUMP_MINOR,
                        tooltip: 'Bump the iOS minor version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Major: ${displayVersion} (${displayBuildNumber}) → ${majorVersion} (${newBuildNumber})`,
                        command: COMMANDS.BUMP_MAJOR,
                        tooltip: 'Bump the iOS major version and build number',
                    })
                );
            }
        }
    } catch (error) {
        console.error('Error providing iOS CodeLenses:', error);
    }

    return codeLenses;
}
