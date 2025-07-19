import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import { CONFIG_ANDROID_BUILD_GRADLE_PATH } from '../constants';
import { AndroidVersionInfo, BumpResult, BumpType } from '../types';

import { bumpSemanticVersion } from './versionUtils';

function readAndroidVersionInfo(rootPath: string): AndroidVersionInfo {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const buildGradleConfigPath = config.get(
        CONFIG_ANDROID_BUILD_GRADLE_PATH,
        path.join('android', 'app', 'build.gradle')
    );
    const buildGradlePath = path.join(rootPath, buildGradleConfigPath);

    if (!fs.existsSync(buildGradlePath)) {
        throw new Error(`Android build.gradle not found at ${buildGradlePath}`);
    }

    const content = fs.readFileSync(buildGradlePath, 'utf8');
    const lines = content.split('\n');
    let versionCode = 0;
    let versionName = '';
    let versionCodeLineIndex = -1;
    let versionNameLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('versionCode')) {
            const match = line.match(/versionCode\s+(\d+)/);
            if (match) {
                versionCode = parseInt(match[1]);
                versionCodeLineIndex = i;
            }
        }
        if (line.startsWith('versionName')) {
            const match = line.match(/versionName\s+["']([^"']+)["']/);
            if (match) {
                versionName = match[1];
                versionNameLineIndex = i;
            }
        }
    }

    if (versionCodeLineIndex === -1 || versionNameLineIndex === -1) {
        throw new Error('Could not find version information in build.gradle');
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

function writeAndroidVersionInfo(
    versionInfo: AndroidVersionInfo,
    newVersionCode: number,
    newVersionName: string
): void {
    versionInfo.lines[versionInfo.versionCodeLineIndex] = versionInfo.lines[versionInfo.versionCodeLineIndex].replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );
    versionInfo.lines[versionInfo.versionNameLineIndex] = versionInfo.lines[versionInfo.versionNameLineIndex].replace(
        /versionName\s+["'][^"']+["']/,
        `versionName "${newVersionName}"`
    );
    fs.writeFileSync(versionInfo.buildGradlePath, versionInfo.lines.join('\n'), 'utf8');
}

export async function bumpAndroidVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const versionInfo = readAndroidVersionInfo(rootPath);
    const newVersionCode = versionInfo.versionCode + 1;
    const newVersionName = bumpSemanticVersion(versionInfo.versionName, type);

    writeAndroidVersionInfo(versionInfo, newVersionCode, newVersionName);

    return {
        platform: 'Android',
        success: true,
        oldVersion: `${versionInfo.versionName} (${versionInfo.versionCode})`,
        newVersion: `${newVersionName} (${newVersionCode})`,
        message: `Version Name: ${versionInfo.versionName} → ${newVersionName}\nVersion Code: ${versionInfo.versionCode} → ${newVersionCode}`,
    };
}

export async function syncAndroidVersion(
    rootPath: string,
    targetVersion: string,
    currentAndroid: { versionCode: number; versionName: string } | undefined
): Promise<BumpResult> {
    if (!currentAndroid) {
        throw new Error('Android version information not available');
    }

    const versionInfo = readAndroidVersionInfo(rootPath);
    const newVersionCode = versionInfo.versionCode + 1;
    const oldVersionDisplay = `${versionInfo.versionName} (${versionInfo.versionCode})`;
    const newVersionDisplay = `${targetVersion} (${newVersionCode})`;

    writeAndroidVersionInfo(versionInfo, newVersionCode, targetVersion);

    return {
        platform: 'Android',
        success: true,
        oldVersion: oldVersionDisplay,
        newVersion: newVersionDisplay,
        message: `Version Name: ${versionInfo.versionName} → ${targetVersion}\nVersion Code: ${versionInfo.versionCode} → ${newVersionCode}`,
    };
}

export function getAndroidCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let inDefaultConfig = false;
    let versionNameLine = -1;
    let versionCode = 1;
    let versionName = '1.0.0';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes('defaultConfig {')) {
            inDefaultConfig = true;
            continue;
        }

        if (inDefaultConfig && line === '}') {
            inDefaultConfig = false;
            continue;
        }

        if (inDefaultConfig) {
            if (line.includes('versionCode')) {
                const match = line.match(/versionCode\s+(\d+)/);
                if (match) {
                    versionCode = parseInt(match[1]);
                }
            }

            if (line.includes('versionName')) {
                versionNameLine = i;
                const match = line.match(/versionName\s+["']([^"']+)["']/);
                if (match) {
                    versionName = match[1];
                }
            }
        }
    }

    if (versionNameLine !== -1) {
        const versionStartIndex = lines[versionNameLine].indexOf('versionName');
        const position = new vscode.Position(versionNameLine, versionStartIndex);
        const range = new vscode.Range(position, new vscode.Position(versionNameLine, lines[versionNameLine].length));

        const patchVersion = bumpSemanticVersion(versionName, 'patch');
        const minorVersion = bumpSemanticVersion(versionName, 'minor');
        const majorVersion = bumpSemanticVersion(versionName, 'major');
        const newVersionCode = versionCode + 1;

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Patch: ${versionName} (${versionCode}) → ${patchVersion} (${newVersionCode})`,
                command: 'vscode-react-native-version-bumper.bumpPatch',
                tooltip: 'Bump the Android patch version and version code',
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Minor: ${versionName} (${versionCode}) → ${minorVersion} (${newVersionCode})`,
                command: 'vscode-react-native-version-bumper.bumpMinor',
                tooltip: 'Bump the Android minor version and version code',
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Major: ${versionName} (${versionCode}) → ${majorVersion} (${newVersionCode})`,
                command: 'vscode-react-native-version-bumper.bumpMajor',
                tooltip: 'Bump the Android major version and version code',
            })
        );
    }

    return codeLenses;
}
