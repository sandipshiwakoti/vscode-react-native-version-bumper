import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import { INITIAL_SEMANTIC_VERSION } from '../constants';
import { BumpResult, BumpType, PackageJsonData } from '../types';

import { bumpSemanticVersion } from './versionUtils';

function readPackageJson(rootPath: string): { packageJson: PackageJsonData; packageJsonPath: string } {
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson: PackageJsonData = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return { packageJson, packageJsonPath };
}

function writePackageJson(packageJsonPath: string, packageJson: PackageJsonData): void {
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');
}

export async function bumpPackageJsonVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const { packageJson, packageJsonPath } = readPackageJson(rootPath);
    const oldVersion = packageJson.version || INITIAL_SEMANTIC_VERSION;
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
        const version = packageJson.version || INITIAL_SEMANTIC_VERSION;

        const lines = text.split('\n');
        let versionLineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('"version"')) {
                versionLineIndex = i;
                break;
            }
        }

        if (versionLineIndex !== -1) {
            const versionStartIndex = lines[versionLineIndex].indexOf('"version"');
            const position = new vscode.Position(versionLineIndex, versionStartIndex);
            const range = new vscode.Range(
                position,
                new vscode.Position(versionLineIndex, lines[versionLineIndex].length)
            );

            const patchVersion = bumpSemanticVersion(version, 'patch');
            const minorVersion = bumpSemanticVersion(version, 'minor');
            const majorVersion = bumpSemanticVersion(version, 'major');

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Patch: ${version} → ${patchVersion}`,
                    command: 'vscode-react-native-version-bumper.bumpPatch',
                    tooltip: 'Bump the patch version',
                })
            );

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Minor: ${version} → ${minorVersion}`,
                    command: 'vscode-react-native-version-bumper.bumpMinor',
                    tooltip: 'Bump the minor version',
                })
            );

            codeLenses.push(
                new vscode.CodeLens(range, {
                    title: `Bump Major: ${version} → ${majorVersion}`,
                    command: 'vscode-react-native-version-bumper.bumpMajor',
                    tooltip: 'Bump the major version',
                })
            );
        }
    } catch (error) {
        console.error('Error parsing package.json:', error);
    }

    return codeLenses;
}
