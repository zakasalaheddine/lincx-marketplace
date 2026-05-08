import { writeFileSync, readFileSync } from 'node:fs';
import { resolve as pathResolve } from 'node:path';
import { validateAdsShape, synthesizeMockAds } from './preview-render.mjs';

function assertWithinRoot(absPath, projectRoot) {
  const root = pathResolve(projectRoot) + '/';
  const target = pathResolve(absPath);
  if (target !== pathResolve(projectRoot) && !target.startsWith(root)) {
    throw new Error(`refusing to write ${absPath} — outside project root ${projectRoot}`);
  }
}

/**
 * Pure function: takes a preview bundle from get_template_preview_bundle and
 * an entry's path config; writes html/css to disk and returns a session-state
 * patch object the skill merges via upsertEntry.
 */
export function resolveBundle({ bundle, entryId, htmlPath, cssPath, projectRoot }) {
  assertWithinRoot(htmlPath, projectRoot);
  assertWithinRoot(cssPath, projectRoot);

  writeFileSync(htmlPath, bundle.html ?? '');
  writeFileSync(cssPath, bundle.css ?? '');

  const warnings = [...(bundle.warnings ?? [])];
  let mockAds = bundle.mockAds ?? [];
  let kind;
  let zoneId = null;

  if (bundle.source === 'zone') {
    if (validateAdsShape(bundle.cagSchema, mockAds)) {
      kind = 'zone-resolved';
      zoneId = bundle.chosenZoneId ?? null;
    } else {
      // Server said zone, but ads don't match the CAG. Fall back locally.
      mockAds = synthesizeMockAds(bundle.cagSchema, 2);
      kind = 'synthesized-fallback';
      warnings.push('Zone ads failed CAG validation; using synthesized fallback.');
    }
  } else {
    kind = 'synthesized';
  }

  return {
    id: entryId,
    htmlPath,
    cssPath,
    templateId: bundle.templateId,
    creativeAssetGroupId: bundle.creativeAssetGroupId,
    version: bundle.version ?? null,
    cagSchema: bundle.cagSchema,
    mockAds,
    mockAdsSource: { kind, zoneId, warnings },
  };
}

// CLI: node resolve-zone-and-ads.mjs <bundlePath> <entryId> <htmlPath> <cssPath> <projectRoot>
// Prints the patch object as JSON on stdout.
export function cli(argv) {
  const [bundlePath, entryId, htmlPath, cssPath, projectRoot] = argv;
  if (!bundlePath || !entryId || !htmlPath || !cssPath || !projectRoot) {
    process.stderr.write('usage: resolve-zone-and-ads <bundlePath> <entryId> <htmlPath> <cssPath> <projectRoot>\n');
    return 2;
  }
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const patch = resolveBundle({ bundle, entryId, htmlPath, cssPath, projectRoot });
  process.stdout.write(JSON.stringify(patch));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(cli(process.argv.slice(2)));
}
