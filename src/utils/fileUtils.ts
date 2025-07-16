import * as fs from 'fs';
import path from 'path';

import { ProjectType } from '../types';

export async function detectProjectType(rootPath: string): Promise<ProjectType> {
    const androidPath = path.join(rootPath, 'android');
    const iosPath = path.join(rootPath, 'ios');
    const hasAndroid = fs.existsSync(androidPath);
    const hasIos = fs.existsSync(iosPath);
    return hasAndroid || hasIos ? 'react-native' : 'unknown';
}

export function isReactNativeProject(rootPath: string): boolean {
    const androidPath = path.join(rootPath, 'android');
    const iosPath = path.join(rootPath, 'ios');
    return fs.existsSync(androidPath) || fs.existsSync(iosPath);
}

export function hasAndroidProject(rootPath: string): boolean {
    const androidPath = path.join(rootPath, 'android');
    const buildGradlePath = path.join(androidPath, 'app', 'build.gradle');
    return fs.existsSync(androidPath) && fs.existsSync(buildGradlePath);
}

export function hasIOSProject(rootPath: string): boolean {
    const iosPath = path.join(rootPath, 'ios');
    return fs.existsSync(iosPath);
}

export function getAppName(rootPath: string): string | null {
    // Try to get app name from app.json first (React Native/Expo standard)
    try {
        const appJsonPath = path.join(rootPath, 'app.json');
        if (fs.existsSync(appJsonPath)) {
            const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
            if (appJson.name) {
                return appJson.name;
            }
            if (appJson.expo?.name) {
                return appJson.expo.name;
            }
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
        // Continue to next fallback
    }

    // Try to get app name from package.json
    try {
        const packageJsonPath = path.join(rootPath, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
            if (packageJson.name) {
                // Convert package name to a more suitable app name format
                return packageJson.name.replace(/[@\/\-_]/g, '').replace(/^\w/, (c: string) => c.toUpperCase());
            }
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
        // Continue to next fallback
    }

    // Try to get app name from iOS project structure
    try {
        const iosPath = path.join(rootPath, 'ios');
        if (fs.existsSync(iosPath)) {
            const iosContents = fs.readdirSync(iosPath);
            const xcodeprojDir = iosContents.find((item) => item.endsWith('.xcodeproj'));
            if (xcodeprojDir) {
                return xcodeprojDir.replace('.xcodeproj', '');
            }
        }
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
        // Continue to next fallback
    }

    return null;
}

export async function findInfoPlistPath(iosPath: string): Promise<string | null> {
    const rootPath = path.dirname(iosPath);
    const appName = getAppName(rootPath);

    const possiblePlistPaths: string[] = [];

    // If we have an app name, prioritize the app-specific path
    if (appName) {
        possiblePlistPaths.push(path.join(iosPath, appName, 'Info.plist'));
    }

    // Add fallback paths
    possiblePlistPaths.push(path.join(iosPath, 'Info.plist'));

    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter(
            (item) =>
                fs.statSync(path.join(iosPath, item)).isDirectory() &&
                !item.endsWith('.xcodeproj') &&
                !item.endsWith('.xcworkspace')
        );

        // Add all possible directory paths, but prioritize the app name if it exists
        const sortedDirs = projectDirs.sort((a, b) => {
            if (appName) {
                if (a === appName) {
                    return -1;
                }
                if (b === appName) {
                    return 1;
                }
            }
            return a.localeCompare(b);
        });

        sortedDirs.forEach((dir) => {
            const plistPath = path.join(iosPath, dir, 'Info.plist');
            if (!possiblePlistPaths.includes(plistPath)) {
                possiblePlistPaths.push(plistPath);
            }
        });
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {
        // Continue with existing paths
    }

    return possiblePlistPaths.find((checkPath) => fs.existsSync(checkPath)) || null;
}
