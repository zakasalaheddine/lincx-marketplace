import { spawn } from 'node:child_process';

export function resolveOpenCommand(platform, filePath) {
  if (platform === 'darwin') return { cmd: 'open', args: [filePath] };
  if (platform === 'linux') return { cmd: 'xdg-open', args: [filePath] };
  if (platform === 'win32') return { cmd: 'cmd.exe', args: ['/c', 'start', '""', filePath] };
  return null;
}

export function openInBrowser(filePath) {
  const resolved = resolveOpenCommand(process.platform, filePath);
  if (!resolved) return { ok: false, reason: `unsupported platform: ${process.platform}` };
  try {
    const child = spawn(resolved.cmd, resolved.args, { detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}
