import * as vscode from 'vscode';
import path from 'path';

import { CONFIG, EXTENSION_ID, FILE_EXTENSIONS, FILE_PATTERNS, PROGRESS_INCREMENTS } from '../constants';
import { updatePlatformVersion } from '../services/platformService';
import { refreshCodeLenses } from '../services/uiService';
import { updateStatusBar } from '../services/uiService';
import { BumpResult, BumpType, PlatformType } from '../types';

export async function bumpVersionByType(type: BumpType): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage(
            'Please open a version file (package.json, build.gradle, Info.plist, app.json, or app.config.js/ts) to bump its version'
        );
        return;
    }

    const filePath = editor.document.fileName;
    const rootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || path.dirname(filePath);

    const config = vscode.workspace.getConfiguration(EXTENSION_ID);
    const customBuildGradlePath = config.get(
        CONFIG.ANDROID_BUILD_GRADLE_PATH,
        FILE_PATTERNS.ANDROID_BUILD_GRADLE_DEFAULT
    );
    const customInfoPlistPath = config.get(CONFIG.IOS_INFO_PLIST_PATH) as string;

    const normalizedFilePath = path.normalize(filePath);
    const normalizedBuildGradlePath = path.normalize(path.join(rootPath, customBuildGradlePath));
    const normalizedInfoPlistPath = customInfoPlistPath
        ? path.normalize(path.join(rootPath, customInfoPlistPath))
        : null;

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Bumping version...',
            cancellable: false,
        },
        async (progress) => {
            try {
                let result: BumpResult | undefined;

                if (filePath.endsWith(FILE_EXTENSIONS.PACKAGE_JSON)) {
                    result = await updatePlatformVersion({ type: PlatformType.PACKAGE, rootPath, bumpType: type });
                } else if (filePath.endsWith(FILE_EXTENSIONS.BUILD_GRADLE)) {
                    if (normalizedFilePath !== normalizedBuildGradlePath && normalizedBuildGradlePath) {
                        const answer = await vscode.window.showWarningMessage(
                            `This build.gradle file doesn't match your configured path (${customBuildGradlePath}). Update the configured file instead?`,
                            'Yes',
                            'No',
                            'Update Configuration'
                        );

                        if (answer === 'No') {
                            return;
                        } else if (answer === 'Update Configuration') {
                            await config.update(
                                CONFIG.ANDROID_BUILD_GRADLE_PATH,
                                path.relative(rootPath, filePath),
                                vscode.ConfigurationTarget.Workspace
                            );
                            vscode.window.showInformationMessage(
                                `Configuration updated to use: ${path.relative(rootPath, filePath)}`
                            );
                        }
                    }
                    result = await updatePlatformVersion({ type: PlatformType.ANDROID, rootPath, bumpType: type });
                } else if (
                    filePath.endsWith(FILE_EXTENSIONS.INFO_PLIST) ||
                    filePath.includes(FILE_EXTENSIONS.XCODEPROJ)
                ) {
                    if (
                        normalizedInfoPlistPath &&
                        normalizedFilePath !== normalizedInfoPlistPath &&
                        filePath.endsWith(FILE_EXTENSIONS.INFO_PLIST)
                    ) {
                        const answer = await vscode.window.showWarningMessage(
                            `You are editing an ${FILE_EXTENSIONS.INFO_PLIST} file that doesn't match your configured path (${customInfoPlistPath}). Do you want to update the configured file instead?`,
                            'Yes',
                            'No',
                            'Update Configuration'
                        );

                        if (answer === 'No') {
                            return;
                        } else if (answer === 'Update Configuration') {
                            await config.update(
                                CONFIG.IOS_INFO_PLIST_PATH,
                                path.relative(rootPath, filePath),
                                vscode.ConfigurationTarget.Workspace
                            );
                            vscode.window.showInformationMessage(
                                `Configuration updated to use: ${path.relative(rootPath, filePath)}`
                            );
                        }
                    }
                    result = await updatePlatformVersion({ type: PlatformType.IOS, rootPath, bumpType: type });
                } else if (filePath.endsWith(FILE_EXTENSIONS.APP_JSON)) {
                    result = await updatePlatformVersion({ type: PlatformType.EXPO, rootPath, bumpType: type });
                } else if (
                    filePath.endsWith(FILE_EXTENSIONS.APP_CONFIG_JS) ||
                    filePath.endsWith(FILE_EXTENSIONS.APP_CONFIG_TS)
                ) {
                    result = await updatePlatformVersion({ type: PlatformType.EXPO, rootPath, bumpType: type });
                } else {
                    vscode.window.showInformationMessage(
                        `Please open a version file (${FILE_EXTENSIONS.PACKAGE_JSON}, ${FILE_EXTENSIONS.BUILD_GRADLE}, iOS ${FILE_EXTENSIONS.INFO_PLIST}, ${FILE_EXTENSIONS.APP_JSON}, or app.config.js/ts) to bump its version`
                    );
                    return;
                }

                progress.report({ increment: PROGRESS_INCREMENTS.FINISHED });

                if (result && result.success) {
                    vscode.window.showInformationMessage(
                        `${result.platform} version bumped successfully: ${result.message}`
                    );
                    refreshCodeLenses();
                } else {
                    vscode.window.showErrorMessage(`Failed to bump version: ${result?.error || 'Unknown error'}`);
                }

                updateStatusBar();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Failed to bump version: ${errorMessage}`);
            }
        }
    );
}
