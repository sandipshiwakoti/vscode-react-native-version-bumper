import { REGEX_PATTERNS } from '../constants';
import { BumpResult, BumpType, Platform } from '../types';

export function replacePlaceholders(template: string, values: Record<string, string>): string {
    return template.replace(REGEX_PATTERNS.PLACEHOLDER_REPLACE, (_, key) => values[key] || '');
}

export function getPlaceholderValues(
    type: BumpType,
    results: BumpResult[],
    mainVersion: string | undefined,
    versionMap: { [platform: string]: string },
    buildNumberMap: { [platform: string]: string }
): Record<string, string> {
    const platformUpdates = results
        .filter((r) => r.success && r.newVersion && (r.platform === Platform.ANDROID || r.platform === Platform.IOS))
        .map((r) => {
            const platformName = r.platform === Platform.ANDROID ? 'Android' : 'iOS';
            return `${platformName} v${versionMap[r.platform]} (build ${buildNumberMap[r.platform]})`;
        });

    const packageResult = results.find((r) => r.success && r.platform === Platform.PACKAGE_JSON);
    if (packageResult && versionMap[Platform.PACKAGE_JSON]) {
        platformUpdates.unshift(`package.json v${versionMap[Platform.PACKAGE_JSON]}`);
    }

    const platformUpdatesString = platformUpdates.join(', ');
    const date = new Date().toISOString().split('T')[0];

    return {
        type,
        platformUpdates: platformUpdatesString,
        version: mainVersion || 'manual',
        date,
        androidVersion: versionMap[Platform.ANDROID] || 'unknown',
        iosVersion: versionMap[Platform.IOS] || 'unknown',
        androidBuildNumber: buildNumberMap[Platform.ANDROID] || 'N/A',
        iosBuildNumber: buildNumberMap[Platform.IOS] || 'N/A',
    };
}
