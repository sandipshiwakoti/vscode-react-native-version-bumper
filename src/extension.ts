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
    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left,
        100
    );
    statusBarItem.command = "react-native-version-bumper.showVersions";
    updateStatusBar();
    statusBarItem.show();

    const commands = [
        vscode.commands.registerCommand(
            "react-native-version-bumper.bumpAppVersion",
            () => bumpAppVersion(false)
        ),
        vscode.commands.registerCommand(
            "react-native-version-bumper.bumpAppVersionWithGit",
            () => bumpAppVersion(true)
        ),
        vscode.commands.registerCommand(
            "react-native-version-bumper.showVersions",
            () => showCurrentVersions()
        ),
    ];

    context.subscriptions.push(statusBarItem, ...commands);

    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar());
}

async function bumpAppVersion(withGit: boolean) {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const versions = await getCurrentVersions();
    const androidVersion = versions.android
        ? versions.android.versionName
        : "0.0.0";
    const iosVersion = versions.ios ? versions.ios.version : "0.0.0";
    const packageJsonVersion = versions.packageJson || "0.0.0";

    const bumpPatchVersion = (version: string) =>
        bumpSemanticVersion(version, "patch");
    const bumpMinorVersion = (version: string) =>
        bumpSemanticVersion(version, "minor");
    const bumpMajorVersion = (version: string) =>
        bumpSemanticVersion(version, "major");

    const platforms: string[] = [];
    if (!config.get("skipAndroid")) {
        platforms.push(`Android: v${androidVersion}`);
    }
    if (!config.get("skipIOS")) {
        platforms.push(`iOS: v${iosVersion}`);
    }
    const platformLabel =
        platforms.length > 0 ? platforms.join(", ") : "No platforms";

    const bumpType = await vscode.window.showQuickPick(
        [
            {
                label: `🔧 Patch (${platformLabel})`,
                value: "patch",
            },
            {
                label: `⬆️ Minor (${platformLabel})`,
                value: "minor",
            },
            {
                label: `🚀 Major (${platformLabel})`,
                value: "major",
            },
        ],
        { placeHolder: "Select version bump type for Android and iOS" }
    );

    if (!bumpType) {
        return;
    }

    let includePackageJson: { value: boolean } | undefined = { value: false };
    let packageBumpType: BumpType = bumpType.value as BumpType;
    if (!config.get("skipPackageJson")) {
        includePackageJson = await vscode.window.showQuickPick(
            [
                { label: "Yes", value: true },
                { label: "No", value: false },
            ],
            { placeHolder: "Include package.json version bump?" }
        );
        if (includePackageJson === undefined) {
            return;
        }

        if (includePackageJson.value) {
            const packageBumpTypeSelection = await vscode.window.showQuickPick(
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
            if (packageBumpTypeSelection) {
                packageBumpType = packageBumpTypeSelection.value as BumpType;
            } else {
                return;
            }
        }
    }

    await bumpVersion(
        bumpType.value as BumpType,
        includePackageJson.value,
        packageBumpType,
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
    packageBumpType: BumpType,
    withGit: boolean
): Promise<BumpResult[]> {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage("No workspace folder found");
        return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const projectType = await detectProjectType(rootPath);
    const results: BumpResult[] = [];

    if (
        config.get("skipPackageJson") &&
        config.get("skipAndroid") &&
        config.get("skipIOS")
    ) {
        vscode.window.showWarningMessage(
            "All version bump operations (package.json, Android, iOS) are skipped. No changes will be made."
        );
        return [];
    }

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Bumping ${type} version...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 0 });
            const tasks: Promise<BumpResult>[] = [];

            if (includePackageJson && !config.get("skipPackageJson")) {
                try {
                    tasks.push(
                        bumpPackageJsonVersion(rootPath, packageBumpType)
                    );
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
                        message: "Package.json bumping failed",
                        error: errorMessage,
                    });
                }
            }

            switch (projectType) {
                case "react-native":
                    if (!config.get("skipAndroid")) {
                        tasks.push(bumpAndroidVersion(rootPath, type));
                    }
                    if (!config.get("skipIOS")) {
                        tasks.push(bumpIOSVersion(rootPath, type));
                    }
                    break;
                default:
                    results.push({
                        platform: "Unknown",
                        success: false,
                        oldVersion: "",
                        newVersion: "",
                        message: `Unsupported project type: ${projectType}`,
                    });
            }

            progress.report({ increment: 20 });
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

            const totalTasks = tasks.length || 1;
            progress.report({
                increment: Math.min(60 * (completedTasks / totalTasks), 60),
            });

            if (withGit && tasks.length > 0) {
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
            } else if (tasks.length === 0) {
                return results;
            }

            progress.report({ increment: 100 });
            if (results.length > 0) {
                showBumpResults(type, results);
            }
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
    return hasAndroid && hasIos ? "react-native" : "react-native";
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
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const buildGradleConfigPath = config.get(
        "android.buildGradlePath",
        path.join("android", "app", "build.gradle")
    );
    const buildGradlePath = path.join(rootPath, buildGradleConfigPath);
    if (!fs.existsSync(buildGradlePath)) {
        throw new Error(`Android build.gradle not found at ${buildGradlePath}`);
    }

    const content = fs.readFileSync(buildGradlePath, "utf8");
    const lines = content.split("\n");
    let versionCode = 0,
        versionName = "",
        versionCodeLineIndex = -1,
        versionNameLineIndex = -1;

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

    const newVersionCode = versionCode + 1;
    const newVersionName = bumpSemanticVersion(versionName, type);

    lines[versionCodeLineIndex] = lines[versionCodeLineIndex].replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );
    lines[versionNameLineIndex] = lines[versionNameLineIndex].replace(
        /versionName\s+["'][^"']+["']/,
        `versionName "${newVersionName}"`
    );
    fs.writeFileSync(buildGradlePath, lines.join("\n"), "utf8");

    return {
        platform: "Android",
        success: true,
        oldVersion: `${versionName} (${versionCode})`,
        newVersion: `${newVersionName} (${newVersionCode})`,
        message: `Version Name: ${versionName} → ${newVersionName}\nVersion Code: ${versionCode} → ${newVersionCode}`,
    };
}

async function bumpIOSVersion(
    rootPath: string,
    type: BumpType
): Promise<BumpResult> {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const iosPath = path.join(rootPath, "ios");
    if (!fs.existsSync(iosPath)) {
        throw new Error("iOS project not found");
    }

    const plistUsesVariables = await checkIfPlistUsesVariables(iosPath);
    let oldBuildNumber = "",
        oldVersion = "",
        newBuildNumber = "",
        newVersion = "";

    if (plistUsesVariables) {
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
        let currentProjectVersion = 0,
            marketingVersion = "";

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("CURRENT_PROJECT_VERSION")) {
                const match = line.match(
                    /CURRENT_PROJECT_VERSION\s*=\s*(\d+);/
                );
                if (match) {
                    currentProjectVersion = parseInt(match[1]);
                }
            }
            if (line.includes("MARKETING_VERSION")) {
                const match = line.match(/MARKETING_VERSION\s*=\s*([^;]+);/);
                if (match) {
                    marketingVersion = match[1].replace(/['"]/g, "");
                }
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
        let plistPath: string | null | undefined =
            config.get("ios.infoPlistPath");
        if (!plistPath) {
            plistPath = await findInfoPlistPath(iosPath);
        }
        if (!plistPath || !fs.existsSync(plistPath)) {
            throw new Error(
                `Info.plist not found at ${plistPath || "default location"}`
            );
        }

        const content = fs.readFileSync(plistPath, "utf8");
        const lines = content.split("\n");
        let bundleVersionLineIndex = -1,
            bundleShortVersionLineIndex = -1;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes("<key>CFBundleVersion</key>")) {
                if (i + 1 < lines.length) {
                    const match = lines[i + 1]
                        .trim()
                        .match(/<string>(\d+)<\/string>/);
                    if (match) {
                        oldBuildNumber = match[1];
                        bundleVersionLineIndex = i + 1;
                    }
                }
            }
            if (line.includes("<key>CFBundleShortVersionString</key>")) {
                if (i + 1 < lines.length) {
                    const match = lines[i + 1]
                        .trim()
                        .match(/<string>([^<]+)<\/string>/);
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
        oldVersion: `${oldVersion} (${oldBuildNumber})`,
        newVersion: `${newVersion} (${newBuildNumber})`,
        message: `Build Number: ${oldBuildNumber} → ${newBuildNumber}\nVersion: ${oldVersion} → ${newVersion}`,
    };
}

async function checkIfPlistUsesVariables(iosPath: string): Promise<boolean> {
    const plistPath = await findInfoPlistPath(iosPath);
    if (!plistPath) {
        return false;
    }

    const content = fs.readFileSync(plistPath, "utf8");
    return (
        content.includes("$(MARKETING_VERSION)") ||
        content.includes("$(CURRENT_PROJECT_VERSION)")
    );
}

async function findInfoPlistPath(iosPath: string): Promise<string | null> {
    const possiblePlistPaths = [path.join(iosPath, "Info.plist")];
    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter(
            (item) =>
                fs.statSync(path.join(iosPath, item)).isDirectory() &&
                !item.endsWith(".xcodeproj") &&
                !item.endsWith(".xcworkspace")
        );
        projectDirs.forEach((dir) =>
            possiblePlistPaths.push(path.join(iosPath, dir, "Info.plist"))
        );
    } catch (error) {}

    return (
        possiblePlistPaths.find((checkPath) => fs.existsSync(checkPath)) || null
    );
}

function replacePlaceholders(
    template: string,
    values: Record<string, string>
): string {
    return template.replace(
        /{([a-zA-Z]+)}/g,
        (match, key) => values[key] || ""
    );
}

function getPlaceholderValues(
    type: BumpType,
    results: BumpResult[],
    mainVersion: string | undefined,
    versionMap: { [platform: string]: string },
    buildNumberMap: { [platform: string]: string }
): Record<string, string> {
    const platforms = results
        .filter(
            (r) =>
                r.success &&
                r.newVersion &&
                (r.platform === "Android" || r.platform === "iOS")
        )
        .map(
            (r) =>
                `${r.platform.toLowerCase()} to v${versionMap[r.platform]} (${buildNumberMap[r.platform]})`
        )
        .join(" and ");
    const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    return {
        type,
        platforms,
        version: mainVersion || "manual",
        date,
        androidVersion: versionMap["Android"] || "unknown",
        iosVersion: versionMap["iOS"] || "unknown",
        androidBuildNumber: buildNumberMap["Android"] || "N/A",
        iosBuildNumber: buildNumberMap["iOS"] || "N/A",
    };
}

async function getLatestGitTagVersion(rootPath: string): Promise<string> {
    try {
        try {
            const { stdout } = await execAsync(
                "git describe --tags --abbrev=0",
                { cwd: rootPath }
            );
            const latestTag = stdout.trim();

            if (latestTag) {
                const versionMatch = latestTag.match(/v?(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return versionMatch[1];
                }
            }
        } catch (describeError) {
            console.log(
                "getLatestGitTagVersion: git describe failed, trying git tag list approach"
            );
        }

        const { stdout } = await execAsync("git tag -l", { cwd: rootPath });
        const tags = stdout
            .trim()
            .split("\n")
            .filter((tag) => tag.trim());

        if (tags.length === 0) {
            return "0.0.0";
        }

        const versionTags = tags
            .map((tag) => {
                const match = tag.match(/v?(\d+\.\d+\.\d+)/);
                return match
                    ? {
                          tag,
                          version: match[1],
                          parts: match[1].split(".").map(Number),
                      }
                    : null;
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (!a || !b) {
                    return 0;
                }
                for (let i = 0; i < 3; i++) {
                    if (a?.parts[i] !== b?.parts[i]) {
                        return b?.parts[i] - a?.parts[i];
                    }
                }
                return 0;
            });

        if (versionTags.length > 0) {
            return versionTags[0]!.version;
        }

        return "0.0.0";
    } catch (error) {
        try {
            const versions = await getCurrentVersions();
            const fallbackVersion = versions.packageJson || "0.0.0";
            return fallbackVersion;
        } catch {
            return "0.0.0";
        }
    }
}

async function handleGitOperations(
    rootPath: string,
    type: BumpType,
    results: BumpResult[]
): Promise<void> {
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );

    try {
        const skipAndroid = config.get("skipAndroid", false);
        const skipIOS = config.get("skipIOS", false);
        const skipPackageJson = config.get("skipPackageJson", false);

        const versionMap: { [platform: string]: string } = {};
        const buildNumberMap: { [platform: string]: string } = {};

        const versionSources = results
            .filter(
                (r) =>
                    r.success &&
                    r.newVersion &&
                    ((r.platform === "Android" && !skipAndroid) ||
                        (r.platform === "iOS" && !skipIOS) ||
                        (r.platform === "Package.json" && !skipPackageJson))
            )
            .map((r) => ({ platform: r.platform, newVersion: r.newVersion }));

        versionSources.forEach((source) => {
            const platformKey = source.platform;
            let semanticVersion = "0.0.0";
            let buildNumber = "N/A";

            const versionMatch = source.newVersion.match(
                /^v?([\d.]+)(?:\s*\((\d+)\))?/
            );
            if (versionMatch) {
                semanticVersion = versionMatch[1];
                buildNumber = versionMatch[2] || "N/A";
            } else {
                const result = results.find(
                    (r) => r.platform === source.platform
                );
                if (result && result.oldVersion) {
                    const oldVersionMatch = result.oldVersion.match(
                        /^v?([\d.]+)(?:\s*\((\d+)\))?/
                    );
                    if (oldVersionMatch) {
                        semanticVersion = oldVersionMatch[1];
                        buildNumber =
                            source.newVersion.match(/(\d+)/)?.[1] || "N/A";
                    }
                } else {
                    buildNumber =
                        source.newVersion.match(/(\d+)/)?.[1] || "N/A";
                }
            }

            versionMap[platformKey] = semanticVersion;
            buildNumberMap[platformKey] = buildNumber;
        });

        const mainVersion = await getLatestGitTagVersion(rootPath);

        const placeholderValues = getPlaceholderValues(
            type,
            results,
            mainVersion,
            versionMap,
            buildNumberMap
        );

        let shouldCommit = config.get("git.autoCommit", false);
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

        let shouldCreateBranch = config.get("git.autoCreateBranch", false);
        let branchName: string | undefined;
        if (!config.get("git.skipBranch") && !shouldCreateBranch) {
            const createBranchResponse = await vscode.window.showQuickPick(
                [
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                ],
                { placeHolder: "Create a new branch for these changes?" }
            );
            shouldCreateBranch = createBranchResponse?.value ?? false;
        }

        if (shouldCreateBranch) {
            let defaultBranchName = "version-bump/";
            if (
                !skipAndroid &&
                !skipIOS &&
                versionMap["Android"] &&
                versionMap["iOS"]
            ) {
                defaultBranchName += `android-v${versionMap["Android"]}-ios-v${versionMap["iOS"]}`;
            } else if (!skipAndroid && versionMap["Android"]) {
                defaultBranchName += `android-v${versionMap["Android"]}`;
            } else if (!skipIOS && versionMap["iOS"]) {
                defaultBranchName += `ios-v${versionMap["iOS"]}`;
            } else if (!skipPackageJson && versionMap["Package.json"]) {
                defaultBranchName += `v${versionMap["Package.json"]}`;
            } else {
                defaultBranchName += `v${mainVersion}`;
            }

            const branchNameTemplate = config.get("git.branchNameTemplate", "");
            let customBranchName = defaultBranchName;
            if (branchNameTemplate) {
                customBranchName = replacePlaceholders(
                    branchNameTemplate,
                    placeholderValues
                );
                const isValidBranchName =
                    customBranchName !== branchNameTemplate &&
                    customBranchName !== "version-bump/" &&
                    customBranchName !== "" &&
                    !customBranchName.includes("unknown") &&
                    (!versionMap["Android"] ||
                        skipAndroid ||
                        customBranchName.includes(versionMap["Android"])) &&
                    (!versionMap["iOS"] ||
                        skipIOS ||
                        customBranchName.includes(versionMap["iOS"])) &&
                    (!versionMap["Package.json"] ||
                        skipPackageJson ||
                        customBranchName.includes(versionMap["Package.json"]));
                if (!isValidBranchName) {
                    customBranchName = defaultBranchName;
                }
            }

            if (config.get("git.autoCreateBranch")) {
                branchName = customBranchName;
            } else {
                branchName = await vscode.window.showInputBox({
                    placeHolder: "Enter branch name",
                    prompt: "Provide a name for the new branch",
                    value: customBranchName,
                });
            }

            if (!branchName) {
                vscode.window.showErrorMessage("Branch name is required");
                return;
            }

            try {
                await execAsync(`git checkout -b "${branchName}"`, {
                    cwd: rootPath,
                });
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                vscode.window.showErrorMessage(
                    `Failed to create branch: ${errorMessage}`
                );
                return;
            }
        }

        await execAsync("git add .", { cwd: rootPath });
        let commitMessage: string;
        const platforms: string[] = [];
        if (!skipAndroid && versionMap["Android"]) {
            platforms.push(
                `android to v${versionMap["Android"]} (${buildNumberMap["Android"]})`
            );
        }
        if (!skipIOS && versionMap["iOS"]) {
            platforms.push(
                `ios to v${versionMap["iOS"]} (${buildNumberMap["iOS"]})`
            );
        }
        if (!skipPackageJson && versionMap["Package.json"]) {
            platforms.push(`package.json to v${versionMap["Package.json"]}`);
        }
        commitMessage =
            platforms.length > 0
                ? `chore: bump ${platforms.join(" and ")}`
                : `chore: bump version to v${mainVersion}`;

        const commitMessageTemplate = config.get(
            "git.commitMessageTemplate",
            commitMessage
        );
        const defaultCommitMessage = replacePlaceholders(
            commitMessageTemplate,
            placeholderValues
        );
        let customCommitMessage: string | undefined;

        if (config.get("git.autoCommit")) {
            customCommitMessage = defaultCommitMessage;
        } else {
            customCommitMessage = await vscode.window.showInputBox({
                placeHolder: "Enter commit message",
                prompt: "Customize the commit message or press Enter to use the default",
                value: defaultCommitMessage,
            });
        }

        if (!customCommitMessage) {
            vscode.window.showErrorMessage("Commit message is required");
            return;
        }

        await execAsync(`git commit -m "${customCommitMessage}"`, {
            cwd: rootPath,
        });

        let shouldTag = config.get("git.autoCreateTag", false);
        let tagSuccess = false,
            tagName = "";

        if (!config.get("git.skipTag") && !shouldTag) {
            const response = await vscode.window.showQuickPick(
                [
                    { label: "Yes", value: true },
                    { label: "No", value: false },
                ],
                { placeHolder: "Create Git tag for this version?" }
            );
            shouldTag = response?.value ?? false;
        }

        if (shouldTag) {
            const currentTagVersion = await getLatestGitTagVersion(rootPath);

            const bumpPatchTag = (version: string) =>
                bumpSemanticVersion(version, "patch");
            const bumpMinorTag = (version: string) =>
                bumpSemanticVersion(version, "minor");
            const bumpMajorTag = (version: string) =>
                bumpSemanticVersion(version, "major");

            const tagBumpType = await vscode.window.showQuickPick(
                [
                    {
                        label: `🔧 Patch (v${bumpPatchTag(currentTagVersion)})`,
                        value: "patch",
                    },
                    {
                        label: `⬆️ Minor (v${bumpMinorTag(currentTagVersion)})`,
                        value: "minor",
                    },
                    {
                        label: `🚀 Major (v${bumpMajorTag(currentTagVersion)})`,
                        value: "major",
                    },
                    {
                        label: "✏️ Custom Version",
                        value: "custom",
                    },
                ],
                { placeHolder: "Select tag version bump type" }
            );

            if (!tagBumpType) {
                return;
            }

            let newTagVersion: string;
            if (tagBumpType.value === "custom") {
                const customVersion = await vscode.window.showInputBox({
                    placeHolder: "Enter custom version (e.g., 1.2.3)",
                    prompt: "Enter the custom version for the tag",
                    value: currentTagVersion,
                    validateInput: (value) => {
                        if (!value) {
                            return "Version is required";
                        }
                        if (!/^\d+\.\d+\.\d+$/.test(value)) {
                            return "Version must be in format x.y.z (e.g., 1.2.3)";
                        }
                        return null;
                    },
                });

                if (!customVersion) {
                    return;
                }
                newTagVersion = customVersion;
            } else {
                newTagVersion = bumpSemanticVersion(
                    currentTagVersion,
                    tagBumpType.value as BumpType
                );
            }

            const tagNameTemplate = config.get(
                "git.tagNameTemplate",
                "v{version}"
            );
            tagName = replacePlaceholders(tagNameTemplate, {
                ...placeholderValues,
                version: newTagVersion,
            });

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
                } else {
                    throw tagError;
                }
            }
        }

        let shouldPush = !config.get("git.skipPush");
        if (shouldPush) {
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
                if (shouldCreateBranch && branchName) {
                    await execAsync(`git push origin "${branchName}"`, {
                        cwd: rootPath,
                    });
                } else {
                    await execAsync(`git push`, { cwd: rootPath });
                }
                if (shouldTag && tagSuccess) {
                    await execAsync(`git push origin ${tagName}`, {
                        cwd: rootPath,
                    });
                }
            } catch (caughtError: unknown) {
                const pushError =
                    caughtError instanceof Error
                        ? caughtError.message
                        : "Unknown push error";
                vscode.window.showErrorMessage(`Push failed: ${pushError}`);
            }
        }

        let gitMessage =
            shouldCreateBranch && branchName
                ? `Branch: ✅ Created and switched to branch "${branchName}"<br>Commit: ✅ Changes committed with message: "${customCommitMessage}"`
                : `Commit: ✅ Changes committed with message: "${customCommitMessage}"`;
        if (shouldTag && tagName) {
            gitMessage += `<br>Tag: ${tagSuccess ? "✅" : "❌"} Tagged ${tagName}`;
        }
        if (shouldPush) {
            gitMessage += `<br>Push: ${shouldPush ? "✅" : "❌"} Pushed ${shouldCreateBranch ? "branch and tag" : "changes and tag"} to remote`;
        }

        results.push({
            platform: "Git",
            success: true,
            oldVersion: "",
            newVersion: "",
            message: gitMessage,
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
        const packageJsonPath = path.join(rootPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            versions.packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
            ).version;
        }

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

        const iosPath = path.join(rootPath, "ios");
        if (fs.existsSync(iosPath)) {
            const plistUsesVariables = await checkIfPlistUsesVariables(iosPath);
            if (plistUsesVariables) {
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
    } catch (error) {}

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
        const panel = vscode.window.createWebviewPanel(
            "currentVersions",
            "Current Versions",
            vscode.ViewColumn.One,
            { enableScripts: true, retainContextWhenHidden: true }
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

    html += `
        <div class="version-section">
            <div class="version-title"><span class="emoji">📦</span>Package.json</div>
            <div class="result-message">
                Version: ${versions.packageJson || '<span class="not-found">Not found</span>'}
            </div>
        </div>
    `;

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
        { enableScripts: true, retainContextWhenHidden: true }
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
                    white-space: pre-wrap;
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
            iOS: "🍎",
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

export function deactivate() {
    if (statusBarItem) {
        statusBarItem.dispose();
    }
}
