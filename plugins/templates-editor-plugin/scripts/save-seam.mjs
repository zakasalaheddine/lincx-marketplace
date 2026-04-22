import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

export function nextVersionNumber(versionsDir) {
  if (!existsSync(versionsDir)) return 1;
  const existing = readdirSync(versionsDir)
    .map(name => /^v(\d+)\.html$/.exec(name))
    .filter(Boolean)
    .map(m => Number(m[1]));
  if (existing.length === 0) return 1;
  return Math.max(...existing) + 1;
}

export function buildArtifact({ html, css }) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${css}
</style>
</head>
<body>
${html}
</body>
</html>`;
}

export function computeDiffSummary(before, after) {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  let added = 0, removed = 0;
  for (const line of afterLines) if (!beforeSet.has(line)) added++;
  for (const line of beforeLines) if (!afterSet.has(line)) removed++;
  return `+${added} -${removed} lines`;
}

function doLocalSave(entry) {
  const html = readFileSync(entry.htmlPath, 'utf8');
  const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
  const versionsDir = join(dirname(entry.htmlPath), 'versions');
  if (!existsSync(versionsDir)) mkdirSync(versionsDir, { recursive: true });
  const n = nextVersionNumber(versionsDir);
  const artifactPath = join(versionsDir, `v${n}.html`);

  const artifact = buildArtifact({ html, css });

  let diff = `first version (v${n})`;
  if (n > 1) {
    const prev = readFileSync(join(versionsDir, `v${n - 1}.html`), 'utf8');
    diff = computeDiffSummary(prev, artifact);
  }

  writeFileSync(artifactPath, artifact);

  const idHint = entry.templateId
    ? `paste into template \`${entry.templateId}\` in Lincx`
    : 'ready to paste as a new template';

  return {
    mode: 'local',
    artifactPath,
    version: n,
    summary: `${idHint}; ${diff}`,
  };
}

// Synchronous save — local mode only, or MCP mode where the caller passed
// a *synchronous* mcpWrite (e.g. a stub). If mcpWrite returns a promise,
// use saveAsync instead.
export function save(entry, opts = {}) {
  const { mcpWriteAvailable, mcpWrite } = opts;
  if (mcpWriteAvailable && entry.templateId && typeof mcpWrite === 'function') {
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
    try {
      const result = mcpWrite({ templateId: entry.templateId, html, css });
      if (result && typeof result.then === 'function') {
        throw new Error('mcpWrite returned a promise — use saveAsync');
      }
      return {
        mode: 'mcp',
        version: result?.version,
        summary: `pushed via MCP (version ${result?.version ?? '?'})`,
      };
    } catch (e) {
      const local = doLocalSave(entry);
      return { ...local, summary: `fell back from mcp: ${e.message}; ${local.summary}` };
    }
  }
  return doLocalSave(entry);
}

// Async save — use when mcpWrite returns a promise.
export async function saveAsync(entry, opts = {}) {
  const { mcpWriteAvailable, mcpWrite } = opts;
  if (mcpWriteAvailable && entry.templateId && typeof mcpWrite === 'function') {
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';
    try {
      const result = await mcpWrite({ templateId: entry.templateId, html, css });
      return {
        mode: 'mcp',
        version: result?.version,
        summary: `pushed via MCP (version ${result?.version ?? '?'})`,
      };
    } catch (e) {
      const local = doLocalSave(entry);
      return { ...local, summary: `fell back from mcp: ${e.message}; ${local.summary}` };
    }
  }
  return doLocalSave(entry);
}
