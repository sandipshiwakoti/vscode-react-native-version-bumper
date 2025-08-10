import * as fs from 'fs';
import path from 'path';

import { DEFAULT_VALUES, FILE_EXTENSIONS, FILE_PATTERNS, REGEX_PATTERNS } from '../constants';
import { getPackageJsonName } from '../services/platformService';
import { ProjectType } from '../types';

export async function detectProjectType(rootPath: string): Promise<ProjectType> {
    if (isExpoProject(rootPath)) {
        return ProjectType.EXPO;
    }

    const androidPath = path.join(rootPath, FILE_PATTERNS.ANDROID_FOLDER);
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    const hasAndroid = fs.existsSync(androidPath);
    const hasIos = fs.existsSync(iosPath);
    return hasAndroid || hasIos ? ProjectType.REACT_NATIVE : ProjectType.UNKNOWN;
}

export function isReactNativeProject(rootPath: string): boolean {
    const androidPath = path.join(rootPath, FILE_PATTERNS.ANDROID_FOLDER);
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    return fs.existsSync(androidPath) || fs.existsSync(iosPath);
}

export function isExpoProject(rootPath: string): boolean {
    const appJsonPath = path.join(rootPath, FILE_EXTENSIONS.APP_JSON);
    const appConfigJsPath = path.join(rootPath, FILE_EXTENSIONS.APP_CONFIG_JS);
    const appConfigTsPath = path.join(rootPath, FILE_EXTENSIONS.APP_CONFIG_TS);

    if (fs.existsSync(appJsonPath)) {
        try {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
            if (appJson.expo) {
                return true;
            }
        } catch {}
    }

    return fs.existsSync(appConfigJsPath) || fs.existsSync(appConfigTsPath);
}

export function hasAndroidProject(rootPath: string): boolean {
    const androidPath = path.join(rootPath, FILE_PATTERNS.ANDROID_FOLDER);
    const buildGradlePath = path.join(androidPath, 'app', FILE_EXTENSIONS.BUILD_GRADLE);
    return fs.existsSync(androidPath) && fs.existsSync(buildGradlePath);
}

export function hasIOSProject(rootPath: string): boolean {
    const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
    return fs.existsSync(iosPath);
}

export function isExpoWithoutNativeFiles(rootPath: string): boolean {
    const isExpo = isExpoProject(rootPath);
    if (!isExpo) {
        return false;
    }

    const hasAndroid = hasAndroidProject(rootPath);
    const hasIOS = hasIOSProject(rootPath);

    return !hasAndroid || !hasIOS;
}

export function getAppName(rootPath: string): string | null {
    try {
        const appJsonPath = path.join(rootPath, FILE_EXTENSIONS.APP_JSON);
        if (fs.existsSync(appJsonPath)) {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
            if (appJson.name) {
                return appJson.name;
            }
            if (appJson.expo?.name) {
                return appJson.expo.name;
            }
        }
    } catch {}

    try {
        const packageName = getPackageJsonName(rootPath);
        if (packageName) {
            return packageName
                .replace(REGEX_PATTERNS.PACKAGE_NAME_CLEAN, '')
                .replace(REGEX_PATTERNS.FIRST_CHAR_UPPER, (c: string) => c.toUpperCase());
        }
    } catch {}

    try {
        const iosPath = path.join(rootPath, FILE_PATTERNS.IOS_FOLDER);
        if (fs.existsSync(iosPath)) {
            const iosContents = fs.readdirSync(iosPath);
            const xcodeprojDir = iosContents.find((item) => item.endsWith(FILE_EXTENSIONS.XCODEPROJ));
            if (xcodeprojDir) {
                return xcodeprojDir.replace(FILE_EXTENSIONS.XCODEPROJ, '');
            }
        }
    } catch {}

    return null;
}

export async function findInfoPlistPath(iosPath: string): Promise<string | null> {
    const rootPath = path.dirname(iosPath);
    const appName = getAppName(rootPath);

    const possiblePlistPaths: string[] = [];

    if (appName) {
        possiblePlistPaths.push(path.join(iosPath, appName, FILE_EXTENSIONS.INFO_PLIST));
    }

    possiblePlistPaths.push(path.join(iosPath, FILE_EXTENSIONS.INFO_PLIST));

    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter(
            (item) =>
                fs.statSync(path.join(iosPath, item)).isDirectory() &&
                !item.endsWith(FILE_EXTENSIONS.XCODEPROJ) &&
                !item.endsWith(FILE_EXTENSIONS.XCWORKSPACE)
        );

        const sortedDirs = projectDirs.sort((a, b) => {
            if (appName) {
                if (a === appName) {
                    return DEFAULT_VALUES.VERSION_LINE_INDEX;
                }
                if (b === appName) {
                    return 1;
                }
            }
            return a.localeCompare(b);
        });

        sortedDirs.forEach((dir) => {
            const plistPath = path.join(iosPath, dir, FILE_EXTENSIONS.INFO_PLIST);
            if (!possiblePlistPaths.includes(plistPath)) {
                possiblePlistPaths.push(plistPath);
            }
        });
    } catch {}

    return possiblePlistPaths.find((checkPath) => fs.existsSync(checkPath)) || null;
}
