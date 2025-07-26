export enum BumpType {
    MAJOR = 'major',
    MINOR = 'minor',
    PATCH = 'patch',
    CUSTOM = 'custom',
}

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
export interface AndroidVersionInfo {
    versionCode: number;
    versionName: string;
    versionCodeLineIndex: number;
    versionNameLineIndex: number;
    lines: string[];
    buildGradlePath: string;
}

export interface IOSVersionInfo {
    version: string;
    buildNumber: string;
    versionVarName?: string;
    buildVarName?: string;
    usesVariables: boolean;
}

export interface IOSUpdateResult {
    oldVersion: string;
    oldBuildNumber: string;
    newVersion: string;
    newBuildNumber: string;
}

export interface PackageJsonData {
    version?: string;
    name?: string;
    [key: string]: unknown;
}

export interface SyncOption {
    label: string;
    description: string;
    version: string;
    source: 'package.json' | 'android' | 'ios' | 'custom';
}

export interface BatchOperation {
    type: 'version' | 'git';
    platform: string;
    action: string;
    oldValue: string;
    newValue: string;
    description: string;
}

export interface BatchGitConfig {
    shouldCreateBranch: boolean;
    branchName?: string;
    commitMessage: string;
    shouldTag: boolean;
    tagName?: string;
    shouldPush: boolean;
}

export interface BatchExecutionPlan {
    operations: BatchOperation[];
    gitConfig?: BatchGitConfig;
    summary: string;
}

export interface ExecutionOptions {
    rootPath: string;
    bumpType: BumpType;
    withGit: boolean;
    customVersions?: {
        android?: { version: string; buildNumber?: number };
        ios?: { version: string; buildNumber?: number };
        packageJson?: string;
    };
    packageBumpType?: BumpType;
    isSync?: boolean;
}
