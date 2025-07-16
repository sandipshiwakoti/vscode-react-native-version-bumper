import * as vscode from "vscode";
import * as fs from "fs";
import { BumpType, ProjectVersions } from "../types";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { findInfoPlistPath } from "./fileUtils";
import {
    CONFIG_IOS_INFO_PLIST_PATH,
    INITIAL_SEMANTIC_VERSION,
} from "../constants";

const execAsync = promisify(exec);

export async function getCurrentVersions(): Promise<ProjectVersions> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        throw new Error("No workspace folder found");
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const versions: ProjectVersions = {};

    try {
        const packageJsonPath = path.join(rootPath, "package.json");
        if (fs.existsSync(packageJsonPath)) {
            versions.packageJson = JSON.parse(
                fs.readFileSync(packageJsonPath, "utf8")
            ).version;
        }

        const buildGradlePath = path.join(
            rootPath,
            "android",
            "app",
            "build.gradle"
        );
        if (fs.existsSync(buildGradlePath)) {
            const content = fs.readFileSync(buildGradlePath, "utf8");
            const versionCodeMatch = content.match(/versionCode\s+(\d+)/);
            const versionNameMatch = content.match(
                /versionName\s+["']([^"']+)["']/
            );
            if (versionCodeMatch && versionNameMatch) {
                versions.android = {
                    versionCode: parseInt(versionCodeMatch[1]),
                    versionName: versionNameMatch[1],
                };
            }
        }

        const iosPath = path.join(rootPath, "ios");
        if (fs.existsSync(iosPath)) {
            const config = vscode.workspace.getConfiguration(
                "reactNativeVersionBumper"
            );
            const plistPath = config.get(CONFIG_IOS_INFO_PLIST_PATH)
                ? path.join(
                      rootPath,
                      config.get(CONFIG_IOS_INFO_PLIST_PATH) as string
                  )
                : await findInfoPlistPath(iosPath);
            if (plistPath) {
                const plistContent = fs.readFileSync(plistPath, "utf8");
                const plistLines = plistContent.split("\n");
                const plistUsesVariables = /\$\([^)]+\)/.test(plistContent);

                if (plistUsesVariables) {
                    let versionVarName = "";
                    let buildVarName = "";
                    for (let i = 0; i < plistLines.length; i++) {
                        const line = plistLines[i].trim();
                        if (
                            line.includes(
                                "<key>CFBundleShortVersionString</key>"
                            )
                        ) {
                            const nextLine = plistLines[i + 1].trim();
                            const match = nextLine.match(
                                /<string>\$\(([^)]+)\)<\/string>/
                            );
                            if (match) {
                                versionVarName = match[1];
                            }
                        }
                        if (line.includes("<key>CFBundleVersion</key>")) {
                            const nextLine = plistLines[i + 1].trim();
                            const match = nextLine.match(
                                /<string>\$\(([^)]+)\)<\/string>/
                            );
                            if (match) {
                                buildVarName = match[1];
                            }
                        }
                    }

                    if (!versionVarName || !buildVarName) {
                        const bundleVersionMatch = plistContent.match(
                            /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/
                        );
                        const bundleShortVersionMatch = plistContent.match(
                            /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
                        );
                        if (bundleVersionMatch && bundleShortVersionMatch) {
                            versions.ios = {
                                buildNumber: bundleVersionMatch[1],
                                version: bundleShortVersionMatch[1],
                            };
                        }
                        return versions;
                    }

                    let pbxprojPath: string | null | undefined = config.get(
                        "ios.projectPbxprojPath"
                    );
                    if (pbxprojPath) {
                        pbxprojPath = path.join(rootPath, pbxprojPath);
                    } else {
                        const iosContents = fs.readdirSync(iosPath);
                        const xcodeprojDir = iosContents.find((item) =>
                            item.endsWith(".xcodeproj")
                        );
                        if (xcodeprojDir) {
                            pbxprojPath = path.join(
                                iosPath,
                                xcodeprojDir,
                                "project.pbxproj"
                            );
                        }
                    }

                    if (pbxprojPath && fs.existsSync(pbxprojPath)) {
                        let pbxContent = fs.readFileSync(pbxprojPath, "utf8");

                        const buildNumberMatch =
                            pbxContent.match(
                                new RegExp(
                                    `${buildVarName}\\s*=\\s*(["']?)(\\d+)\\1`,
                                    "i"
                                )
                            ) ||
                            pbxContent.match(
                                new RegExp(
                                    `${buildVarName}\\s*=\\s*(\\d+)`,
                                    "i"
                                )
                            );

                        const versionMatch =
                            pbxContent.match(
                                new RegExp(
                                    `${versionVarName}\\s*=\\s*(["']?)([^;"']+)\\1`,
                                    "i"
                                )
                            ) ||
                            pbxContent.match(
                                new RegExp(
                                    `${versionVarName}\\s*=\\s*([^;]+)`,
                                    "i"
                                )
                            );

                        if (buildNumberMatch && versionMatch) {
                            versions.ios = {
                                buildNumber:
                                    buildNumberMatch[
                                        buildNumberMatch.length - 1
                                    ],
                                version: versionMatch[
                                    versionMatch.length - 1
                                ].replace(/['"]*/g, ""),
                            };
                        }
                    }
                } else {
                    const bundleVersionMatch = plistContent.match(
                        /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/
                    );
                    const bundleShortVersionMatch = plistContent.match(
                        /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
                    );
                    if (bundleVersionMatch && bundleShortVersionMatch) {
                        versions.ios = {
                            buildNumber: bundleVersionMatch[1],
                            version: bundleShortVersionMatch[1],
                        };
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error in getCurrentVersions:", error);
    }

    return versions;
}

export function bumpSemanticVersion(version: string, type: BumpType): string {
    const versionParts = version.split(".").map((part) => parseInt(part) || 0);
    while (versionParts.length < 3) {
        versionParts.push(0);
    }

    switch (type) {
        case "major":
            versionParts[0] += 1;
            versionParts[1] = 0;
            versionParts[2] = 0;
            break;
        case "minor":
            versionParts[1] += 1;
            versionParts[2] = 0;
            break;
        case "patch":
            versionParts[2] += 1;
            break;
    }
    return versionParts.join(".");
}

export async function getLatestGitTagVersion(
    rootPath: string
): Promise<string> {
    try {
        try {
            const { stdout } = await execAsync(
                "git describe --tags --abbrev=0",
                { cwd: rootPath }
            );
            const latestTag = stdout.trim();

            if (latestTag) {
                const versionMatch = latestTag.match(/v?(\d+\.\d+\.\d+)/);
                if (versionMatch) {
                    return versionMatch[1];
                }
            }
        } catch (describeError) {
            console.log(
                "getLatestGitTagVersion: git describe failed, trying git tag list approach"
            );
        }

        const { stdout } = await execAsync("git tag -l", { cwd: rootPath });
        const tags = stdout
            .trim()
            .split("\n")
            .filter((tag) => tag.trim());

        if (tags.length === 0) {
            return INITIAL_SEMANTIC_VERSION;
        }

        const versionTags = tags
            .map((tag) => {
                const match = tag.match(/v?(\d+\.\d+\.\d+)/);
                return match
                    ? {
                          tag,
                          version: match[1],
                          parts: match[1].split(".").map(Number),
                      }
                    : null;
            })
            .filter(Boolean)
            .sort((a, b) => {
                if (!a || !b) {
                    return 0;
                }
                for (let i = 0; i < 3; i++) {
                    if (a?.parts[i] !== b?.parts[i]) {
                        return b?.parts[i] - a?.parts[i];
                    }
                }
                return 0;
            });

        if (versionTags.length > 0) {
            return versionTags[0]!.version;
        }

        return INITIAL_SEMANTIC_VERSION;
    } catch (error) {
        try {
            const versions = await getCurrentVersions();
            const fallbackVersion =
                versions.packageJson || INITIAL_SEMANTIC_VERSION;
            return fallbackVersion;
        } catch {
            return INITIAL_SEMANTIC_VERSION;
        }
    }
}
