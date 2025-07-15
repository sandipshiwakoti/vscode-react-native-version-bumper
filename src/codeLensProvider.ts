import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { bumpSemanticVersion } from "./extension";

// CodeLens provider for package.json and build.gradle files that shows version information and provides quick actions for version bumping.
export class VersionCodeLensProvider
    implements vscode.CodeLensProvider, vscode.Disposable
{
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> =
        this._onDidChangeCodeLenses.event;
    private _disposable: vscode.Disposable;

    constructor() {
        // Watch for changes to package.json and build.gradle files to refresh CodeLens
        this._disposable = vscode.workspace.onDidChangeTextDocument((e) => {
            if (
                e.document.fileName.endsWith("package.json") ||
                e.document.fileName.endsWith("build.gradle")
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
        const config = vscode.workspace.getConfiguration(
            "reactNativeVersionBumper"
        );
        if (!config.get("enableCodeLens", true)) {
            return [];
        }

        // Handle package.json files
        if (document.fileName.endsWith("package.json")) {
            return this.providePackageJsonCodeLenses(document, token);
        }

        // Handle build.gradle files
        if (document.fileName.endsWith("build.gradle")) {
            return this.provideBuildGradleCodeLenses(document, token);
        }

        // Handle Info.plist files
        if (document.fileName.endsWith("Info.plist")) {
            return this.provideIOSCodeLenses(document, token);
        }

        // Not a supported file
        console.log("Not a supported file, returning empty array");
        return [];
    }

    private providePackageJsonCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();

        try {
            const packageJson = JSON.parse(text);
            const version = packageJson.version || "0.0.0";

            // Find the position of the "version" field in the document
            const lines = text.split("\n");
            let versionLineIndex = -1;
            let versionLineText = "";

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('"version"')) {
                    versionLineIndex = i;
                    versionLineText = lines[i];
                    break;
                }
            }

            if (versionLineIndex !== -1) {
                const versionStartIndex = versionLineText.indexOf('"version"');
                const position = new vscode.Position(
                    versionLineIndex,
                    versionStartIndex
                );
                const range = new vscode.Range(
                    position,
                    new vscode.Position(
                        versionLineIndex,
                        versionLineText.length
                    )
                );

                // Add CodeLenses for package.json - pass the version parameter
                this.addPackageJsonCodeLenses(codeLenses, range, version);
            }
        } catch (error) {
            console.error("Error parsing package.json:", error);
        }

        return codeLenses;
    }

    private provideBuildGradleCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split("\n");

        // Find versionCode and versionName in build.gradle
        let inDefaultConfig = false;
        let versionCodeLine = -1;
        let versionNameLine = -1;
        let versionCodeText = "";
        let versionNameText = "";
        let versionCode = 1;
        let versionName = "1.0.0";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check if we're in the defaultConfig block
            if (line.includes("defaultConfig {")) {
                inDefaultConfig = true;
                continue;
            }

            // Check if we're exiting the defaultConfig block
            if (inDefaultConfig && line === "}") {
                inDefaultConfig = false;
                continue;
            }

            // Look for versionCode and versionName within defaultConfig
            if (inDefaultConfig) {
                if (line.includes("versionCode")) {
                    versionCodeLine = i;
                    versionCodeText = line;
                    const match = line.match(/versionCode\s+(\d+)/);
                    if (match) {
                        versionCode = parseInt(match[1]);
                    }
                }

                if (line.includes("versionName")) {
                    versionNameLine = i;
                    versionNameText = line;
                    const match = line.match(/versionName\s+["']([^"']+)["']/);
                    if (match) {
                        versionName = match[1];
                    }
                }
            }
        }

        // Add CodeLens for versionName if found
        if (versionNameLine !== -1) {
            const versionStartIndex =
                lines[versionNameLine].indexOf("versionName");
            const position = new vscode.Position(
                versionNameLine,
                versionStartIndex
            );
            const range = new vscode.Range(
                position,
                new vscode.Position(
                    versionNameLine,
                    lines[versionNameLine].length
                )
            );

            // Add CodeLenses for build.gradle - pass versionName and versionCode
            this.addAndroidCodeLenses(
                codeLenses,
                range,
                versionName,
                versionCode
            );
        }

        return codeLenses;
    }

    private addPackageJsonCodeLenses(
        codeLenses: vscode.CodeLens[],
        range: vscode.Range,
        version: string
    ): void {
        const patchVersion = bumpSemanticVersion(version, "patch");
        const minorVersion = bumpSemanticVersion(version, "minor");
        const majorVersion = bumpSemanticVersion(version, "major");

        // Add CodeLens for bumping version
        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Patch: ${version} → ${patchVersion}`,
                command: "react-native-version-bumper.bumpPatch",
                tooltip: "Bump the patch version",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Minor: ${version} → ${minorVersion}`,
                command: "react-native-version-bumper.bumpMinor",
                tooltip: "Bump the minor version",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Major: ${version} → ${majorVersion}`,
                command: "react-native-version-bumper.bumpMajor",
                tooltip: "Bump the major version",
            })
        );
    }

    private addAndroidCodeLenses(
        codeLenses: vscode.CodeLens[],
        range: vscode.Range,
        versionName: string,
        versionCode: number
    ): void {
        const patchVersion = bumpSemanticVersion(versionName, "patch");
        const minorVersion = bumpSemanticVersion(versionName, "minor");
        const majorVersion = bumpSemanticVersion(versionName, "major");
        const newVersionCode = versionCode + 1;

        // Add Android-specific CodeLenses
        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Patch: ${versionName} (${versionCode}) → ${patchVersion} (${newVersionCode})`,
                command: "react-native-version-bumper.bumpPatch",
                tooltip: "Bump the Android patch version and version code",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Minor: ${versionName} (${versionCode}) → ${minorVersion} (${newVersionCode})`,
                command: "react-native-version-bumper.bumpMinor",
                tooltip: "Bump the Android minor version and version code",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Major: ${versionName} (${versionCode}) → ${majorVersion} (${newVersionCode})`,
                command: "react-native-version-bumper.bumpMajor",
                tooltip: "Bump the Android major version and version code",
            })
        );
    }

    // Add a new method to handle iOS files
    private provideIOSCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.CodeLens[]> {
        const codeLenses: vscode.CodeLens[] = [];
        const text = document.getText();
        const lines = text.split("\n");

        // Find CFBundleShortVersionString and CFBundleVersion in Info.plist
        let versionLine = -1;
        let buildNumberLine = -1;
        let version = "";
        let buildNumber = "";
        let usesVariables = false;
        let versionVarName = "";
        let buildVarName = "";

        for (let i = 0; i < lines.length; i++) {
            if (
                lines[i].includes("<key>CFBundleShortVersionString</key>") &&
                i + 1 < lines.length
            ) {
                versionLine = i + 1;
                const varMatch = lines[versionLine].match(
                    /<string>\$\(([^)]+)\)<\/string>/
                );
                if (varMatch) {
                    // This is a variable reference like $(APP_VERSION_NAME)
                    usesVariables = true;
                    versionVarName = varMatch[1];
                    version = versionVarName; // Store the variable name
                } else {
                    const match = lines[versionLine].match(
                        /<string>([^<]+)<\/string>/
                    );
                    if (match) {
                        version = match[1];
                    }
                }
            }

            if (
                lines[i].includes("<key>CFBundleVersion</key>") &&
                i + 1 < lines.length
            ) {
                buildNumberLine = i + 1;
                const varMatch = lines[buildNumberLine].match(
                    /<string>\$\(([^)]+)\)<\/string>/
                );
                if (varMatch) {
                    // This is a variable reference like $(APP_VERSION_CODE)
                    usesVariables = true;
                    buildVarName = varMatch[1];
                    buildNumber = buildVarName; // Store the variable name
                } else {
                    const match = lines[buildNumberLine].match(
                        /<string>([^<]+)<\/string>/
                    );
                    if (match) {
                        buildNumber = match[1];
                    }
                }
            }
        }

        // If using variables, try to find their values in project.pbxproj
        if (usesVariables) {
            try {
                // Try to find the project.pbxproj file in the same directory
                const docDir = path.dirname(document.fileName);
                const pbxprojPath = path.join(docDir, "project.pbxproj");

                if (fs.existsSync(pbxprojPath)) {
                    const pbxprojContent = fs.readFileSync(pbxprojPath, "utf8");

                    // Extract version and build number values
                    if (versionVarName) {
                        const versionMatch = pbxprojContent.match(
                            new RegExp(
                                `${versionVarName}\\s*=\\s*["']?([\\d\\.]+)["']?`
                            )
                        );
                        if (versionMatch) {
                            version = versionMatch[1];
                        }
                    }

                    if (buildVarName) {
                        const buildMatch = pbxprojContent.match(
                            new RegExp(
                                `${buildVarName}\\s*=\\s*["']?(\\d+)["']?`
                            )
                        );
                        if (buildMatch) {
                            buildNumber = buildMatch[1];
                        }
                    }
                }
            } catch (error) {
                console.error("Error reading project.pbxproj:", error);
            }
        }

        // Add CodeLens for version if found
        if (versionLine !== -1) {
            const versionStartIndex = lines[versionLine].indexOf("<string>");
            const position = new vscode.Position(
                versionLine,
                versionStartIndex
            );
            const range = new vscode.Range(
                position,
                new vscode.Position(versionLine, lines[versionLine].length)
            );

            this.addIOSCodeLenses(codeLenses, range, version, buildNumber);
        }

        return codeLenses;
    }

    private addIOSCodeLenses(
        codeLenses: vscode.CodeLens[],
        range: vscode.Range,
        version: string,
        buildNumber: string
    ): void {
        const patchVersion = bumpSemanticVersion(version, "patch");
        const minorVersion = bumpSemanticVersion(version, "minor");
        const majorVersion = bumpSemanticVersion(version, "major");
        const newBuildNumber = (parseInt(buildNumber) + 1).toString();

        // Add iOS-specific CodeLenses
        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Patch: ${version} (${buildNumber}) → ${patchVersion} (${newBuildNumber})`,
                command: "react-native-version-bumper.bumpPatch",
                tooltip: "Bump the iOS patch version and build number",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Minor: ${version} (${buildNumber}) → ${minorVersion} (${newBuildNumber})`,
                command: "react-native-version-bumper.bumpMinor",
                tooltip: "Bump the iOS minor version and build number",
            })
        );

        codeLenses.push(
            new vscode.CodeLens(range, {
                title: `Bump Major: ${version} (${buildNumber}) → ${majorVersion} (${newBuildNumber})`,
                command: "react-native-version-bumper.bumpMajor",
                tooltip: "Bump the iOS major version and build number",
            })
        );
    }
}

// Register the CodeLens provider for package.json and build.gradle files
export function registerVersionCodeLensProvider(
    context: vscode.ExtensionContext,
    codeLensProvider: VersionCodeLensProvider
): vscode.Disposable {
    const disposable = vscode.languages.registerCodeLensProvider(
        [
            { language: "json", pattern: "**/package.json" },
            { pattern: "**/build.gradle" },
            { pattern: "**/Info.plist" },
        ],
        codeLensProvider
    );

    context.subscriptions.push(disposable);
    return disposable;
}
