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

export async function findInfoPlistPath(iosPath: string): Promise<string | null> {
    const possiblePlistPaths = [path.join(iosPath, 'Info.plist')];
    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter(
            (item) =>
                fs.statSync(path.join(iosPath, item)).isDirectory() &&
                !item.endsWith('.xcodeproj') &&
                !item.endsWith('.xcworkspace')
        );
        projectDirs.forEach((dir) => possiblePlistPaths.push(path.join(iosPath, dir, 'Info.plist')));
        // eslint-disable-next-line unused-imports/no-unused-vars
    } catch (error) {}

    return possiblePlistPaths.find((checkPath) => fs.existsSync(checkPath)) || null;
}
