import { BumpResult, BumpType, PlatformKey } from "../types";

export function replacePlaceholders(
    template: string,
    values: Record<string, string>
): string {
    return template.replace(/{([a-zA-Z]+)}/g, (_, key) => values[key] || "");
}

export function getPlaceholderValues(
    type: BumpType,
    results: BumpResult[],
    mainVersion: string | undefined,
    versionMap: { [platform: string]: string },
    buildNumberMap: { [platform: string]: string }
): Record<string, string> {
    const platforms = results
        .filter(
            (r) =>
                r.success &&
                r.newVersion &&
                (r.platform === "Android" || r.platform === "iOS")
        )
        .map(
            (r) =>
                `${r.platform.toLowerCase()} to v${versionMap[r.platform]} (${buildNumberMap[r.platform]})`
        )
        .join(" and ");
    const date = new Date().toISOString().split("T")[0];
    return {
        type,
        platforms,
        version: mainVersion || "manual",
        date,
        androidVersion: versionMap["Android"] || "unknown",
        iosVersion: versionMap["iOS"] || "unknown",
        androidBuildNumber: buildNumberMap["Android"] || "N/A",
        iosBuildNumber: buildNumberMap["iOS"] || "N/A",
    };
}
