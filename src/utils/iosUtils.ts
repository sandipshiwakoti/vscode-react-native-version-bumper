import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { CONFIG_IOS_INFO_PLIST_PATH } from '../constants';
import { BumpResult, BumpType, IOSUpdateResult, IOSVersionInfo } from '../types';

import { findInfoPlistPath } from './fileUtils';
import { bumpSemanticVersion } from './versionUtils';

export function findPbxprojPath(iosPath: string, rootPath: string): string | null {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');

    let pbxprojPath: string | null | undefined = config.get('ios.projectPbxprojPath');
    if (pbxprojPath) {
        pbxprojPath = path.join(rootPath, pbxprojPath);
        if (fs.existsSync(pbxprojPath)) {
            return pbxprojPath;
        }
    }

    try {
        const iosContents = fs.readdirSync(iosPath);
        const xcodeprojDir = iosContents.find((item) => item.endsWith('.xcodeproj'));
        if (xcodeprojDir) {
            const autoPath = path.join(iosPath, xcodeprojDir, 'project.pbxproj');
            if (fs.existsSync(autoPath)) {
                return autoPath;
            }
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {}

    return null;
}

export async function readIOSVersionInfo(rootPath: string): Promise<IOSVersionInfo | null> {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const iosPath = path.join(rootPath, 'ios');

    if (!fs.existsSync(iosPath)) {
        return null;
    }

    let plistPath: string | null | undefined = config.get(CONFIG_IOS_INFO_PLIST_PATH);
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
    const usesVariables = /\$\([^)]+\)/.test(plistContent);

    let version = '';
    let buildNumber = '';
    let versionVarName = '';
    let buildVarName = '';

    if (usesVariables) {
        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes('<key>CFBundleShortVersionString</key>') && i + 1 < plistLines.length) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(/<string>\$\(([^)]+)\)<\/string>/);
                if (match) {
                    versionVarName = match[1];
                }
            }
            if (line.includes('<key>CFBundleVersion</key>') && i + 1 < plistLines.length) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(/<string>\$\(([^)]+)\)<\/string>/);
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
            if (line.includes('<key>CFBundleVersion</key>') && i + 1 < plistLines.length) {
                const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
                if (match) {
                    buildNumber = match[1];
                }
            }
            if (line.includes('<key>CFBundleShortVersionString</key>') && i + 1 < plistLines.length) {
                const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
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
    let version = '';
    let buildNumber = '';

    try {
        const pbxprojContent = fs.readFileSync(pbxprojPath, 'utf8');

        if (versionVarName) {
            const patterns = [
                new RegExp(`${versionVarName}\\s*=\\s*["']([^"']+)["']`, 'i'),
                new RegExp(`${versionVarName}\\s*=\\s*([\\d\\.]+);`, 'i'),
                new RegExp(`${versionVarName}\\s*=\\s*([\\d\\.]+)`, 'i'),
            ];

            for (const pattern of patterns) {
                const match = pbxprojContent.match(pattern);
                if (match && match[1] && !match[1].includes('$')) {
                    version = match[1];
                    break;
                }
            }
        }

        if (buildVarName) {
            const patterns = [
                new RegExp(`${buildVarName}\\s*=\\s*["']?(\\d+)["']?;`, 'i'),
                new RegExp(`${buildVarName}\\s*=\\s*(\\d+)`, 'i'),
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

    return { version, buildNumber };
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
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const iosPath = path.join(rootPath, 'ios');

    let plistPath: string | null | undefined = config.get(CONFIG_IOS_INFO_PLIST_PATH);
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
    let bundleVersionLineIndex = -1;
    let bundleShortVersionLineIndex = -1;

    for (let i = 0; i < plistLines.length; i++) {
        const line = plistLines[i].trim();
        if (line.includes('<key>CFBundleVersion</key>') && i + 1 < plistLines.length) {
            bundleVersionLineIndex = i + 1;
        }
        if (line.includes('<key>CFBundleShortVersionString</key>') && i + 1 < plistLines.length) {
            bundleShortVersionLineIndex = i + 1;
        }
    }

    if (bundleVersionLineIndex === -1 || bundleShortVersionLineIndex === -1) {
        throw new Error('Could not find CFBundleVersion or CFBundleShortVersionString in Info.plist');
    }

    plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
        /<string>[^<]+<\/string>/,
        `<string>${newBuildNumber}</string>`
    );
    plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
        /<string>[^<]+<\/string>/,
        `<string>${newVersion}</string>`
    );

    fs.writeFileSync(plistPath, plistLines.join('\n'), 'utf8');
}
export async function bumpIOSVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const iosPath = path.join(rootPath, 'ios');
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

    const iosPath = path.join(rootPath, 'ios');
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
export async function getIOSCodeLenses(document: vscode.TextDocument): Promise<vscode.CodeLens[]> {
    const codeLenses: vscode.CodeLens[] = [];

    try {
        const docPath = document.fileName;
        let rootPath = '';

        if (docPath.includes('/ios/')) {
            rootPath = docPath.split('/ios/')[0];
        } else {
            rootPath = path.dirname(path.dirname(path.dirname(docPath)));
        }

        const iosVersionInfo = await readIOSVersionInfo(rootPath);

        if (!iosVersionInfo) {
            return codeLenses;
        }

        const text = document.getText();
        const lines = text.split('\n');
        let versionLine = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('<key>CFBundleShortVersionString</key>') && i + 1 < lines.length) {
                versionLine = i + 1;
                break;
            }
        }

        if (versionLine !== -1) {
            const versionStartIndex = lines[versionLine].indexOf('<string>');
            const position = new vscode.Position(versionLine, versionStartIndex);
            const range = new vscode.Range(position, new vscode.Position(versionLine, lines[versionLine].length));

            const displayVersion = iosVersionInfo.version || '1.0.0';
            const displayBuildNumber = iosVersionInfo.buildNumber || '1';

            if (displayVersion.includes('_VERSION') || displayBuildNumber.includes('_VERSION')) {
                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Patch (iOS)`,
                        command: 'vscode-react-native-version-bumper.bumpPatch',
                        tooltip: 'Bump the iOS patch version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Minor (iOS)`,
                        command: 'vscode-react-native-version-bumper.bumpMinor',
                        tooltip: 'Bump the iOS minor version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Major (iOS)`,
                        command: 'vscode-react-native-version-bumper.bumpMajor',
                        tooltip: 'Bump the iOS major version and build number',
                    })
                );
            } else {
                const patchVersion = bumpSemanticVersion(displayVersion, 'patch');
                const minorVersion = bumpSemanticVersion(displayVersion, 'minor');
                const majorVersion = bumpSemanticVersion(displayVersion, 'major');
                const newBuildNumber = (parseInt(displayBuildNumber) + 1).toString();

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Patch: ${displayVersion} (${displayBuildNumber}) → ${patchVersion} (${newBuildNumber})`,
                        command: 'vscode-react-native-version-bumper.bumpPatch',
                        tooltip: 'Bump the iOS patch version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Minor: ${displayVersion} (${displayBuildNumber}) → ${minorVersion} (${newBuildNumber})`,
                        command: 'vscode-react-native-version-bumper.bumpMinor',
                        tooltip: 'Bump the iOS minor version and build number',
                    })
                );

                codeLenses.push(
                    new vscode.CodeLens(range, {
                        title: `Bump Major: ${displayVersion} (${displayBuildNumber}) → ${majorVersion} (${newBuildNumber})`,
                        command: 'vscode-react-native-version-bumper.bumpMajor',
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
