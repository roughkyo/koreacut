// electron-builder runs this before collecting files, including direct CLI builds.
const { execFileSync } = require('node:child_process');
const path = require('node:path');
exports.default = async context => {
  if (context.electronPlatformName === 'win32') {
    const fs = require('node:fs');
    const { createHash } = require('node:crypto');
    const directory = path.join(context.packager.projectDir, 'media-tools', 'win32-x64');
    const pins = JSON.parse(fs.readFileSync(path.join(directory, 'SHA256.json'), 'utf8'));
    for (const file of ['ffmpeg.exe', 'ffprobe.exe']) {
      const digest = createHash('sha256').update(fs.readFileSync(path.join(directory, file))).digest('hex');
      if (digest !== pins[file]) throw new Error('Windows 미디어 도구 체크섬 불일치: ' + file);
    }
    return;
  }
  if (context.electronPlatformName !== 'darwin') return;
  const architecture = { 1: 'x64', 3: 'arm64' }[context.arch];
  if (process.platform !== 'darwin' || architecture !== process.arch)
    throw new Error('Build the macOS installer on a matching native architecture for bundled media tools.');
  execFileSync(process.execPath, [path.join(context.packager.projectDir, 'scripts/build-media-tools.mjs')], { stdio: 'inherit' });
};
