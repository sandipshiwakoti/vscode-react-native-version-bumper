import { REGEX_PATTERNS } from '../constants';
import { BumpResult, BumpType } from '../types';

export function replacePlaceholders(template: string, values: Record<string, string>): string {
    return template.replace(REGEX_PATTERNS.PLACEHOLDER_REPLACE, (_, key) => values[key] || '');
}

export function getPlaceholderValues(
    type: BumpType,
    results: BumpResult[],
    mainVersion: string | undefined,
    versionMap: { [platform: string]: string }
): Record<string, string> {
    let platformUpdatesString = '';

    const isExpoProject = versionMap['Expo'] !== undefined;

    if (isExpoProject && versionMap['Expo']) {
        platformUpdatesString = `v${versionMap['Expo']}`;
    } else {
        const hasAndroid = versionMap['Android'] !== undefined;
        const hasIOS = versionMap['iOS'] !== undefined;

        if (hasAndroid && hasIOS) {
            if (versionMap['Android'] === versionMap['iOS']) {
                platformUpdatesString = `v${versionMap['Android']}`;
            } else {
                platformUpdatesString = `Android v${versionMap['Android']}, iOS v${versionMap['iOS']}`;
            }
        } else if (hasAndroid) {
            platformUpdatesString = `Android v${versionMap['Android']}`;
        } else if (hasIOS) {
            platformUpdatesString = `iOS v${versionMap['iOS']}`;
        } else if (versionMap['Package.json']) {
            platformUpdatesString = `package.json v${versionMap['Package.json']}`;
        } else {
            platformUpdatesString = `v${mainVersion || 'manual'}`;
        }
    }

    return {
        platformUpdates: platformUpdatesString,

        type,
        version: mainVersion || 'manual',
        androidVersion: versionMap['Android'] || 'unknown',
        iosVersion: versionMap['iOS'] || 'unknown',
    };
}
