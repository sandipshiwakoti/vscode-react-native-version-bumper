import * as fs from "fs";
import path from "path";
import { ProjectType } from "../types";

export async function detectProjectType(
    rootPath: string
): Promise<ProjectType> {
    const androidPath = path.join(rootPath, "android");
    const iosPath = path.join(rootPath, "ios");
    const hasAndroid = fs.existsSync(androidPath);
    const hasIos = fs.existsSync(iosPath);
    return hasAndroid && hasIos ? "react-native" : "react-native";
}

export async function findInfoPlistPath(
    iosPath: string
): Promise<string | null> {
    const possiblePlistPaths = [path.join(iosPath, "Info.plist")];
    try {
        const iosContents = fs.readdirSync(iosPath);
        const projectDirs = iosContents.filter(
            (item) =>
                fs.statSync(path.join(iosPath, item)).isDirectory() &&
                !item.endsWith(".xcodeproj") &&
                !item.endsWith(".xcworkspace")
        );
        projectDirs.forEach((dir) =>
            possiblePlistPaths.push(path.join(iosPath, dir, "Info.plist"))
        );
    } catch (error) {}

    return (
        possiblePlistPaths.find((checkPath) => fs.existsSync(checkPath)) || null
    );
}
