export type BumpType = 'major' | 'minor' | 'patch';

export type ProjectType = 'react-native' | 'unknown';

export type PlatformKey = 'Package.json' | 'Android' | 'iOS' | 'Git';

export interface BumpResult {
    platform: string;
    success: boolean;
    oldVersion: string;
    newVersion: string;
    message: string;
    error?: string;
}

export interface ProjectVersions {
    packageJson?: string;
    android?: { versionCode: number; versionName: string };
    ios?: { buildNumber: string; version: string };
}
