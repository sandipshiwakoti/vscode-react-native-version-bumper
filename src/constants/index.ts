export const EXTENSION_ID = 'reactNativeVersionBumper';
export const EXTENSION_FULL_ID = 'vscode-react-native-version-bumper';
export const EXTENSION_PUBLISHER_ID = 'sandipshiwakoti.vscode-react-native-version-bumper';

export const COMMAND_NAMES = {
    BUMP_APP_VERSION: 'bumpAppVersion',
    BUMP_APP_VERSION_WITH_GIT: 'bumpAppVersionWithGit',
    SYNC_VERSIONS: 'syncVersions',
    SYNC_VERSIONS_WITH_GIT: 'syncVersionsWithGit',
    SHOW_VERSIONS: 'showVersions',
    BUMP_PATCH: 'bumpPatch',
    BUMP_MINOR: 'bumpMinor',
    BUMP_MAJOR: 'bumpMajor',
    SHOW_CODE_LENS: 'showCodeLens',
    HIDE_CODE_LENS: 'hideCodeLens',
    IS_CODE_LENS_ENABLED: 'isCodeLensEnabled',
} as const;

export const COMMANDS = {
    BUMP_APP_VERSION: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.BUMP_APP_VERSION}`,
    BUMP_APP_VERSION_WITH_GIT: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.BUMP_APP_VERSION_WITH_GIT}`,
    SYNC_VERSIONS: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.SYNC_VERSIONS}`,
    SYNC_VERSIONS_WITH_GIT: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.SYNC_VERSIONS_WITH_GIT}`,
    SHOW_VERSIONS: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.SHOW_VERSIONS}`,
    BUMP_PATCH: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.BUMP_PATCH}`,
    BUMP_MINOR: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.BUMP_MINOR}`,
    BUMP_MAJOR: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.BUMP_MAJOR}`,
    SHOW_CODE_LENS: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.SHOW_CODE_LENS}`,
    HIDE_CODE_LENS: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.HIDE_CODE_LENS}`,
    IS_CODE_LENS_ENABLED: `${EXTENSION_FULL_ID}.${COMMAND_NAMES.IS_CODE_LENS_ENABLED}`,
} as const;

export const CONFIG = {
    ENABLE_CODE_LENS: 'enableCodeLens',
    SHOW_IN_STATUS_BAR: 'showInStatusBar',
    SKIP_ANDROID: 'skipAndroid',
    SKIP_IOS: 'skipIOS',
    SKIP_PACKAGE_JSON: 'skipPackageJson',
    ANDROID_BUILD_GRADLE_PATH: 'android.buildGradlePath',
    IOS_INFO_PLIST_PATH: 'ios.infoPlistPath',
    IOS_PROJECT_PB_XPROJ_PATH: 'ios.projectPbxprojPath',
    GIT_AUTO_CREATE_BRANCH: 'git.autoCreateBranch',
    GIT_SKIP_BRANCH: 'git.skipBranch',
    GIT_AUTO_CREATE_TAG: 'git.autoCreateTag',
    GIT_SKIP_TAG: 'git.skipTag',
    GIT_SKIP_PUSH: 'git.skipPush',
    GIT_BRANCH_NAME_TEMPLATE: 'git.branchNameTemplate',
    GIT_COMMIT_MESSAGE_PREFIX: 'git.commitMessagePrefix',
    GIT_SYNC_COMMIT_MESSAGE_PREFIX: 'git.syncCommitMessagePrefix',
    GIT_TAG_NAME_TEMPLATE: 'git.tagNameTemplate',
    BATCH_MODE: 'batchMode',
    EXPO_SYNC_NATIVE_FILES: 'expo.syncNativeFiles',
} as const;

export const CODELENS = {
    ENABLED_KEY: 'codeLensEnabled',
    CONTEXT_KEY: 'reactNativeVersionBumper.codeLensEnabled',
} as const;

export const FILE_EXTENSIONS = {
    PACKAGE_JSON: 'package.json',
    BUILD_GRADLE: 'build.gradle',
    INFO_PLIST: 'Info.plist',
    XCODEPROJ: '.xcodeproj',
    XCWORKSPACE: '.xcworkspace',
    APP_JSON: 'app.json',
    APP_CONFIG_JS: 'app.config.js',
    APP_CONFIG_TS: 'app.config.ts',
    EAS_JSON: 'eas.json',
    PROJECT_PBXPROJ: 'project.pbxproj',
} as const;

export const FILE_PATTERNS = {
    PACKAGE_JSON_PATTERN: '**/package.json',
    BUILD_GRADLE_PATTERN: '**/build.gradle',
    INFO_PLIST_PATTERN: '**/Info.plist',
    APP_JSON_PATTERN: '**/app.json',
    APP_CONFIG_PATTERN: '**/app.config.{js,ts}',
    ANDROID_BUILD_GRADLE_DEFAULT: 'android/app/build.gradle',
    IOS_FOLDER: 'ios',
    ANDROID_FOLDER: 'android',
} as const;

export const REGEX_PATTERNS = {
    VERSION_CODE: /versionCode\s+(\d+)/,
    VERSION_NAME: /versionName\s+["']([^"']+)["']/,
    VERSION_CODE_REPLACE: /versionCode\s+\d+/,
    VERSION_NAME_REPLACE: /versionName\s+["'][^"']+["']/,
    SEMANTIC_VERSION: /^\d+\.\d+\.\d+$/,
    VERSION_MATCH: /^v?([\d.]+)(?:\s*\((\d+)\))?/,
    BUILD_NUMBER_EXTRACT: /(\d+)/,
    PLIST_VARIABLE: /\$\([^)]+\)/,
    PLIST_VARIABLE_MATCH: /<string>\$\(([^)]+)\)<\/string>/,
    PLIST_STRING_MATCH: /<string>([^<]+)<\/string>/,
    PLIST_STRING_REPLACE: /<string>[^<]+<\/string>/,
    PLACEHOLDER_REPLACE: /{([a-zA-Z]+)}/g,
    PACKAGE_NAME_CLEAN: /[@\/\-_]/g,
    FIRST_CHAR_UPPER: /^\w/,
    PBXPROJ_VERSION_PATTERNS: {
        QUOTED: (varName: string) => new RegExp(`${varName}\\s*=\\s*["']([^"']+)["']`, 'gi'),
        SEMICOLON: (varName: string) => new RegExp(`${varName}\\s*=\\s*([\\d\\.]+);`, 'gi'),
        SIMPLE: (varName: string) => new RegExp(`${varName}\\s*=\\s*([\\d\\.]+)`, 'gi'),
        BUILD_QUOTED: (varName: string) => new RegExp(`${varName}\\s*=\\s*["']?(\\d+)["']?;`, 'gi'),
        BUILD_SIMPLE: (varName: string) => new RegExp(`${varName}\\s*=\\s*(\\d+)`, 'gi'),
    },
} as const;

export const IOS_PLIST_KEYS = {
    BUNDLE_VERSION: '<key>CFBundleVersion</key>',
    BUNDLE_SHORT_VERSION: '<key>CFBundleShortVersionString</key>',
} as const;

export const ANDROID_GRADLE_KEYS = {
    VERSION_CODE: 'versionCode',
    VERSION_NAME: 'versionName',
    DEFAULT_CONFIG: 'defaultConfig {',
    CLOSING_BRACE: '}',
} as const;

export const PROGRESS_INCREMENTS = {
    START: 0,
    TASKS_PREPARED: 20,
    TASKS_COMPLETED_MAX: 60,
    GIT_COMPLETED: 90,
    FINISHED: 100,
} as const;

export const DEFAULT_VALUES = {
    SEMANTIC_VERSION: '0.0.0',
    VERSION_CODE: 0,
    VERSION_NAME: '',
    BUILD_NUMBER: '1',
    VERSION_LINE_INDEX: -1,
    STATUS_BAR_PRIORITY: 100,
    JSON_INDENT: 2,
    NEWLINE: '\n',
    NOT_AVAILABLE: 'N/A',
};

export const VERSION_PART_INDICES = {
    MAJOR: 0,
    MINOR: 1,
    PATCH: 2,
} as const;

export const BUMP_TYPE_LABELS = {
    PATCH: 'Patch',
    MINOR: 'Minor',
    MAJOR: 'Major',
    CUSTOM: 'Custom',
} as const;

export const TEMPLATES = {
    GIT_COMMIT_MESSAGE_PREFIX: 'chore: bump version to ',
    GIT_SYNC_COMMIT_MESSAGE_PREFIX: 'chore: sync version to ',
    GIT_BRANCH_PREFIX: 'release/',
    GIT_TAG_NAME: 'v{version}',
} as const;

export const RELEASE_TEMPLATE_PATHS = [
    '.github/RELEASE_TEMPLATE.md',
    '.github/release_template.md',
    '.github/RELEASE_NOTES_TEMPLATE.md',
    '.gitlab/RELEASE_TEMPLATE.md',
    '.gitlab/release_template.md',
    'RELEASE_TEMPLATE.md',
    'release_template.md',
];
