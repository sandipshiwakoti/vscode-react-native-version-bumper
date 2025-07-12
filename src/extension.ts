import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

type BumpType = "major" | "minor" | "patch";
type ProjectType = "react-native";
type PlatformKey = "Package.json" | "Android" | "iOS" | "Git";
interface BumpResult {
    platform: string;
    success: boolean;
    oldVersion: string;
    newVersion: string;
    message: string;
    error?: string;
}

interface ProjectVersions {
    packageJson?: string;
    android?: { versionCode: number; versionName: string };
    ios?: { buildNumber: string; version: string };
}

interface GitConfig {
    autoCommit: boolean;
    commitMessage: string;
    createTags: boolean;
    pushToRemote: boolean;
}

let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.command = "react-native-version-bumper.showVersions";
    updateStatusBar();
    statusBarItem.show();

    // Register commands
    const commands = [
        vscode.commands.registerCommand(
            "react-native-version-bumper.bumpAppVersion",
            () => bumpAppVersion(false)
        ),
        vscode.commands.registerCommand(
            "react-native-version-bumper.bumpVersionAndCommit",
            () => bumpAppVersion(true)
        ),
        vscode.commands.registerCommand(
            "react-native-version-bumper.showVersions",
            () => showCurrentVersions()
        ),
    ];

    context.subscriptions.push(statusBarItem, ...commands);

    // Update status bar when workspace changes
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
        updateStatusBar();
    });
}

async function bumpAppVersion(withGit: boolean) {
    const versions = await getCurrentVersions();
    const androidVersion = versions.android
        ? versions.android.versionName
        : "0.0.0";
    const iosVersion = versions.ios ? versions.ios.version : "0.0.0";
    const packageJsonVersion = versions.packageJson || "0.0.0";

    // Calculate bumped versions for each type
    const bumpPatchVersion = (version: string) =>
        bumpSemanticVersion(version, "patch");
    const bumpMinorVersion = (version: string) =>
        bumpSemanticVersion(version, "minor");
    const bumpMajorVersion = (version: string) =>
        bumpSemanticVersion(version, "major");

    const bumpType = await vscode.window.showQuickPick(
        [
            {
                label: `🔧 Patch (Android: v${bumpPatchVersion(androidVersion)}, iOS: v${bumpPatchVersion(iosVersion)})`,
                value: "patch",
            },
            {
                label: `⬆️ Minor (Android: v${bumpMinorVersion(androidVersion)}, iOS: v${bumpMinorVersion(iosVersion)})`,
                value: "minor",
            },
            {
                label: `🚀 Major (Android: v${bumpMajorVersion(androidVersion)}, iOS: v${bumpMajorVersion(iosVersion)})`,
                value: "major",
            },
        ],
        { placeHolder: "Select version bump type" }
    );

    if (!bumpType) return;

    const includePackageJson = await vscode.window.showQuickPick(
        [
            { label: "Yes", value: true },
            { label: "No", value: false },
        ],
        { placeHolder: "Include package.json version bump?" }
    );

    if (includePackageJson === undefined) return;

    if (includePackageJson.value) {
        const packageBumpType = await vscode.window.showQuickPick(
            [
                {
                    label: `🔧 Patch (v${bumpPatchVersion(packageJsonVersion)})`,
                    value: "patch",
                },
                {
                    label: `⬆️ Minor (v${bumpMinorVersion(packageJsonVersion)})`,
                    value: "minor",
                },
                {
                    label: `🚀 Major (v${bumpMajorVersion(packageJsonVersion)})`,
                    value: "major",
                },
            ],
            { placeHolder: "Select package.json version bump type" }
        );
        if (!packageBumpType) return;
    }

    await bumpVersion(
        bumpType.value as BumpType,
        includePackageJson.value,
        withGit
    );
}

async function updateStatusBar() {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );

    if (!config.get("showInStatusBar", true)) {
        statusBarItem.hide();
        return;
    }

    try {
        const versions = await getCurrentVersions();
        const packageVersion = versions.packageJson || "N/A";
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let projectName = "Version Bumper";

        if (workspaceFolders) {
            const packageJsonPath = path.join(
                workspaceFolders[0].uri.fsPath,
                "package.json"
            );
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(
                    fs.readFileSync(packageJsonPath, "utf8")
                );
                projectName = packageJson.name || "Version Bumper";
            }
        }

        statusBarItem.text = `📱 ${projectName}: v${packageVersion}`;
        statusBarItem.tooltip = "Click to show all versions";
        statusBarItem.show();
    } catch (error) {
        statusBarItem.text = `📱 Version Bumper`;
        statusBarItem.tooltip = "React Native Version Bumper";
        statusBarItem.show();
    }
}

async function bumpVersion(
    type: BumpType,
    includePackageJson: boolean,
    withGit: boolean
): Promise<BumpResult[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found");
        return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const projectType = await detectProjectType(rootPath);

    // Show progress
    const results: BumpResult[] = [];
    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Bumping ${type} version...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 0 });

            const tasks: Promise<BumpResult>[] = [];

            if (includePackageJson) {
                try {
                    tasks.push(bumpPackageJsonVersion(rootPath, type));
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Unknown error";
                    results.push({
                        platform: "Package.json",
                        success: false,
                        oldVersion: "",
                        newVersion: "",
                        message: "Package.json bumping not implemented",
                        error: errorMessage,
                    });
                }
            }

            switch (projectType) {
                case "react-native":
                    tasks.push(bumpAndroidVersion(rootPath, type));
                    tasks.push(bumpIOSVersion(rootPath, type));
                    break;
                default:
                    results.push({
                        platform: "Unknown",
                        success: false,
                        oldVersion: "",
                        newVersion: "",
                        message: `Unsupported project type: ${projectType}`,
                    });
                    break;
            }

            progress.report({ increment: 20 });

            // Execute all tasks
            const taskResults = await Promise.allSettled(tasks);
            let completedTasks = 0;

            taskResults.forEach((result, index) => {
                if (result.status === "fulfilled") {
                    results.push(result.value);
                    completedTasks++;
                } else {
                    results.push({
                        platform: `Task ${index + 1}`,
                        success: false,
                        oldVersion: "",
                        newVersion: "",
                        message: "",
                        error: result.reason.toString(),
                    });
                }
            });

            // Dynamic progress based on completed tasks
            const totalTasks = tasks.length || 1; // Avoid division by zero
            progress.report({
                increment: Math.min(60 * (completedTasks / totalTasks), 60),
            });

            // Handle Git operations if requested
            if (withGit) {
                try {
                    await handleGitOperations(rootPath, type, results);
                    progress.report({ increment: 90 });
                } catch (error) {
                    const errorMessage =
                        error instanceof Error
                            ? error.message
                            : "Unknown error";
                    results.push({
                        platform: "Git",
                        success: false,
                        oldVersion: "",
                        newVersion: "",
                        message: "",
                        error: errorMessage,
                    });
                    vscode.window.showErrorMessage(
                        `Git operation failed: ${errorMessage}`
                    );
                }
            } else {
                progress.report({ increment: 90 });
            }

            progress.report({ increment: 100 });

            // Show results
            showBumpResults(type, results);

            // Update status bar
            updateStatusBar();

            return results;
        }
    );
}

async function detectProjectType(rootPath: string): Promise<ProjectType> {
    const androidPath = path.join(rootPath, "android");
    const iosPath = path.join(rootPath, "ios");

    const hasAndroid = fs.existsSync(androidPath);
    const hasIos = fs.existsSync(iosPath);

    if (hasAndroid && hasIos) {
        return "react-native";
    }
    return "react-native";
}

async function bumpPackageJsonVersion(
    rootPath: string,
    type: BumpType
): Promise<BumpResult> {
    const packageJsonPath = path.join(rootPath, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error("package.json not found");
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    const oldVersion = packageJson.version || "0.0.0";
    const newVersion = bumpSemanticVersion(oldVersion, type);

    packageJson.version = newVersion;
    fs.writeFileSync(
        packageJsonPath,
        JSON.stringify(packageJson, null, 2) + "\n",
        "utf8"
    );

    return {
        platform: "Package.json",
        success: true,
        oldVersion,
        newVersion,
        message: `Version: ${oldVersion} → ${newVersion}`,
    };
}

async function bumpAndroidVersion(
    rootPath: string,
    type: BumpType
): Promise<BumpResult> {
    const buildGradlePath = path.join(
        rootPath,
        "android",
        "app",
        "build.gradle"
    );

    if (!fs.existsSync(buildGradlePath)) {
        throw new Error("Android build.gradle not found");
    }

    const content = fs.readFileSync(buildGradlePath, "utf8");
    const lines = content.split("\n");

    let versionCode = 0;
    let versionName = "";
    let versionCodeLineIndex = -1;
    let versionNameLineIndex = -1;

    // Find version lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith("versionCode")) {
            const match = line.match(/versionCode\s+(\d+)/);
            if (match) {
                versionCode = parseInt(match[1]);
                versionCodeLineIndex = i;
            }
        }

        if (line.startsWith("versionName")) {
            const match = line.match(/versionName\s+["']([^"']+)["']/);
            if (match) {
                versionName = match[1];
                versionNameLineIndex = i;
            }
        }
    }

    if (versionCodeLineIndex === -1 || versionNameLineIndex === -1) {
        throw new Error("Could not find version information in build.gradle");
    }

    // Bump versions
    const newVersionCode = versionCode + 1;
    const newVersionName = bumpSemanticVersion(versionName, type);

    // Update lines
    lines[versionCodeLineIndex] = lines[versionCodeLineIndex].replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );

    lines[versionNameLineIndex] = lines[versionNameLineIndex].replace(
        /versionName\s+["'][^"']+["']/,
        `versionName "${newVersionName}"`
    );

    // Write back to file
    fs.writeFileSync(buildGradlePath, lines.join("\n"), "utf8");

    return {
        platform: "Android",
        success: true,
        oldVersion: `${versionCode} (${versionName})`,
        newVersion: `${newVersionCode} (${newVersionName})`,
        message: `Version Code: ${versionCode} → ${newVersionCode} \nVersion Name: ${versionName} → ${newVersionName}`,
    };
}

async function bumpIOSVersion(
    rootPath: string,
    type: BumpType
): Promise<BumpResult> {
    const iosPath = path.join(rootPath, "ios");

    if (!fs.existsSync(iosPath)) {
        throw new Error("iOS project not found");
    }

    // Check if Info.plist uses variables or hardcoded values
    const plistUsesVariables = await checkIfPlistUsesVariables(iosPath);

    let oldBuildNumber = "";
    let oldVersion = "";
    let newBuildNumber = "";
    let newVersion = "";

    if (plistUsesVariables) {
        // Read from project.pbxproj
        const iosContents = fs.readdirSync(iosPath);
        const xcodeprojDir = iosContents.find((item) =>
            item.endsWith(".xcodeproj")
        );

        if (!xcodeprojDir) {
            throw new Error("Xcode project file not found");
        }

        const pbxprojPath = path.join(iosPath, xcodeprojDir, "project.pbxproj");
        if (!fs.existsSync(pbxprojPath)) {
            throw new Error("project.pbxproj not found");
        }

        const content = fs.readFileSync(pbxprojPath, "utf8");
        const lines = content.split("\n");
        let currentProjectVersion = 0;
        let marketingVersion = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("CURRENT_PROJECT_VERSION")) {
                const match = line.match(
                    /CURRENT_PROJECT_VERSION\s*=\s*(\d+);/
                );
                if (match) currentProjectVersion = parseInt(match[1]);
            }
            if (line.includes("MARKETING_VERSION")) {
                const match = line.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
                if (match) marketingVersion = match[1].replace(/['"]/g, "");
            }
        }

        if (!currentProjectVersion || !marketingVersion) {
            throw new Error(
                "No MARKETING_VERSION or CURRENT_PROJECT_VERSION found in project.pbxproj"
            );
        }

        oldBuildNumber = currentProjectVersion.toString();
        oldVersion = marketingVersion;
        newBuildNumber = (currentProjectVersion + 1).toString();
        newVersion = bumpSemanticVersion(marketingVersion, type);

        // Update project.pbxproj
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("CURRENT_PROJECT_VERSION")) {
                lines[i] = lines[i].replace(
                    /CURRENT_PROJECT_VERSION\s*=\s*\d+;/,
                    `CURRENT_PROJECT_VERSION = ${newBuildNumber};`
                );
            }
            if (lines[i].includes("MARKETING_VERSION")) {
                lines[i] = lines[i].replace(
                    /MARKETING_VERSION\s*=\s*[^;]+;/,
                    `MARKETING_VERSION = ${newVersion};`
                );
            }
        }
        fs.writeFileSync(pbxprojPath, lines.join("\n"), "utf8");
    } else {
        // Read from Info.plist
        const plistPath = await findInfoPlistPath(iosPath);
        if (!plistPath) {
            throw new Error("Info.plist not found in iOS project");
        }

        const content = fs.readFileSync(plistPath, "utf8");
        const lines = content.split("\n");

        let bundleVersionLineIndex = -1;
        let bundleShortVersionLineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("<key>CFBundleVersion</key>")) {
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const match = nextLine.match(/<string>(\d+)<\/string>/);
                    if (match) {
                        oldBuildNumber = match[1];
                        bundleVersionLineIndex = i + 1;
                    }
                }
            }
            if (line.includes("<key>CFBundleShortVersionString</key>")) {
                if (i + 1 < lines.length) {
                    const nextLine = lines[i + 1].trim();
                    const match = nextLine.match(/<string>([^<]+)<\/string>/);
                    if (match) {
                        oldVersion = match[1];
                        bundleShortVersionLineIndex = i + 1;
                    }
                }
            }
        }

        if (
            bundleVersionLineIndex === -1 ||
            bundleShortVersionLineIndex === -1
        ) {
            throw new Error(
                "Could not find CFBundleVersion or CFBundleShortVersionString in Info.plist"
            );
        }

        newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();
        newVersion = bumpSemanticVersion(oldVersion, type);

        lines[bundleVersionLineIndex] = lines[bundleVersionLineIndex].replace(
            /<string>\d+<\/string>/,
            `<string>${newBuildNumber}</string>`
        );
        lines[bundleShortVersionLineIndex] = lines[
            bundleShortVersionLineIndex
        ].replace(/<string>[^<]+<\/string>/, `<string>${newVersion}</string>`);

        fs.writeFileSync(plistPath, lines.join("\n"), "utf8");
    }

    return {
        platform: "iOS",
        success: true,
        oldVersion: `${oldBuildNumber} (${oldVersion})`,
        newVersion: `${newBuildNumber} (${newVersion})`,
        message: `Build Number: ${oldBuildNumber} → ${newBuildNumber} \nVersion: ${oldVersion} → ${newVersion}`,
    };
}

async function checkIfPlistUsesVariables(iosPath: string): Promise<boolean> {
    const plistPath = await findInfoPlistPath(iosPath);

    if (!plistPath) {
        return false;
    }

    const content = fs.readFileSync(plistPath, "utf8");
    const usesMarketingVersion = content.includes("$(MARKETING_VERSION)");
    const usesCurrentProjectVersion = content.includes(
        "$(CURRENT_PROJECT_VERSION)"
    );

    return usesMarketingVersion || usesCurrentProjectVersion;
}

async function findInfoPlistPath(iosPath: string): Promise<string | null> {
    const possiblePlistPaths = [path.join(iosPath, "Info.plist")];

    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter((item) => {
            const itemPath = path.join(iosPath, item);
            return (
                fs.statSync(itemPath).isDirectory() &&
                !item.endsWith(".xcodeproj") &&
                !item.endsWith(".xcworkspace")
            );
        });

        projectDirs.forEach((dir) => {
            possiblePlistPaths.push(path.join(iosPath, dir, "Info.plist"));
        });
    } catch (error) {
        // Continue with default paths if directory reading fails
    }

    for (const checkPath of possiblePlistPaths) {
        if (fs.existsSync(checkPath)) {
            return checkPath;
        }
    }

    return null;
}

async function updateProjectPbxproj(
    iosPath: string,
    type: BumpType
): Promise<BumpResult> {
    const iosContents = fs.readdirSync(iosPath);
    const xcodeprojDir = iosContents.find((item) =>
        item.endsWith(".xcodeproj")
    );

    if (!xcodeprojDir) {
        throw new Error("Xcode project file not found");
    }

    const pbxprojPath = path.join(iosPath, xcodeprojDir, "project.pbxproj");

    if (!fs.existsSync(pbxprojPath)) {
        throw new Error("project.pbxproj not found");
    }

    const content = fs.readFileSync(pbxprojPath, "utf8");
    const lines = content.split("\n");

    let currentProjectVersion = 0;
    let marketingVersion = "";
    const updatedLines = [...lines];
    let foundVersions = false;

    // Find and update versions
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes("CURRENT_PROJECT_VERSION")) {
            const match = line.match(/CURRENT_PROJECT_VERSION\s*=\s*(\d+);/);
            if (match) {
                currentProjectVersion = parseInt(match[1]);
                const newCurrentProjectVersion = currentProjectVersion + 1;
                updatedLines[i] = lines[i].replace(
                    /CURRENT_PROJECT_VERSION\s*=\s*\d+;/,
                    `CURRENT_PROJECT_VERSION = ${newCurrentProjectVersion};`
                );
                foundVersions = true;
            }
        }

        if (line.includes("MARKETING_VERSION")) {
            const match = line.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
            if (match) {
                marketingVersion = match[1].replace(/['"]/g, "");
                const newMarketingVersion = bumpSemanticVersion(
                    marketingVersion,
                    type
                );
                updatedLines[i] = lines[i].replace(
                    /MARKETING_VERSION\s*=\s*[^;]+;/,
                    `MARKETING_VERSION = ${newMarketingVersion};`
                );
                foundVersions = true;
            }
        }
    }

    if (!foundVersions) {
        throw new Error(
            "No MARKETING_VERSION or CURRENT_PROJECT_VERSION found in project.pbxproj"
        );
    }

    fs.writeFileSync(pbxprojPath, updatedLines.join("\n"), "utf8");

    const newCurrentProjectVersion = currentProjectVersion + 1;
    const newMarketingVersion = bumpSemanticVersion(marketingVersion, type);

    return {
        platform: "iOS",
        success: true,
        oldVersion: `${currentProjectVersion} (${marketingVersion})`,
        newVersion: `${newCurrentProjectVersion} (${newMarketingVersion})`,
        message: `Build Number: ${currentProjectVersion} → ${newCurrentProjectVersion} \nVersion: ${marketingVersion} → ${newMarketingVersion}`,
    };
}

async function updateInfoPlist(
    iosPath: string,
    type: BumpType
): Promise<BumpResult> {
    const plistPath = await findInfoPlistPath(iosPath);

    if (!plistPath) {
        throw new Error("Info.plist not found in iOS project");
    }

    const content = fs.readFileSync(plistPath, "utf8");
    const lines = content.split("\n");

    let bundleVersion = "";
    let bundleShortVersionString = "";
    let bundleVersionLineIndex = -1;
    let bundleShortVersionLineIndex = -1;

    // Find version lines
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.includes("<key>CFBundleVersion</key>")) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const match = nextLine.match(/<string>(\d+)<\/string>/);
                if (match) {
                    bundleVersion = match[1];
                    bundleVersionLineIndex = i + 1;
                }
            }
        }

        if (line.includes("<key>CFBundleShortVersionString</key>")) {
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1].trim();
                const match = nextLine.match(/<string>([^<]+)<\/string>/);
                if (match) {
                    bundleShortVersionString = match[1];
                    bundleShortVersionLineIndex = i + 1;
                }
            }
        }
    }

    if (bundleVersionLineIndex === -1 || bundleShortVersionLineIndex === -1) {
        throw new Error(
            "Could not find CFBundleVersion or CFBundleShortVersionString in Info.plist"
        );
    }

    // Bump versions
    const newBundleVersion = (parseInt(bundleVersion) + 1).toString();
    const newBundleShortVersionString = bumpSemanticVersion(
        bundleShortVersionString,
        type
    );

    // Update lines
    lines[bundleVersionLineIndex] = lines[bundleVersionLineIndex].replace(
        /<string>\d+<\/string>/,
        `<string>${newBundleVersion}</string>`
    );

    lines[bundleShortVersionLineIndex] = lines[
        bundleShortVersionLineIndex
    ].replace(
        /<string>[^<]+<\/string>/,
        `<string>${newBundleShortVersionString}</string>`
    );

    // Write back to file
    fs.writeFileSync(plistPath, lines.join("\n"), "utf8");

    return {
        platform: "iOS",
        success: true,
        oldVersion: `${bundleVersion} (${bundleShortVersionString})`,
        newVersion: `${newBundleVersion} (${newBundleShortVersionString})`,
        message: `Build Number: ${bundleVersion} → ${newBundleVersion} \nVersion: ${bundleShortVersionString} → ${newBundleShortVersionString}`,
    };
}

function bumpSemanticVersion(version: string, type: BumpType): string {
    const versionParts = version.split(".").map((part) => parseInt(part) || 0);

    while (versionParts.length < 3) {
        versionParts.push(0);
    }

    switch (type) {
        case "major":
            versionParts[0] += 1;
            versionParts[1] = 0;
            versionParts[2] = 0;
            break;
        case "minor":
            versionParts[1] += 1;
            versionParts[2] = 0;
            break;
        case "patch":
            versionParts[2] += 1;
            break;
    }

    return versionParts.join(".");
}

async function handleGitOperations(
    rootPath: string,
    type: BumpType,
    results: BumpResult[]
): Promise<void> {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const gitConfig: GitConfig = {
        autoCommit: config.get("autoCommit", false),
        commitMessage: config.get(
            "commitMessage",
            "chore: bump version to {version}"
        ),
        createTags: config.get("createTags", false),
        pushToRemote: config.get("pushToRemote", false),
    };

    let shouldCommit = gitConfig.autoCommit;
    if (!shouldCommit) {
        const response = await vscode.window.showQuickPick(
            [
                { label: "Yes", value: true },
                { label: "No", value: false },
            ],
            { placeHolder: "Commit version changes to Git?" }
        );
        shouldCommit = response?.value ?? false;
    }

    if (!shouldCommit) {
        return;
    }

    try {
        // Collect versions from all platforms
        const versionMap: { [platform: string]: string } = {};
        const versionSources = results
            .filter((r) => r.success && r.newVersion)
            .map((r) => ({ platform: r.platform, newVersion: r.newVersion }));

        versionSources.forEach((source) => {
            let platformKey = source.platform;
            if (source.platform.startsWith("Android")) {
                platformKey = "Android";
            } else if (source.platform.startsWith("iOS")) {
                platformKey = "iOS";
            }
            const versionMatch = source.newVersion.match(/\(([^)]+)\)/);
            const semanticVersion = versionMatch
                ? versionMatch[1]
                : source.newVersion.split(" ")[0];
            versionMap[platformKey] = semanticVersion;
        });

        // Collect only app versions (Android and iOS, excluding package.json)
        const appVersions: { version: string; label: string }[] = [];
        if (versionMap["Android"]) {
            appVersions.push({
                version: versionMap["Android"],
                label: "android",
            });
        }
        if (versionMap["iOS"]) {
            appVersions.push({ version: versionMap["iOS"], label: "ios" });
        }

        // Generate commit message
        let commitMessage;
        if (appVersions.length === 0) {
            const customVersion = await vscode.window.showInputBox({
                placeHolder: "Enter version for commit (e.g., 18.0.0)",
                prompt: "No app version found. Please provide a version for the commit message.",
                validateInput: (value) =>
                    value.match(/^\d+\.\d+\.\d+$/)
                        ? null
                        : "Please enter a valid semantic version (e.g., 18.0.0)",
            });
            if (!customVersion) {
                commitMessage = "chore: bump version (manual commit)";
            } else {
                commitMessage = gitConfig.commitMessage.replace(
                    "{version}",
                    customVersion
                );
            }
        } else {
            const uniqueVersions = new Set(appVersions.map((v) => v.version));
            if (uniqueVersions.size === 1) {
                const version = appVersions[0].version;
                commitMessage = `chore: bump app version to v${version}`;
            } else {
                const versionStrings = appVersions.map(
                    (v) => `v${v.version} for ${v.label}`
                );
                commitMessage = `chore: bump app version to ${versionStrings.join(" and ")}`;
            }
        }

        // Stage all changes
        await execAsync("git add .", { cwd: rootPath });

        // Commit changes
        await execAsync(`git commit -m "${commitMessage}"`, { cwd: rootPath });

        // Handle tagging
        let shouldTag = gitConfig.createTags;
        let tagVersion: string | undefined;
        if (!shouldTag) {
            const response = await vscode.window.showQuickPick(
                [
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                ],
                { placeHolder: "Create Git tag for this version?" }
            );
            shouldTag = response?.value ?? false;
        }

        let tagSuccess = false;
        if (shouldTag) {
            const versions = await getCurrentVersions();
            const packageJsonVersion = versions.packageJson || "0.0.0";
            const [major, minor, patch] = packageJsonVersion
                .split(".")
                .map(Number);

            const tagOptions = [
                {
                    label: `🔧 Patch (v${major}.${minor}.${patch + 1})`,
                    value: `${major}.${minor}.${patch + 1}`,
                },
                {
                    label: `⬆️ Minor (v${major}.${minor + 1}.0)`,
                    value: `${major}.${minor + 1}.0`,
                },
                {
                    label: `🚀 Major (v${major + 1}.0.0)`,
                    value: `${major + 1}.0.0`,
                },
                { label: "Custom version", value: "custom" },
            ];

            const selectedVersion = await vscode.window.showQuickPick(
                tagOptions,
                {
                    placeHolder:
                        "Select bumped version for Git tag or enter custom",
                }
            );
            tagVersion =
                selectedVersion?.value === "custom"
                    ? await vscode.window.showInputBox({
                          placeHolder: "Enter version for tag (e.g., 3.2.1)",
                          prompt: "Provide a custom version for the Git tag",
                          validateInput: (value) =>
                              value.match(/^\d+\.\d+\.\d+$/)
                                  ? null
                                  : "Invalid version",
                      })
                    : selectedVersion?.value;

            if (tagVersion) {
                const tagName = `v${tagVersion}`;
                try {
                    await execAsync(`git tag ${tagName}`, { cwd: rootPath });
                    tagSuccess = true;
                } catch (tagError: unknown) {
                    if (
                        tagError instanceof Error &&
                        tagError.message.includes("already exists")
                    ) {
                        const overwrite = await vscode.window.showQuickPick(
                            [
                                { label: "Yes", value: true },
                                { label: "No", value: false },
                            ],
                            {
                                placeHolder: `Tag ${tagName} already exists. Overwrite?`,
                            }
                        );
                        if (overwrite?.value) {
                            await execAsync(`git tag -d ${tagName}`, {
                                cwd: rootPath,
                            });
                            await execAsync(`git tag ${tagName}`, {
                                cwd: rootPath,
                            });
                            tagSuccess = true;
                        }
                    }
                }
            }
        }

        // Handle pushing to remote
        let pushSuccess = false;
        let pushError: string | undefined;
        let shouldPush = gitConfig.pushToRemote;
        if (!shouldPush) {
            const pushResponse = await vscode.window.showQuickPick(
                [
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                ],
                { placeHolder: "Push changes to remote repository?" }
            );
            shouldPush = pushResponse?.value ?? false;
        }

        if (shouldPush) {
            try {
                await execAsync("git push", { cwd: rootPath });
                pushSuccess = true;
                if (shouldTag && tagVersion) {
                    await execAsync("git push --tags", { cwd: rootPath });
                }
            } catch (caughtError: unknown) {
                console.log("Raw Caught Error:", caughtError);
                pushError =
                    caughtError instanceof Error
                        ? caughtError.message
                        : caughtError?.toString() || "Unknown push error";
                console.log("Assigned pushError:", pushError);
            }
        }

        // Add Git result with multi-line message including all operation statuses
        let gitMessage = `Commit: ✅ Changes committed with message: "${commitMessage}"`;
        if (shouldTag && tagVersion !== undefined) {
            gitMessage += `<br>Tag: ${tagSuccess ? "✅" : "❌"} Tagged v${tagVersion}`;
        }
        if (shouldPush) {
            gitMessage += `<br>Push: ${pushSuccess ? "✅" : "❌"} ${pushSuccess ? "Pushed successfully" : `Failed - ${pushError}`}`;
        }
        results.push({
            platform: "Git",
            success: !shouldPush || (shouldPush && pushSuccess),
            oldVersion: "",
            newVersion: tagVersion || "",
            message: gitMessage,
            error: pushError || undefined,
        });
    } catch (error: unknown) {
        const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
        results.push({
            platform: "Git",
            success: false,
            oldVersion: "",
            newVersion: "",
            message: "Operation failed",
            error: errorMessage,
        });
        throw new Error(`Git operation failed: ${errorMessage}`);
    }
}

async function getCurrentVersions(): Promise<ProjectVersions> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error("No workspace folder found");
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const versions: ProjectVersions = {};

    try {
        // Package.json version
        const packageJsonPath = path.join(rootPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
            );
            versions.packageJson = packageJson.version;
        }

        // Android version
        const buildGradlePath = path.join(
            rootPath,
            "android",
            "app",
            "build.gradle"
        );
        if (fs.existsSync(buildGradlePath)) {
            const content = fs.readFileSync(buildGradlePath, "utf8");
            const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
            const versionNameMatch = content.match(
                /versionName\s+["']([^"']+)["']/
            );

            if (versionCodeMatch && versionNameMatch) {
                versions.android = {
                    versionCode: parseInt(versionCodeMatch[1]),
                    versionName: versionNameMatch[1],
                };
            }
        }

        // iOS version
        const iosPath = path.join(rootPath, "ios");
        if (fs.existsSync(iosPath)) {
            const plistUsesVariables = await checkIfPlistUsesVariables(iosPath);

            if (plistUsesVariables) {
                // Read from project.pbxproj
                const iosContents = fs.readdirSync(iosPath);
                const xcodeprojDir = iosContents.find((item) =>
                    item.endsWith(".xcodeproj")
                );

                if (xcodeprojDir) {
                    const pbxprojPath = path.join(
                        iosPath,
                        xcodeprojDir,
                        "project.pbxproj"
                    );
                    if (fs.existsSync(pbxprojPath)) {
                        const content = fs.readFileSync(pbxprojPath, "utf8");
                        const buildNumberMatch = content.match(
                            /CURRENT_PROJECT_VERSION\s*=\s*(\d+);/
                        );
                        const versionMatch = content.match(
                            /MARKETING_VERSION\s*=\s*([^;]+);/
                        );

                        if (buildNumberMatch && versionMatch) {
                            versions.ios = {
                                buildNumber: buildNumberMatch[1],
                                version: versionMatch[1].replace(/['"]/g, ""),
                            };
                        }
                    }
                }
            } else {
                // Read from Info.plist
                const plistPath = await findInfoPlistPath(iosPath);
                if (plistPath) {
                    const content = fs.readFileSync(plistPath, "utf8");
                    const bundleVersionMatch = content.match(
                        /<key>CFBundleVersion<\/key>\s*<string>(\d+)<\/string>/
                    );
                    const bundleShortVersionMatch = content.match(
                        /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
                    );

                    if (bundleVersionMatch && bundleShortVersionMatch) {
                        versions.ios = {
                            buildNumber: bundleVersionMatch[1],
                            version: bundleShortVersionMatch[1],
                        };
                    }
                }
            }
        }
    } catch (error) {
        // Ignore errors and return partial versions
    }

    return versions;
}

async function showCurrentVersions() {
    try {
        const versions = await getCurrentVersions();
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace folder found");
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const projectType = await detectProjectType(rootPath);

        // Create webview panel for better formatting
        const panel = vscode.window.createWebviewPanel(
            "currentVersions",
            "Current Versions",
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.webview.html = generateVersionsHTML(versions, projectType);
    } catch (error) {
        vscode.window.showErrorMessage(`Error getting versions: ${error}`);
    }
}

function generateVersionsHTML(
    versions: ProjectVersions,
    projectType: ProjectType
): string {
    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Current Versions</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    margin-bottom: 30px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                }
                .project-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-left: 10px;
                }
                .version-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-radius: 6px;
                    border-color: var(--vscode-inputValidation-infoBorder);
                }
                .version-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .result-message {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-top: 8px;
                    font-size: 14px;
                }
                .not-found {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                }
                .emoji {
                    margin-right: 8px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>📱 Current Versions</h1>
                <span class="project-type">${projectType.replace("-", " ")}</span>
            </div>
    `;

    // Package.json section
    html += `
        <div class="version-section">
            <div class="version-title"><span class="emoji">📦</span>Package.json</div>
            <div class="result-message">
                Version: ${versions.packageJson || '<span class="not-found">Not found</span>'}
            </div>
        </div>
    `;

    // Android section
    if (versions.android) {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🤖</span>Android</div>
                <div class="result-message">
                    Version Code: ${versions.android.versionCode}<br>
                    Version Name: ${versions.android.versionName}
                </div>
            </div>
        `;
    } else if (projectType === "react-native") {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🤖</span>Android</div>
                <div class="result-message">
                    Status: <span class="not-found">Not found or not configured</span>
                </div>
            </div>
        `;
    }

    // iOS section
    if (versions.ios) {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🍎</span>iOS</div>
                <div class="result-message">
                    Build Number: ${versions.ios.buildNumber}<br>
                    Version: ${versions.ios.version}
                </div>
            </div>
        `;
    } else if (projectType === "react-native") {
        html += `
            <div class="version-section">
                <div class="version-title"><span class="emoji">🍎</span>iOS</div>
                <div class="result-message">
                    Status: <span class="not-found">Not found or not configured</span>
                </div>
            </div>
        `;
    }

    html += `
        </body>
        </html>
    `;

    return html;
}

function showBumpResults(type: BumpType, results: BumpResult[]) {
    const panel = vscode.window.createWebviewPanel(
        "versionBumpResults",
        `Version Bump Results - ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        }
    );

    panel.webview.html = generateResultsHTML(type, results);
}

function generateResultsHTML(type: BumpType, results: BumpResult[]): string {
    const successCount = results.filter((r) => r.success).length;
    const totalCount = results.length;
    const hasErrors = results.some((r) => !r.success);

    let html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Version Bump Results</title>
            <style>
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .header {
                    margin-bottom: 30px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    padding-bottom: 15px;
                }
                .project-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-left: 10px;
                }
                .summary {
                    background-color: ${hasErrors ? "var(--vscode-inputValidation-warningBackground)" : "var(--vscode-inputValidation-infoBackground)"};
                    border: 1px solid ${hasErrors ? "var(--vscode-inputValidation-warningBorder)" : "var(--vscode-inputValidation-infoBorder)"};
                    border-radius: 6px;
                    padding: 15px;
                    margin-bottom: 25px;
                }
                .version-section {
                    margin-bottom: 25px;
                    padding: 15px;
                    background-color: var(--vscode-input-background);
                    border-radius: 6px;
                    border: 1px solid var(--vscode-input-border);
                }
                .version-title {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: var(--vscode-textLink-foreground);
                }
                .version-item {
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .version-label {
                    font-weight: 500;
                    color: var(--vscode-descriptionForeground);
                }
                .version-value {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 2px 6px;
                    border-radius: 3px;
                    color: var(--vscode-textPreformat-foreground);
                }
                .not-found {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                }
                .emoji {
                    margin-right: 8px;
                }
                .result-item {
                    margin-bottom: 20px;
                    padding: 15px;
                    border-radius: 6px;
                    border: 1px solid var(--vscode-input-border);
                }
                .result-success {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border-color: var(--vscode-inputValidation-infoBorder);
                }
                .result-error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border-color: var(--vscode-inputValidation-errorBorder);
                }
                .result-header {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                }
                .result-icon {
                    margin-right: 10px;
                    font-size: 18px;
                }
                .result-platform {
                    font-weight: bold;
                    font-size: 16px;
                }
                .result-message {
                    font-family: 'Courier New', monospace;
                    background-color: var(--vscode-textBlockQuote-background);
                    padding: 8px 12px;
                    border-radius: 4px;
                    margin-top: 8px;
                    font-size: 14px;
                    white-space: pre-wrap; /* Preserve newlines and spaces */
                }
                .result-error-message {
                    color: var(--vscode-errorForeground);
                    font-style: italic;
                    margin-top: 8px;
                }
                .bump-type {
                    background-color: var(--vscode-badge-background);
                    color: var(--vscode-badge-foreground);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 12px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🚀 Version Bump Results</h1>
                <span class="bump-type">${type}</span>
            </div>
            <div class="summary">
                <strong>Summary:</strong> ${successCount}/${totalCount} operations completed successfully
                ${hasErrors ? "<br><strong>⚠️ Some operations failed - check details below</strong>" : ""}
            </div>
    `;

    results.forEach((result) => {
        const iconMap: { [key in PlatformKey]: string } = {
            "Package.json": "📦",
            Android: "🤖",
            iOS: "🍎", // Unified iOS icon
            Git: "🔄",
        };

        const icon = iconMap[result.platform as PlatformKey] || "📱";
        const statusIcon = result.success ? "✅" : "❌";

        html += `
            <div class="version-section ${result.success ? "result-success" : "result-error"}">
                <div class="version-title">
                    <span class="result-icon">${icon}</span>
                    <span class="result-platform">${result.platform}</span>
                    <span class="result-icon" style="margin-left: auto;">${statusIcon}</span>
                </div>
                ${
                    result.message
                        ? `<div class="result-message">${result.message}</div>`
                        : result.error
                          ? `<div class="result-error-message">❌ ${result.error}</div>`
                          : ""
                }
            </div>
        `;
    });

    html += `
        </body>
        </html>
    `;

    return html;
}

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
