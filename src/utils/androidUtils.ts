import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import {
    ANDROID_GRADLE_KEYS,
    COMMANDS,
    CONFIG,
    DEFAULT_VALUES,
    EXTENSION_ID,
    FILE_PATTERNS,
    REGEX_PATTERNS,
} from '../constants';
import { AndroidVersionInfo, BumpResult, BumpType } from '../types';

import { bumpSemanticVersion } from './versionUtils';

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

    if (
        versionCodeLineIndex === DEFAULT_VALUES.VERSION_LINE_INDEX ||
        versionNameLineIndex === DEFAULT_VALUES.VERSION_LINE_INDEX
    ) {
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
        REGEX_PATTERNS.VERSION_CODE_REPLACE,
        `${ANDROID_GRADLE_KEYS.VERSION_CODE} ${newVersionCode}`
    );
    versionInfo.lines[versionInfo.versionNameLineIndex] = versionInfo.lines[versionInfo.versionNameLineIndex].replace(
        REGEX_PATTERNS.VERSION_NAME_REPLACE,
        `${ANDROID_GRADLE_KEYS.VERSION_NAME} "${newVersionName}"`
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
    let versionNameLine = DEFAULT_VALUES.VERSION_LINE_INDEX;
    let versionCode = 1;
    let versionName = '1.0.0';

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes(ANDROID_GRADLE_KEYS.DEFAULT_CONFIG)) {
            inDefaultConfig = true;
            continue;
        }

        if (inDefaultConfig && line === ANDROID_GRADLE_KEYS.CLOSING_BRACE) {
            inDefaultConfig = false;
            continue;
        }

        if (inDefaultConfig) {
            if (line.includes(ANDROID_GRADLE_KEYS.VERSION_CODE)) {
                const match = line.match(REGEX_PATTERNS.VERSION_CODE);
                if (match) {
                    versionCode = parseInt(match[1]);
                }
            }

            if (line.includes(ANDROID_GRADLE_KEYS.VERSION_NAME)) {
                versionNameLine = i;
                const match = line.match(REGEX_PATTERNS.VERSION_NAME);
                if (match) {
                    versionName = match[1];
                }
            }
        }
    }

    if (versionNameLine !== DEFAULT_VALUES.VERSION_LINE_INDEX) {
        const versionStartIndex = lines[versionNameLine].indexOf(ANDROID_GRADLE_KEYS.VERSION_NAME);
        const position = new vscode.Position(versionNameLine, versionStartIndex);
        const range = new vscode.Range(position, new vscode.Position(versionNameLine, lines[versionNameLine].length));

        const patchVersion = bumpSemanticVersion(versionName, BumpType.PATCH);
        const minorVersion = bumpSemanticVersion(versionName, BumpType.MINOR);
        const majorVersion = bumpSemanticVersion(versionName, BumpType.MAJOR);
        const newVersionCode = versionCode + 1;

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Patch: ${versionName} (${versionCode}) → ${patchVersion} (${newVersionCode})`,
                command: COMMANDS.BUMP_PATCH,
                tooltip: 'Bump the Android patch version and version code',
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Minor: ${versionName} (${versionCode}) → ${minorVersion} (${newVersionCode})`,
                command: COMMANDS.BUMP_MINOR,
                tooltip: 'Bump the Android minor version and version code',
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Major: ${versionName} (${versionCode}) → ${majorVersion} (${newVersionCode})`,
                command: COMMANDS.BUMP_MAJOR,
                tooltip: 'Bump the Android major version and version code',
            })
        );
    }

    return codeLenses;
}
