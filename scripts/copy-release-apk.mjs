/**
 * Copy android/app/build/outputs/apk/release/app-release.apk → release-builds/
 * Name: app-release-v{x.x.x.x.x}-{YYYYMMDD}-{HHMM}.apk (see .cursor/rules/project-structure-and-messages.mdc §6).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = path.join(ROOT, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const ver = pkg.version;

const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

const fileName = `app-release-v${ver}-${stamp}.apk`;
const src = path.join(ROOT, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const destDir = path.join(ROOT, 'release-builds');
const dest = path.join(destDir, fileName);

if (!fs.existsSync(src)) {
  console.error(`Missing release APK. Run Gradle assembleRelease first:\n  ${src}`);
  process.exit(1);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied: ${path.relative(ROOT, dest)}`);
