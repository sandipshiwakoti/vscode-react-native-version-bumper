import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { INITIAL_SEMANTIC_VERSION } from '../constants';
import { isCodeLensEnabled } from '../extension';
import { bumpSemanticVersion } from '../utils/versionUtils';

export class VersionCodeLensProvider implements vscode.CodeLensProvider, vscode.Disposable {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    private _disposable: vscode.Disposable;

    constructor() {
        this._disposable = vscode.workspace.onDidChangeTextDocument((e) => {
            if (
                e.document.fileName.endsWith('package.json') ||
                e.document.fileName.endsWith('build.gradle') ||
                e.document.fileName.endsWith('Info.plist')
            ) {
                this._onDidChangeCodeLenses.fire();
            }
        });
    }

    public refresh(): void {
        this._onDidChangeCodeLenses.fire();
    }

    public dispose(): void {
        this._onDidChangeCodeLenses.dispose();
        this._disposable.dispose();
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        if (!isCodeLensEnabled()) {
            return [];
        }

        if (document.fileName.endsWith('package.json')) {
            return this.providePackageJsonCodeLenses(document);
        }

        if (document.fileName.endsWith('build.gradle')) {
            return this.provideBuildGradleCodeLenses(document);
        }

        if (document.fileName.endsWith('Info.plist')) {
            return this.provideIOSCodeLenses(document, token);
        }

        return [];
    }

    private providePackageJsonCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
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

                this.addPackageJsonCodeLenses(codeLenses, range, version);
            }
        } catch (error) {
            console.error('Error parsing package.json:', error);
        }

        return codeLenses;
    }

    private provideBuildGradleCodeLenses(document: vscode.TextDocument): vscode.ProviderResult<vscode.CodeLens[]> {
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
            const range = new vscode.Range(
                position,
                new vscode.Position(versionNameLine, lines[versionNameLine].length)
            );

            this.addAndroidCodeLenses(codeLenses, range, versionName, versionCode);
        }

        return codeLenses;
    }

    private provideIOSCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split('\n');

        let versionLine = -1;
        let version = '';
        let buildNumber = '';
        let usesVariables = false;
        let versionVarName = '';
        let buildVarName = '';

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('<key>CFBundleShortVersionString</key>') && i + 1 < lines.length) {
                versionLine = i + 1;
                const varMatch = lines[versionLine].match(/<string>\$\(([^)]+)\)<\/string>/);
                if (varMatch) {
                    usesVariables = true;
                    versionVarName = varMatch[1];
                    version = versionVarName;
                } else {
                    const match = lines[versionLine].match(/<string>([^<]+)<\/string>/);
                    if (match) {
                        version = match[1];
                    }
                }
            }

            if (lines[i].includes('<key>CFBundleVersion</key>') && i + 1 < lines.length) {
                const varMatch = lines[i + 1].match(/<string>\$\(([^)]+)\)<\/string>/);
                if (varMatch) {
                    usesVariables = true;
                    buildVarName = varMatch[1];
                    buildNumber = buildVarName;
                } else {
                    const match = lines[i + 1].match(/<string>([^<]+)<\/string>/);
                    if (match) {
                        buildNumber = match[1];
                    }
                }
            }
        }

        if (usesVariables) {
            try {
                const docPath = document.fileName;
                let iosDir = '';

                if (docPath.includes('/ios/')) {
                    iosDir = docPath.split('/ios/')[0] + '/ios';
                } else {
                    iosDir = path.dirname(path.dirname(docPath));
                }

                let pbxprojPath: string | null = null;
                if (fs.existsSync(iosDir)) {
                    const iosContents = fs.readdirSync(iosDir);
                    const xcodeprojDir = iosContents.find((item) => item.endsWith('.xcodeproj'));
                    if (xcodeprojDir) {
                        pbxprojPath = path.join(iosDir, xcodeprojDir, 'project.pbxproj');
                    }
                }

                if (pbxprojPath && fs.existsSync(pbxprojPath)) {
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
                }
            } catch (error) {
                console.error('Error reading project.pbxproj:', error);
            }
        }

        if (versionLine !== -1) {
            const versionStartIndex = lines[versionLine].indexOf('<string>');
            const position = new vscode.Position(versionLine, versionStartIndex);
            const range = new vscode.Range(position, new vscode.Position(versionLine, lines[versionLine].length));

            this.addIOSCodeLenses(codeLenses, range, version, buildNumber);
        }

        return codeLenses;
    }

    private addPackageJsonCodeLenses(codeLenses: vscode.CodeLens[], range: vscode.Range, version: string): void {
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

    private addAndroidCodeLenses(
        codeLenses: vscode.CodeLens[],
        range: vscode.Range,
        versionName: string,
        versionCode: number
    ): void {
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

    private addIOSCodeLenses(
        codeLenses: vscode.CodeLens[],
        range: vscode.Range,
        version: string,
        buildNumber: string
    ): void {
        const displayVersion = version || '1.0.0';
        const displayBuildNumber = buildNumber || '1';

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
}

export function registerVersionCodeLensProvider(
    context: vscode.ExtensionContext,
    codeLensProvider: VersionCodeLensProvider
): vscode.Disposable {
    const disposable = vscode.languages.registerCodeLensProvider(
        [
            { language: 'json', pattern: '**/package.json' },
            { pattern: '**/build.gradle' },
            { pattern: '**/Info.plist' },
        ],
        codeLensProvider
    );

    context.subscriptions.push(disposable);
    return disposable;
}
