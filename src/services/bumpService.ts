import * as vscode from 'vscode';
import * as fs from 'fs';
import path from 'path';

import {
    CONFIG_ANDROID_BUILD_GRADLE_PATH,
    CONFIG_IOS_INFO_PLIST_PATH,
    CONFIG_SKIP_ANDROID,
    CONFIG_SKIP_IOS,
    CONFIG_SKIP_PACKAGE_JSON,
    INITIAL_SEMANTIC_VERSION,
} from '../constants';
import { updateStatusBar } from '../extension';
import { BumpResult, BumpType } from '../types';
import { showBumpResults } from '../ui/resultsView';
import { detectProjectType, findInfoPlistPath } from '../utils/fileUtils';
import { bumpSemanticVersion } from '../utils/versionUtils';

import { handleGitOperations } from './gitService';

export async function bumpVersion(
    type: BumpType,
    includePackageJson: boolean,
    packageBumpType: BumpType,
    withGit: boolean
): Promise<BumpResult[]> {
    const config = vscode.workspace.getConfiguration('reactNativeVersionBumper');
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace folder found');
        return [];
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const projectType = await detectProjectType(rootPath);
    const results: BumpResult[] = [];

    if (config.get(CONFIG_SKIP_PACKAGE_JSON) && config.get(CONFIG_SKIP_ANDROID) && config.get(CONFIG_SKIP_IOS)) {
        vscode.window.showWarningMessage(
            'All version bump operations (package.json, Android, iOS) are skipped. No changes will be made.'
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

            if (includePackageJson && !config.get(CONFIG_SKIP_PACKAGE_JSON)) {
                try {
                    tasks.push(bumpPackageJsonVersion(rootPath, packageBumpType));
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Package.json',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: 'Package.json bumping failed',
                        error: errorMessage,
                    });
                }
            }

            switch (projectType) {
                case 'react-native':
                    if (!config.get(CONFIG_SKIP_ANDROID)) {
                        tasks.push(bumpAndroidVersion(rootPath, type));
                    }
                    if (!config.get(CONFIG_SKIP_IOS)) {
                        tasks.push(bumpIOSVersion(rootPath, type));
                    }
                    break;
                default:
                    results.push({
                        platform: 'Unknown',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: `Unsupported project type: ${projectType}`,
                    });
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
                        platform: `Task ${index + 1}`,
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: '',
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
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    results.push({
                        platform: 'Git',
                        success: false,
                        oldVersion: '',
                        newVersion: '',
                        message: '',
                        error: errorMessage,
                    });
                    vscode.window.showErrorMessage(`Git operation failed: ${errorMessage}`);
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

export async function bumpPackageJsonVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
    const packageJsonPath = path.join(rootPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        throw new Error('package.json not found');
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const oldVersion = packageJson.version || INITIAL_SEMANTIC_VERSION;
    const newVersion = bumpSemanticVersion(oldVersion, type);

    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf8');

    return {
        platform: 'Package.json',
        success: true,
        oldVersion,
        newVersion,
        message: `Version: ${oldVersion} → ${newVersion}`,
    };
}

export async function bumpAndroidVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
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
    let versionCode = 0,
        versionName = '',
        versionCodeLineIndex = -1,
        versionNameLineIndex = -1;

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
    const newVersionName = bumpSemanticVersion(versionName, type);

    lines[versionCodeLineIndex] = lines[versionCodeLineIndex].replace(
        /versionCode\s+\d+/,
        `versionCode ${newVersionCode}`
    );
    lines[versionNameLineIndex] = lines[versionNameLineIndex].replace(
        /versionName\s+["'][^"']+["']/,
        `versionName "${newVersionName}"`
    );
    fs.writeFileSync(buildGradlePath, lines.join('\n'), 'utf8');

    return {
        platform: 'Android',
        success: true,
        oldVersion: `${versionName} (${versionCode})`,
        newVersion: `${newVersionName} (${newVersionCode})`,
        message: `Version Name: ${versionName} → ${newVersionName}\nVersion Code: ${versionCode} → ${newVersionCode}`,
    };
}

export async function bumpIOSVersion(rootPath: string, type: BumpType): Promise<BumpResult> {
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

    let oldBuildNumber = '',
        oldVersion = '',
        newBuildNumber = '',
        newVersion = '';

    if (plistUsesVariables) {
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
            let bundleVersionLineIndex = -1,
                bundleShortVersionLineIndex = -1;

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
            newVersion = bumpSemanticVersion(oldVersion, type);

            plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
                /<string>[^<]+<\/string>/,
                `<string>${newBuildNumber}</string>`
            );
            plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
                /<string>[^<]+<\/string>/,
                `<string>${newVersion}</string>`
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
                    newVersion = bumpSemanticVersion(oldVersion, type);

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

        if (!foundVersion || !foundBuildNumber) {
            const versionRegex = new RegExp(`${versionVarName}\\s*=\\s*([\\d\\.]+)`, 'g');
            const buildRegex = new RegExp(`${buildVarName}\\s*=\\s*(\\d+)`, 'g');

            let versionMatch;
            while (!foundVersion && (versionMatch = versionRegex.exec(pbxContent))) {
                oldVersion = versionMatch[1];
                newVersion = bumpSemanticVersion(oldVersion, type);

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
            newVersion = bumpSemanticVersion(oldVersion, type);
        }

        if (!foundBuildNumber) {
            oldBuildNumber = '1';
            newBuildNumber = '2';
        }
    } else {
        let bundleVersionLineIndex = -1,
            bundleShortVersionLineIndex = -1;

        for (let i = 0; i < plistLines.length; i++) {
            const line = plistLines[i].trim();
            if (line.includes('<key>CFBundleVersion</key>')) {
                if (i + 1 < plistLines.length) {
                    const match = plistLines[i + 1].trim().match(/<string>(\d+)<\/string>/);
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
        newVersion = bumpSemanticVersion(oldVersion, type);

        plistLines[bundleVersionLineIndex] = plistLines[bundleVersionLineIndex].replace(
            /<string>\d+<\/string>/,
            `<string>${newBuildNumber}</string>`
        );
        plistLines[bundleShortVersionLineIndex] = plistLines[bundleShortVersionLineIndex].replace(
            /<string>[^<]+<\/string>/,
            `<string>${newVersion}</string>`
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
