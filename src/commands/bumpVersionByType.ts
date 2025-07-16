import path from "path";
import * as vscode from "vscode";
import { BumpType, BumpResult } from "../types";
import {
    bumpAndroidVersion,
    bumpIOSVersion,
    bumpPackageJsonVersion,
} from "../services/bumpService";
import { updateStatusBar } from "../extension";
import {
    CONFIG_ANDROID_BUILD_GRADLE_PATH,
    CONFIG_IOS_INFO_PLIST_PATH,
} from "../constants";

export async function bumpVersionByType(type: BumpType): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage(
            "Please open a file to bump its version"
        );
        return;
    }

    const filePath = editor.document.fileName;
    const rootPath =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ||
        path.dirname(filePath);

    // Get configuration
    const config = vscode.workspace.getConfiguration(
        "reactNativeVersionBumper"
    );
    const customBuildGradlePath = config.get(
        CONFIG_ANDROID_BUILD_GRADLE_PATH,
        path.join("android", "app", "build.gradle")
    );
    const customInfoPlistPath = config.get(
        CONFIG_IOS_INFO_PLIST_PATH
    ) as string;

    // Normalize paths for comparison
    const normalizedFilePath = path.normalize(filePath);
    const normalizedBuildGradlePath = path.normalize(
        path.join(rootPath, customBuildGradlePath)
    );
    const normalizedInfoPlistPath = customInfoPlistPath
        ? path.normalize(path.join(rootPath, customInfoPlistPath))
        : null;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Bumping version...",
            cancellable: false,
        },
        async (progress) => {
            try {
                let result: BumpResult | undefined;

                // Determine file type and call appropriate function
                if (filePath.endsWith("package.json")) {
                    result = await bumpPackageJsonVersion(rootPath, type);
                } else if (filePath.endsWith("build.gradle")) {
                    // Check if custom path is configured and if current file matches it
                    if (
                        normalizedFilePath !== normalizedBuildGradlePath &&
                        normalizedBuildGradlePath
                    ) {
                        const answer = await vscode.window.showWarningMessage(
                            `You are editing a build.gradle file that doesn't match your configured path (${customBuildGradlePath}). Do you want to update the configured file instead?`,
                            "Yes",
                            "No",
                            "Update Configuration"
                        );

                        if (answer === "No") {
                            return;
                        } else if (answer === "Update Configuration") {
                            await config.update(
                                CONFIG_ANDROID_BUILD_GRADLE_PATH,
                                path.relative(rootPath, filePath),
                                vscode.ConfigurationTarget.Workspace
                            );
                            vscode.window.showInformationMessage(
                                `Configuration updated to use: ${path.relative(rootPath, filePath)}`
                            );
                        }
                    }
                    result = await bumpAndroidVersion(rootPath, type);
                } else if (
                    filePath.endsWith("Info.plist") ||
                    filePath.includes(".xcodeproj")
                ) {
                    // Check if custom path is configured and if current file matches it
                    if (
                        normalizedInfoPlistPath &&
                        normalizedFilePath !== normalizedInfoPlistPath &&
                        filePath.endsWith("Info.plist")
                    ) {
                        const answer = await vscode.window.showWarningMessage(
                            `You are editing an Info.plist file that doesn't match your configured path (${customInfoPlistPath}). Do you want to update the configured file instead?`,
                            "Yes",
                            "No",
                            "Update Configuration"
                        );

                        if (answer === "No") {
                            return;
                        } else if (answer === "Update Configuration") {
                            await config.update(
                                CONFIG_IOS_INFO_PLIST_PATH,
                                path.relative(rootPath, filePath),
                                vscode.ConfigurationTarget.Workspace
                            );
                            vscode.window.showInformationMessage(
                                `Configuration updated to use: ${path.relative(rootPath, filePath)}`
                            );
                        }
                    }
                    result = await bumpIOSVersion(rootPath, type);
                } else {
                    vscode.window.showInformationMessage(
                        "Please open a version file (package.json, build.gradle, or iOS Info.plist) to bump its version"
                    );
                    return;
                }

                progress.report({ increment: 100 });

                if (result && result.success) {
                    vscode.window.showInformationMessage(
                        `${result.platform} version bumped successfully: ${result.message}`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Failed to bump version: ${result?.error || "Unknown error"}`
                    );
                }

                updateStatusBar();
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : "Unknown error";
                vscode.window.showErrorMessage(
                    `Failed to bump version: ${errorMessage}`
                );
            }
        }
    );
}
