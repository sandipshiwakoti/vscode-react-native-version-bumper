import { PlatformKey } from '../types';

export const INITIAL_SEMANTIC_VERSION = '0.0.0';

export const GIT_DEFAULT_COMMIT_MESSAGE_TEMPLATE = 'chore: bump {platforms}';
export const GIT_DEFAULT_BRANCH_PREFIX = 'version-bump/';
export const GIT_DEFAULT_TAG_NAME_TEMPLATE = 'v{version}';

export const CONFIG_ENABLE_CODE_LENS = 'enableCodeLens';
export const CONFIG_SHOW_IN_STATUS_BAR = 'showInStatusBar';
export const CONFIG_SKIP_ANDROID = 'skipAndroid';
export const CONFIG_SKIP_IOS = 'skipIOS';
export const CONFIG_SKIP_PACKAGE_JSON = 'skipPackageJson';
export const CONFIG_ANDROID_BUILD_GRADLE_PATH = 'android.buildGradlePath';
export const CONFIG_IOS_INFO_PLIST_PATH = 'ios.infoPlistPath';
export const CONFIG_GIT_AUTO_COMMIT = 'git.autoCommit';
export const CONFIG_GIT_AUTO_CREATE_BRANCH = 'git.autoCreateBranch';
export const CONFIG_GIT_SKIP_BRANCH = 'git.skipBranch';
export const CONFIG_GIT_AUTO_CREATE_TAG = 'git.autoCreateTag';
export const CONFIG_GIT_SKIP_TAG = 'git.skipTag';
export const CONFIG_GIT_SKIP_PUSH = 'git.skipPush';
export const CONFIG_GIT_BRANCH_NAME_TEMPLATE = 'git.branchNameTemplate';
export const CONFIG_GIT_COMMIT_MESSAGE_TEMPLATE = 'git.commitMessageTemplate';
export const CONFIG_GIT_TAG_NAME_TEMPLATE = 'git.tagNameTemplate';

export const CODELENS_ENABLED_KEY = 'codeLensEnabled';
export const CODELENS_CONTEXT_KEY = 'reactNativeVersionBumper.codeLensEnabled';

export const PLATFORM_ICONS: { [key in PlatformKey]: string } = {
    'Package.json': '📦',
    Android: '🤖',
    iOS: '🍎',
    Git: '🔄',
};
