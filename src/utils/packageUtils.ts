import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import { COMMANDS, DEFAULT_VALUES, FILE_EXTENSIONS } from '../constants';
import { BumpResult, BumpType, PackageJsonData } from '../types';

import { bumpSemanticVersion } from './versionUtils';

function readPackageJson(rootPath: string): { packageJson: PackageJsonData; packageJsonPath: string } {
    const packageJsonPath = path.join(rootPath, FILE_EXTENSIONS.PACKAGE_JSON);
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson: PackageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return { packageJson, packageJsonPath };
}

function writePackageJson(packageJsonPath: string, packageJson: PackageJsonData): void {
    fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, DEFAULT_VALUES.JSON_INDENT) + DEFAULT_VALUES.NEWLINE,
        'utf8'
    );
}

export async function bumpPackageJsonVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const { packageJson, packageJsonPath } = readPackageJson(rootPath);
    const oldVersion = packageJson.version || DEFAULT_VALUES.SEMANTIC_VERSION;
    const newVersion = bumpSemanticVersion(oldVersion, type);

    packageJson.version = newVersion;
    writePackageJson(packageJsonPath, packageJson);

    return {
        platform: 'Package.json',
        success: true,
        oldVersion,
        newVersion,
        message: `Version: ${oldVersion} → ${newVersion}`,
    };
}

export async function syncPackageJsonVersion(
    rootPath: string,
    targetVersion: string,
    currentVersion: string
): Promise<BumpResult> {
    const { packageJson, packageJsonPath } = readPackageJson(rootPath);
    const oldVersion = packageJson.version || currentVersion;

    if (oldVersion === targetVersion) {
        return {
            platform: 'Package.json',
            success: true,
            oldVersion,
            newVersion: targetVersion,
            message: `Version: ${targetVersion} (no change needed)`,
        };
    }

    packageJson.version = targetVersion;
    writePackageJson(packageJsonPath, packageJson);

    return {
        platform: 'Package.json',
        success: true,
        oldVersion,
        newVersion: targetVersion,
        message: `Version: ${oldVersion} → ${targetVersion}`,
    };
}

export function getPackageJsonVersion(rootPath: string): string | null {
    try {
        const { packageJson } = readPackageJson(rootPath);
        return packageJson.version || null;
    } catch {
        return null;
    }
}

export function getPackageJsonName(rootPath: string): string | null {
    try {
        const { packageJson } = readPackageJson(rootPath);
        return packageJson.name || null;
    } catch {
        return null;
    }
}
export function getPackageJsonCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();

    try {
        const packageJson = JSON.parse(text);
        const version = packageJson.version || DEFAULT_VALUES.SEMANTIC_VERSION;

        const lines = text.split('\n');
        let versionLineIndex = DEFAULT_VALUES.VERSION_LINE_INDEX;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('"version"')) {
                versionLineIndex = i;
                break;
            }
        }

        if (versionLineIndex !== DEFAULT_VALUES.VERSION_LINE_INDEX) {
            const versionStartIndex = lines[versionLineIndex].indexOf('"version"');
            const position = new vscode.Position(versionLineIndex, versionStartIndex);
            const range = new vscode.Range(
                position,
                new vscode.Position(versionLineIndex, lines[versionLineIndex].length)
            );

            const patchVersion = bumpSemanticVersion(version, BumpType.PATCH);
            const minorVersion = bumpSemanticVersion(version, BumpType.MINOR);
            const majorVersion = bumpSemanticVersion(version, BumpType.MAJOR);

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Patch: ${version} → ${patchVersion}`,
                    command: COMMANDS.BUMP_PATCH,
                    tooltip: 'Bump the patch version',
                })
            );

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Minor: ${version} → ${minorVersion}`,
                    command: COMMANDS.BUMP_MINOR,
                    tooltip: 'Bump the minor version',
                })
            );

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Major: ${version} → ${majorVersion}`,
                    command: COMMANDS.BUMP_MAJOR,
                    tooltip: 'Bump the major version',
                })
            );
        }
    } catch (error) {
        console.error('Error parsing package.json:', error);
    }

    return codeLenses;
}
