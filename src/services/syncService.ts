import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import {
    CONFIG_ANDROID_BUILD_GRADLE_PATH,
    CONFIG_IOS_INFO_PLIST_PATH,
    CONFIG_SKIP_ANDROID,
    CONFIG_SKIP_IOS,
    CONFIG_SKIP_PACKAGE_JSON,
} from '../constants';
import { updateStatusBar } from '../extension';
import { BumpResult } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { findInfoPlistPath } from '../utils/fileUtils';

import { handleGitOperations } from './gitService';

async function handleGitOperationsForSync(
    rootPath: string,
    targetVersion: string,
    results: BumpResult[]
): Promise<void> {
    const syncResults: BumpResult[] = results.map((result) => ({
        ...result,
        platform: result.platform === 'Package.json' ? 'Sync' : result.platform,
        newVersion: targetVersion,
    }));

    syncResults.push({
        platform: 'SyncOperation',
        success: true,
        oldVersion: '',
        newVersion: targetVersion,
        message: `Sync to version ${targetVersion}`,
    });

    await handleGitOperations(rootPath, 'patch', syncResults);
}

export async function syncVersions(
    targetVersion: string,
    currentVersions: any,
    hasAndroid: boolean,
    hasIOS: boolean,
    withGit: boolean
): Promise<BumpResult[]> {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const results: BumpResult[] = [];

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: `Syncing all platforms to version ${targetVersion}...`,
            cancellable: false,
        },
        async (progress) => {
            progress.report({ increment: 0 });
            const tasks: Promise<BumpResult>[] = [];

            if (currentVersions.packageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
                tasks.push(syncPackageJsonVersion(rootPath, targetVersion, currentVersions.packageJson));
            }

            if (hasAndroid && !config.get(CONFIG_SKIP_ANDROID)) {
                tasks.push(syncAndroidVersion(rootPath, targetVersion, currentVersions.android));
            }

            if (hasIOS && !config.get(CONFIG_SKIP_IOS)) {
                tasks.push(syncIOSVersion(rootPath, targetVersion, currentVersions.ios));
            }

            progress.report({ increment: 20 });
            const taskResults = await Promise.allSettled(tasks);
            let completedTasks = 0;

            taskResults.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    results.push(result.value);
                    completedTasks++;
                } else {
                    results.push({
                        platform: `Sync Task ${index + 1}`,
                        success: false,
                        oldVersion: '',
                        newVersion: targetVersion,
                        message: 'Sync failed',
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
                    await handleGitOperationsForSync(rootPath, targetVersion, results);
                    progress.report({ increment: 90 });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Git',
                        success: false,
                        oldVersion: '',
                        newVersion: targetVersion,
                        message: 'Git sync failed',
                        error: errorMessage,
                    });
                    vscode.window.showErrorMessage(`Git operation failed: ${errorMessage}`);
                }
            }

            progress.report({ increment: 100 });

            const hasSuccessfulOperations = results.some((result) => result.success);
            const hasCompletedTasks = tasks.length > 0 && completedTasks > 0;

            if (hasSuccessfulOperations && hasCompletedTasks) {
                showBumpResults('patch', results);
                updateStatusBar();
            } else if (results.length > 0 && !hasSuccessfulOperations) {
                const errorMessages = results
                    .filter((r) => !r.success)
                    .map((r) => `${r.platform}: ${r.error || r.message}`)
                    .join('\n');
                vscode.window.showErrorMessage(`Version sync failed:\n${errorMessages}`);
            }

            return results;
        }
    );
}

async function syncPackageJsonVersion(
    rootPath: string,
    targetVersion: string,
    currentVersion: string
): Promise<BumpResult> {
    const packageJsonPath = path.join(rootPath, 'package.json');

    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
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
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

    return {
        platform: 'Package.json',
        success: true,
        oldVersion,
        newVersion: targetVersion,
        message: `Version: ${oldVersion} → ${targetVersion}`,
    };
}

async function syncAndroidVersion(rootPath: string, targetVersion: string, currentAndroid: any): Promise<BumpResult> {
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
    let versionCode = currentAndroid?.versionCode || 1;
    let versionName = currentAndroid?.versionName || '1.0.0';
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

    const newVersionCode = versionCode + 1;
    const oldVersionDisplay = `${versionName} (${versionCode})`;
    const newVersionDisplay = `${targetVersion} (${newVersionCode})`;

    lines[versionCodeLineIndex] = lines[versionCodeLineIndex].replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );
    lines[versionNameLineIndex] = lines[versionNameLineIndex].replace(
        /versionName\s+["'][^"']+["']/,
        `versionName "${targetVersion}"`
    );

    fs.writeFileSync(buildGradlePath, lines.join('\n'), 'utf8');

    return {
        platform: 'Android',
        success: true,
        oldVersion: oldVersionDisplay,
        newVersion: newVersionDisplay,
        message: `Version Name: ${versionName} → ${targetVersion}\nVersion Code: ${versionCode} → ${newVersionCode}`,
    };
}

async function syncIOSVersion(rootPath: string, targetVersion: string, currentIOS: any): Promise<BumpResult> {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const iosPath = path.join(rootPath, 'ios');

    if (!fs.existsSync(iosPath)) {
        throw new Error('iOS project not found');
    }

    let plistPath: string | null | undefined = config.get(CONFIG_IOS_INFO_PLIST_PATH);
    if (plistPath) {
        plistPath = path.join(rootPath, plistPath);
    } else {
        plistPath = await findInfoPlistPath(iosPath);
    }

    if (!plistPath || !fs.existsSync(plistPath)) {
        throw new Error(`Info.plist not found at ${plistPath || 'default location'}`);
    }

    const plistContent = fs.readFileSync(plistPath, 'utf8');
    const plistLines = plistContent.split('\n');
    const plistUsesVariables = /\$\([^)]+\)/.test(plistContent);

    let oldBuildNumber = currentIOS?.buildNumber || '1';
    let oldVersion = currentIOS?.version || '1.0.0';
    let newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();
    let newVersion = targetVersion;

    if (plistUsesVariables) {
        let versionVarName = '';
        let buildVarName = '';

        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes('<key>CFBundleShortVersionString</key>')) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(/<string>\$\(([^)]+)\)<\/string>/);
                if (match) {
                    versionVarName = match[1];
                }
            }
            if (line.includes('<key>CFBundleVersion</key>')) {
                const nextLine = plistLines[i + 1].trim();
                const match = nextLine.match(/<string>\$\(([^)]+)\)<\/string>/);
                if (match) {
                    buildVarName = match[1];
                }
            }
        }

        if (!versionVarName || !buildVarName) {
            let bundleVersionLineIndex = -1;
            let bundleShortVersionLineIndex = -1;

            for (let i = 0; i < plistLines.length; i++) {
                const line = plistLines[i].trim();
                if (line.includes('<key>CFBundleVersion</key>')) {
                    if (i + 1 < plistLines.length) {
                        const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
                        if (match) {
                            oldBuildNumber = match[1];
                            bundleVersionLineIndex = i + 1;
                        }
                    }
                }
                if (line.includes('<key>CFBundleShortVersionString</key>')) {
                    if (i + 1 < plistLines.length) {
                        const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
                        if (match) {
                            oldVersion = match[1];
                            bundleShortVersionLineIndex = i + 1;
                        }
                    }
                }
            }

            if (bundleVersionLineIndex === -1 || bundleShortVersionLineIndex === -1) {
                throw new Error('Could not find CFBundleVersion or CFBundleShortVersionString in Info.plist');
            }

            newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();

            plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
                /<string>[^<]+<\/string>/,
                `<string>${newBuildNumber}</string>`
            );
            plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
                /<string>[^<]+<\/string>/,
                `<string>${targetVersion}</string>`
            );
            fs.writeFileSync(plistPath, plistLines.join('\n'), 'utf8');

            return {
                platform: 'iOS',
                success: true,
                oldVersion: `${oldVersion} (${oldBuildNumber})`,
                newVersion: `${newVersion} (${newBuildNumber})`,
                message: `Build Number: ${oldBuildNumber} → ${newBuildNumber}\nVersion: ${oldVersion} → ${newVersion}`,
            };
        }

        let pbxprojPath: string | null | undefined = config.get('ios.projectPbxprojPath');
        if (pbxprojPath) {
            pbxprojPath = path.join(rootPath, pbxprojPath);
        } else {
            const iosContents = fs.readdirSync(iosPath);
            const xcodeprojDir = iosContents.find((item) => item.endsWith('.xcodeproj'));
            if (!xcodeprojDir) {
                throw new Error('Xcode project file not found');
            }
            pbxprojPath = path.join(iosPath, xcodeprojDir, 'project.pbxproj');
        }

        if (!fs.existsSync(pbxprojPath)) {
            throw new Error('project.pbxproj not found');
        }

        let pbxContent = fs.readFileSync(pbxprojPath, 'utf8');
        const pbxLines = pbxContent.split('\n');

        let foundVersion = false;
        let foundBuildNumber = false;

        for (let i = 0; i < pbxLines.length; i++) {
            const line = pbxLines[i].trim();

            if (line.includes(versionVarName)) {
                let match = line.match(new RegExp(`${versionVarName}\\s*=\\s*([^;]+);`));
                if (!match) {
                    match = line.match(new RegExp(`${versionVarName}\\s*=\\s*"([^"]+)"`));
                }
                if (!match) {
                    match = line.match(new RegExp(`${versionVarName}\\s*=\\s*'([^']+)'`));
                }

                if (match) {
                    oldVersion = match[1].replace(/['"]*/g, '');
                    newVersion = targetVersion;

                    if (line.includes('"')) {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${versionVarName}\\s*=\\s*"[^"]+"`),
                            `${versionVarName} = "${newVersion}"`
                        );
                    } else if (line.includes("'")) {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${versionVarName}\\s*=\\s*'[^']+\'`),
                            `${versionVarName} = '${newVersion}'`
                        );
                    } else {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${versionVarName}\\s*=\\s*[^;]+;`),
                            `${versionVarName} = ${newVersion};`
                        );
                    }
                    foundVersion = true;
                }
            }

            if (line.includes(buildVarName)) {
                let match = line.match(new RegExp(`${buildVarName}\\s*=\\s*(\\d+);`));
                if (!match) {
                    match = line.match(new RegExp(`${buildVarName}\\s*=\\s*"(\\d+)"`));
                }
                if (!match) {
                    match = line.match(new RegExp(`${buildVarName}\\s*=\\s*'(\\d+)'`));
                }

                if (match) {
                    oldBuildNumber = match[1];
                    newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();

                    if (line.includes('"')) {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${buildVarName}\\s*=\\s*"\\d+"`),
                            `${buildVarName} = "${newBuildNumber}"`
                        );
                    } else if (line.includes("'")) {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${buildVarName}\\s*=\\s*'\\d+'`),
                            `${buildVarName} = '${newBuildNumber}'`
                        );
                    } else {
                        pbxLines[i] = pbxLines[i].replace(
                            new RegExp(`${buildVarName}\\s*=\\s*\\d+;`),
                            `${buildVarName} = ${newBuildNumber};`
                        );
                    }
                    foundBuildNumber = true;
                }
            }
        }

        // Fallback regex approach if line-by-line didn't work
        if (!foundVersion || !foundBuildNumber) {
            const versionRegex = new RegExp(`${versionVarName}\\s*=\\s*([\\d\\.]+)`, 'g');
            const buildRegex = new RegExp(`${buildVarName}\\s*=\\s*(\\d+)`, 'g');

            let versionMatch;
            while (!foundVersion && (versionMatch = versionRegex.exec(pbxContent))) {
                oldVersion = versionMatch[1];
                newVersion = targetVersion;

                pbxContent = pbxContent.replace(
                    new RegExp(`${versionVarName}\\s*=\\s*${oldVersion}`, 'g'),
                    `${versionVarName} = ${newVersion}`
                );
                foundVersion = true;
            }

            let buildMatch;
            while (!foundBuildNumber && (buildMatch = buildRegex.exec(pbxContent))) {
                oldBuildNumber = buildMatch[1];
                newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();

                pbxContent = pbxContent.replace(
                    new RegExp(`${buildVarName}\\s*=\\s*${oldBuildNumber}`, 'g'),
                    `${buildVarName} = ${newBuildNumber}`
                );
                foundBuildNumber = true;
            }

            if (foundVersion || foundBuildNumber) {
                fs.writeFileSync(pbxprojPath, pbxContent, 'utf8');
            }
        } else {
            fs.writeFileSync(pbxprojPath, pbxLines.join('\n'), 'utf8');
        }

        if (!foundVersion && !foundBuildNumber) {
            throw new Error(`Could not find ${versionVarName} or ${buildVarName} in project.pbxproj`);
        }

        if (!foundVersion) {
            oldVersion = '1.0.0';
            newVersion = targetVersion;
        }

        if (!foundBuildNumber) {
            oldBuildNumber = '1';
            newBuildNumber = '2';
        }
    } else {
        let bundleVersionLineIndex = -1;
        let bundleShortVersionLineIndex = -1;

        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes('<key>CFBundleVersion</key>')) {
                if (i + 1 < plistLines.length) {
                    const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
                    if (match) {
                        oldBuildNumber = match[1];
                        bundleVersionLineIndex = i + 1;
                    }
                }
            }
            if (line.includes('<key>CFBundleShortVersionString</key>')) {
                if (i + 1 < plistLines.length) {
                    const match = plistLines[i + 1].trim().match(/<string>([^<]+)<\/string>/);
                    if (match) {
                        oldVersion = match[1];
                        bundleShortVersionLineIndex = i + 1;
                    }
                }
            }
        }

        if (bundleVersionLineIndex === -1 || bundleShortVersionLineIndex === -1) {
            throw new Error('Could not find CFBundleVersion or CFBundleShortVersionString in Info.plist');
        }

        newBuildNumber = (parseInt(oldBuildNumber) + 1).toString();

        plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
            /<string>[^<]+<\/string>/,
            `<string>${newBuildNumber}</string>`
        );
        plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
            /<string>[^<]+<\/string>/,
            `<string>${targetVersion}</string>`
        );

        fs.writeFileSync(plistPath, plistLines.join('\n'), 'utf8');
    }

    return {
        platform: 'iOS',
        success: true,
        oldVersion: `${oldVersion} (${oldBuildNumber})`,
        newVersion: `${newVersion} (${newBuildNumber})`,
        message: `Build Number: ${oldBuildNumber} → ${newBuildNumber}\nVersion: ${oldVersion} → ${newVersion}`,
    };
}
