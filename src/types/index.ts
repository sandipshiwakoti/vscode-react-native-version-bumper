import * as vscode from 'vscode';

export enum BumpType {
    MAJOR = 'major',
    MINOR = 'minor',
    PATCH = 'patch',
    CUSTOM = 'custom',
}

export enum ProjectType {
    REACT_NATIVE = 'react-native',
    EXPO = 'expo',
    UNKNOWN = 'unknown',
}

export enum Platform {
    PACKAGE_JSON = 'Package.json',
    ANDROID = 'Android',
    IOS = 'iOS',
    EXPO = 'Expo',
    GIT = 'Git',
}

export enum PlatformType {
    ANDROID = 'android',
    IOS = 'ios',
    PACKAGE = 'package',
    EXPO = 'expo',
}

export enum SyncSource {
    PACKAGE_JSON = 'package.json',
    ANDROID = 'android',
    IOS = 'ios',
    EXPO = 'expo',
    CUSTOM = 'custom',
}

export enum OperationType {
    VERSION = 'version',
    GIT = 'git',
}

export enum GitAction {
    CREATE_BRANCH = 'Create branch',
    COMMIT_CHANGES = 'Commit changes',
    CREATE_TAG = 'Create tag',
    PUSH_TO_REMOTE = 'Push to remote',
}

export enum WebviewCommand {
    CREATE_RELEASE = 'createRelease',
    CREATE_PR = 'createPR',
}

export interface WebviewMessage {
    command: WebviewCommand;
}

export enum VersionAction {
    SYNC_VERSION = 'Sync version',
    UPDATE_VERSION = 'Update version',
    SYNC_VERSION_AND_BUILD = 'Sync version and increment build',
    UPDATE_VERSION_AND_BUILD = 'Update version and build number',
}

export type PlatformKey = Platform;

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
    expo?: {
        version: string;
        iosBuildNumber?: string;
        androidVersionCode?: number;
    };
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

export interface SyncOption {
    label: string;
    description: string;
    version: string;
    source: SyncSource;
}

export interface BatchOperation {
    type: OperationType;
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
    skipPackageJson?: boolean;
}

export interface GitWorkflowResult {
    branchCreated: boolean;
    branchName?: string;
    commitSuccess: boolean;
    commitMessage?: string;
    tagSuccess: boolean;
    tagName?: string;
    pushSuccess: boolean;
}

export interface VersionCardData {
    platform: string;
    success?: boolean;
    available?: boolean;
    version?: string;
    buildNumber?: string;
    versionName?: string;
    versionCode?: number;
    oldVersion?: string;
    newVersion?: string;
    location?: string;
    iosVersionInfo?: IOSVersionInfo | null;
    message?: string;
    error?: string;
}

export interface VersionOperationOptions {
    withGit: boolean;
    isSync?: boolean;
    context?: vscode.ExtensionContext;
}

export interface PlatformConfig {
    type: PlatformType;
    rootPath: string;
    targetVersion?: string;
    buildNumber?: number;
    bumpType?: BumpType;
    runtimeSyncNative?: boolean;
}

export interface PackageJsonContent {
    version?: string;
    name?: string;
    [key: string]: unknown;
}

export interface ExpoConfig {
    version?: string;
    expo?: {
        version?: string;
        ios?: {
            buildNumber?: string;
            [key: string]: unknown;
        };
        android?: {
            versionCode?: number;
            [key: string]: unknown;
        };
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface EASConfig {
    build?: {
        [profileName: string]: {
            autoIncrement?: boolean | 'version' | 'buildNumber';
            [key: string]: unknown;
        };
    };
    [key: string]: unknown;
}

export interface EASBuildProfile {
    name: string;
    autoIncrement?: boolean | 'version' | 'buildNumber';
}
