import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readSessionState, writeSessionState } from './session-state.mjs';

const TOKEN_RE = /\{\{\s*(&\s*)?([\w.]+)\s*\}\}/g;

export function htmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function substituteTokens(template, record) {
  return template.replace(TOKEN_RE, (_, bang, path) => {
    const value = path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), record);
    if (value === undefined || value === null) return '';
    return bang ? String(value) : htmlEscape(value);
  });
}

const SAMPLE_BY_TYPE = {
  string: (name, i) => `Sample ${name} ${i + 1}`,
  url: (_, i) => `https://example.com/sample-${i + 1}`,
  number: (_, i) => String(100 + i),
  boolean: (_, i) => (i % 2 === 0 ? 'true' : 'false'),
  image: (_, i) => `https://placehold.co/300x200?text=ad+${i + 1}`,
};

export function synthesizeMockAds(cagSchema, count = 2) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const ad = {};
    for (const field of cagSchema.fields ?? []) {
      const sampler = SAMPLE_BY_TYPE[field.type] ?? SAMPLE_BY_TYPE.string;
      ad[field.name] = sampler(field.name, i);
    }
    out.push(ad);
  }
  return out;
}

export function validateAdsShape(schema, ads) {
  if (!Array.isArray(ads) || ads.length === 0) return false;
  const requiredFields = (schema.fields ?? []).map(f => f.name);
  return ads.every(ad =>
    ad && typeof ad === 'object' &&
    requiredFields.every(n => Object.prototype.hasOwnProperty.call(ad, n))
  );
}

export function renderPreview({ html, css, cagSchema, mockAds, previewPath }) {
  if (!html) return { ok: false, reason: 'MISSING_HTML' };
  if (!cagSchema) return { ok: false, reason: 'MISSING_SCHEMA' };

  let ads = mockAds;
  let usedFallback = false;
  if (!validateAdsShape(cagSchema, ads)) {
    ads = synthesizeMockAds(cagSchema, 2);
    usedFallback = true;
  }

  const iterations = ads.map((ad, i) => {
    const body = substituteTokens(html, ad);
    return `<div class="lincx-preview-ad"><div class="lincx-preview-label">ad #${i + 1}</div>${body}</div>`;
  }).join('\n');

  const out = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Lincx template preview</title>
<style>
${css}
body { margin: 0; padding: 16px; background: #f4f4f4; }
.lincx-preview-ad { background: white; padding: 12px; margin: 0 0 16px 0; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.lincx-preview-ad > .lincx-preview-label { font: 11px system-ui; color: #888; margin-bottom: 8px; }
</style>
</head>
<body>
${iterations}
</body>
</html>`;

  writeFileSync(previewPath, out);
  return { ok: true, usedFallback };
}

// CLI entry point — invoked by the hook: `node scripts/preview-render.mjs <entryId>`
export async function cli(argv, cwd = process.cwd()) {
  const entryId = argv[0];
  const logPath = `${cwd}/.lincx-session.log`;
  const statePath = `${cwd}/.lincx-session.json`;
  const markerPath = `${cwd}/.lincx-session.preview.pending`;

  function log(msg) {
    const line = `[${new Date().toISOString()}] preview-render: ${msg}\n`;
    try { writeFileSync(logPath, line, { flag: 'a' }); } catch {}
  }

  try {
    const state = readSessionState(statePath);
    if (!state) { log('no session state; exiting'); return 0; }
    if (state.previewDisabled) { log('preview disabled; exiting'); return 0; }

    const entry = (state.activeTemplates ?? []).find(e => e.id === entryId);
    if (!entry) { log(`entry ${entryId} not found; exiting`); return 0; }

    if (!existsSync(entry.htmlPath)) { log(`html missing at ${entry.htmlPath}; exiting`); return 0; }
    const html = readFileSync(entry.htmlPath, 'utf8');
    const css = existsSync(entry.cssPath) ? readFileSync(entry.cssPath, 'utf8') : '';

    if (!entry.cagSchema) {
      log('cagSchema missing from cache; run /lincx-template-refresh-schema');
      return 0;
    }

    const result = renderPreview({
      html, css,
      cagSchema: entry.cagSchema,
      mockAds: entry.mockAds,
      previewPath: entry.previewPath,
    });

    if (!result.ok) { log(`render failed: ${result.reason}`); return 0; }
    if (result.usedFallback) log('warning: mockAds invalid; fell back to synthesized');

    // First-preview: open in browser. Persist previewOpened so we don't reopen.
    if (!entry.previewOpened) {
      try {
        const { openInBrowser } = await import('./platform-open.mjs');
        const r = openInBrowser(entry.previewPath);
        if (r.ok) {
          const next = {
            ...state,
            activeTemplates: state.activeTemplates.map(e => e.id === entryId ? { ...e, previewOpened: true } : e),
          };
          writeSessionState(statePath, next);
          log(`opened ${entry.previewPath} in browser`);
        } else {
          log(`could not open browser: ${r.reason}`);
        }
      } catch (e) { log(`open failed: ${e.message}`); }
    } else {
      log(`rewrote ${entry.previewPath}`);
    }

    return 0;
  } finally {
    try { if (existsSync(markerPath)) writeFileSync(markerPath, ''); } catch {}
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await cli(process.argv.slice(2));
  process.exit(code);
}
