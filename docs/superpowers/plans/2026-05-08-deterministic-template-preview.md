# Deterministic Template Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the templates-editor preview render against real ads from the best-matching zone whenever possible, falling back to CAG-synthesized ads only when no zone is bound or the zone is empty.

**Architecture:** A new MCP tool `get_template_preview_bundle(templateId)` does the work in one server-side call (template + CAG + zone resolution + ad ranking). A thin helper script in the templates-editor-plugin validates the bundle, writes html/css to disk, and returns a session-state patch the skill merges. The existing `preview-render.mjs` is unchanged.

**Tech Stack:**
- `mcp/` repo: TypeScript, vitest, `@modelcontextprotocol/sdk`, zod, the existing `workApiRequest` service
- `lincx-marketplace/plugins/templates-editor-plugin/` repo: Node ESM (`*.mjs`), `node:test`, no external deps

**Repos and absolute roots used in this plan:**
- `MCP = /Users/salaheddinezaka/Documents/work/mcp`
- `MP  = /Users/salaheddinezaka/Documents/work/lincx-marketplace`
- `PLUGIN = $MP/plugins/templates-editor-plugin`
- `SPEC = $MP/docs/superpowers/specs/2026-05-08-deterministic-template-preview-design.md`

---

## Task 1: Discover the work-API endpoint that lists zones for a template

This is the spec's only Open Item. Nothing else can be built until it's resolved. Task 1 produces a written conclusion that Task 2 consumes — no code in this task.

**Files:**
- Create: `$MCP/docs/zones-for-template-endpoint.md` (decision record)

- [ ] **Step 1: Search lincx-core for the relevant route**

The work API is served by `lincx-core` (or `lincx-app` — confirm from `MCP/src/services/workApi.ts` which `WORK_API_URL` it points at). Search both for any route that lists zones bound to a template.

Run from `$MCP`:

```bash
echo "--- lincx-core ---"
grep -rn "templates/.*zones\|template_id\|templateId" /Users/salaheddinezaka/Documents/work/lincx-core/src 2>/dev/null | grep -iE "route|controller|handler|zone" | head -40
echo "--- lincx-app ---"
grep -rn "templates/.*zones\|template_id\|templateId" /Users/salaheddinezaka/Documents/work/lincx-app/src 2>/dev/null | grep -iE "route|controller|handler|zone" | head -40
echo "--- /api/zones routes ---"
grep -rn "router\.\(get\|post\)\([\"']/zones" /Users/salaheddinezaka/Documents/work/lincx-core/src /Users/salaheddinezaka/Documents/work/lincx-app/src 2>/dev/null | head -20
```

Expected: at least one of:
- `GET /api/templates/:id/zones` (preferred — direct)
- `GET /api/zones?templateId=…` (also fine — query filter)
- nothing (we'll have to add one)

- [ ] **Step 2: If a route exists, sanity-check its response shape**

Use the running MCP server (or a local `lincx-core` dev server) to hit it once with a real templateId.

```bash
# Replace TPL_ID with any real template id from a list_templates call.
curl -sS -H "Authorization: Bearer $LINCX_TOKEN" \
  "https://work-api.lincx.com/api/templates/TPL_ID/zones" | head -50
```

Expected fields per zone: `id`, `name` at minimum. Note whether ad counts are included or whether we'll need a second call per zone.

- [ ] **Step 3: If no route exists, propose the smallest addition**

If neither route exists, the cheapest path is `GET /api/zones?templateId=<id>` added to lincx-core's zones controller. It reuses the same query the existing zone listing uses, just with one extra filter. Avoid building a dedicated `/templates/:id/zones` controller unless the team prefers it.

- [ ] **Step 4: Write the decision record**

Create `$MCP/docs/zones-for-template-endpoint.md`:

```markdown
# Zones-for-template endpoint

## Decision
Use `<EXACT URL FOUND OR PROPOSED>`.

## Response shape (verified via curl)
```json
<paste the JSON sample, redacted>
```

## Ad-count strategy
- [ ] Counts inline (use `zone.adCount` directly), OR
- [ ] One extra call per zone via `/api/zones/:id/ads` and `length`.
Chosen: <fill in>.

## If a new endpoint is required
PR against lincx-core: <link or "TBD — opened separately">.
This MCP tool's implementation is blocked on that PR landing.
```

- [ ] **Step 5: Commit**

```bash
cd $MCP && git add docs/zones-for-template-endpoint.md && git commit -m "docs(mcp): zones-for-template endpoint decision record"
```

---

## Task 2a: Set up vitest mocking for `workApiRequest`

The MCP repo currently has only `smoke.test.ts`. We need a reusable pattern for unit-testing tools without hitting the work API.

**Files:**
- Create: `$MCP/src/tests/helpers/mockWorkApi.ts`

- [ ] **Step 1: Write the helper**

Create `$MCP/src/tests/helpers/mockWorkApi.ts`:

```typescript
import { vi } from "vitest";

/**
 * Mock the workApiRequest service for unit-testing tool registrations.
 * Returns a `respond(routeMatcher, payload)` builder that resolves a fake
 * response when the matcher matches the (method, path) pair.
 */
export function mockWorkApi() {
  const handlers: Array<{
    method: string;
    pathRe: RegExp;
    handler: (params?: Record<string, unknown>) => unknown;
  }> = [];

  vi.mock("../../services/workApi.js", () => ({
    workApiRequest: vi.fn(async (
      _session: unknown,
      method: string,
      path: string,
      opts?: { params?: Record<string, unknown> }
    ) => {
      const match = handlers.find(h => h.method === method && h.pathRe.test(path));
      if (!match) throw new Error(`mockWorkApi: unmatched ${method} ${path}`);
      return match.handler(opts?.params);
    }),
    handleWorkApiError: (err: Error) => `Error: ${err.message}`,
    truncateIfNeeded: (s: string) => s,
    stripListItems: (d: unknown) => d,
  }));

  vi.mock("../../services/sessionManager.js", () => ({
    resolveLincxSession: async () => "test-session",
    validateSession: async () => ({ valid: true, session: { token: "t" } }),
  }));

  return {
    on(method: string, pathRe: RegExp, handler: (params?: Record<string, unknown>) => unknown) {
      handlers.push({ method, pathRe, handler });
    },
    reset() { handlers.length = 0; },
  };
}
```

- [ ] **Step 2: Commit**

```bash
cd $MCP && git add src/tests/helpers/mockWorkApi.ts && git commit -m "test(mcp): work-api mock helper for tool unit tests"
```

---

## Task 2b: Add `get_template_preview_bundle` MCP tool — failing tests first

**Files:**
- Create: `$MCP/src/tests/templateTools.preview-bundle.test.ts`

- [ ] **Step 1: Write all six failing tests**

Create `$MCP/src/tests/templateTools.preview-bundle.test.ts`. Replace `<ZONES_PATH_RE>` with the regex matching the route from Task 1 (e.g. `/\/api\/templates\/[^/]+\/zones$/` or `/\/api\/zones\?templateId=/`).

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { mockWorkApi } from "./helpers/mockWorkApi.js";

const api = mockWorkApi();

// Import AFTER mocks are installed.
const { registerTemplateTools } = await import("../tools/templateTools.js");

function buildServerAndCallTool(args: Record<string, unknown>) {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerTemplateTools(server);
  // The SDK exposes a registry — find our tool and invoke it directly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tool = (server as any)._registeredTools["get_template_preview_bundle"];
  return tool.callback(args, { sessionId: "test-session" });
}

async function callBundle(templateId = "tpl_x") {
  const r = await buildServerAndCallTool({ templateId });
  // Tool returns { content: [{ type:"text", text: JSON_STRING }] }
  return JSON.parse(r.content[0].text);
}

beforeEach(() => api.reset());

describe("get_template_preview_bundle", () => {
  it("picks the zone with the highest ad count", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({
      data: { id: "tpl_x", html: "<h1>{{ headline }}</h1>", css: ".a{}", creativeAssetGroupId: "cag_y", version: 3 },
    }));
    api.on("GET", /\/api\/creative-asset-groups\/cag_y$/, () => ({
      data: { fields: [{ name: "headline", type: "string" }] },
    }));
    api.on("GET", <ZONES_PATH_RE>, () => ({ items: [{ id: "zn_A" }, { id: "zn_B" }] }));
    api.on("GET", /\/api\/zones\/zn_A\/ads$/, () => ({ items: [{ headline: "A1" }, { headline: "A2" }] }));
    api.on("GET", /\/api\/zones\/zn_B\/ads$/, () => ({ items: [{ headline: "B1" }, { headline: "B2" }, { headline: "B3" }] }));

    const out = await callBundle();
    expect(out.source).toBe("zone");
    expect(out.chosenZoneId).toBe("zn_B");
    expect(out.mockAds).toHaveLength(3);
    expect(out.mockAds[0].headline).toBe("B1");
    expect(out.warnings).toEqual([]);
  });

  it("breaks ties by API order (first zone wins)", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({ data: { id: "tpl_x", html: "", css: "", creativeAssetGroupId: "cag_y" } }));
    api.on("GET", /\/api\/creative-asset-groups\/cag_y$/, () => ({ data: { fields: [{ name: "headline", type: "string" }] } }));
    api.on("GET", <ZONES_PATH_RE>, () => ({ items: [{ id: "zn_A" }, { id: "zn_B" }] }));
    api.on("GET", /\/api\/zones\/zn_A\/ads$/, () => ({ items: [{ headline: "A1" }] }));
    api.on("GET", /\/api\/zones\/zn_B\/ads$/, () => ({ items: [{ headline: "B1" }] }));
    const out = await callBundle();
    expect(out.chosenZoneId).toBe("zn_A");
  });

  it("synthesizes when no zone is bound", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({ data: { id: "tpl_x", html: "<h1>{{ headline }}</h1>", css: "", creativeAssetGroupId: "cag_y" } }));
    api.on("GET", /\/api\/creative-asset-groups\/cag_y$/, () => ({ data: { fields: [{ name: "headline", type: "string" }] } }));
    api.on("GET", <ZONES_PATH_RE>, () => ({ items: [] }));
    const out = await callBundle();
    expect(out.source).toBe("synthesized");
    expect(out.chosenZoneId).toBeNull();
    expect(out.mockAds).toHaveLength(2);
    expect(out.mockAds[0].headline).toBe("Mock headline 1");
    expect(out.warnings.join(" ")).toMatch(/no zones/i);
  });

  it("synthesizes when every bound zone is empty", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({ data: { id: "tpl_x", html: "", css: "", creativeAssetGroupId: "cag_y" } }));
    api.on("GET", /\/api\/creative-asset-groups\/cag_y$/, () => ({ data: { fields: [{ name: "headline", type: "string" }] } }));
    api.on("GET", <ZONES_PATH_RE>, () => ({ items: [{ id: "zn_A" }] }));
    api.on("GET", /\/api\/zones\/zn_A\/ads$/, () => ({ items: [] }));
    const out = await callBundle();
    expect(out.source).toBe("synthesized");
    expect(out.warnings.join(" ")).toMatch(/empty/i);
  });

  it("errors when the template has no CAG", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({ data: { id: "tpl_x", html: "", css: "" /* no creativeAssetGroupId */ } }));
    const r = await buildServerAndCallTool({ templateId: "tpl_x" });
    expect(r.content[0].text).toMatch(/no linked creative asset group/i);
  });

  it("falls through to synthesized if zone resolution itself fails", async () => {
    api.on("GET", /\/api\/templates\/tpl_x$/, () => ({ data: { id: "tpl_x", html: "", css: "", creativeAssetGroupId: "cag_y" } }));
    api.on("GET", /\/api\/creative-asset-groups\/cag_y$/, () => ({ data: { fields: [{ name: "headline", type: "string" }] } }));
    api.on("GET", <ZONES_PATH_RE>, () => { throw new Error("zones endpoint 500"); });
    const out = await callBundle();
    expect(out.source).toBe("synthesized");
    expect(out.warnings.join(" ")).toMatch(/zone resolution failed/i);
  });
});
```

- [ ] **Step 2: Run tests; confirm all six fail**

```bash
cd $MCP && npx vitest run src/tests/templateTools.preview-bundle.test.ts
```

Expected: all six FAIL with `Cannot read properties of undefined (reading 'callback')` (the tool isn't registered yet).

- [ ] **Step 3: Commit the failing tests**

```bash
cd $MCP && git add src/tests/templateTools.preview-bundle.test.ts && git commit -m "test(mcp): get_template_preview_bundle (failing tests)"
```

---

## Task 2c: Implement `get_template_preview_bundle`

**Files:**
- Modify: `$MCP/src/tools/templateTools.ts` (add the tool below the existing `render_template` registration; reuse the file-private `generateMockAds` helper)

- [ ] **Step 1: Append the new tool registration**

Insert immediately before the closing `}` of `registerTemplateTools` in `$MCP/src/tools/templateTools.ts`:

```typescript
  // ── get_template_preview_bundle ─────────────────────────────────────────────
  server.registerTool("get_template_preview_bundle", {
    title: "Get Template Preview Bundle",
    description: `Fetch everything needed to preview a template locally: html, css, the CAG schema, and a mockAds array.

mockAds come from the zone (bound to this template) with the highest ad count.
If no zone is bound, or every bound zone is empty, mockAds are synthesized from the CAG schema.

Params:
  - templateId: ID of the template
  - version: optional version number (omit for latest)`,
    inputSchema: z.object({
      templateId: z.string().describe("Template ID"),
      version: z.number().int().min(1).optional(),
    }).strict(),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ templateId, version }, extra) => {
    const sessionId = await resolveLincxSession(extra?.sessionId);
    if (!sessionId) return { content: [{ type: "text" as const, text: "Error: Not authenticated. Use 'auth_login' first." }] };
    const v = await validateSession(sessionId);
    if (!v.valid || !v.session) return { content: [{ type: "text" as const, text: `Error: ${v.error}` }] };

    const warnings: string[] = [];

    try {
      // 1. Template
      const templatePath = version
        ? `/api/templates/${templateId}/versions/${version}`
        : `/api/templates/${templateId}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const templateResp = await workApiRequest<Record<string, unknown>>(v.session, "GET", templatePath);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tpl = (templateResp as any).data ?? templateResp;
      const html = String(tpl.html ?? tpl.htmlTemplate ?? "");
      const css = String(tpl.css ?? tpl.cssTemplate ?? "");
      const cagId = String(tpl.creativeAssetGroupId ?? tpl.creative_asset_group_id ?? tpl.assetGroupId ?? "");
      const tplVersion = (tpl.version as number | undefined) ?? version ?? null;

      if (!cagId) {
        return { content: [{ type: "text" as const, text: "Error: Template has no linked creative asset group. Cannot generate mock data." }] };
      }

      // 2. CAG
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cagResp = await workApiRequest<Record<string, unknown>>(v.session, "GET", `/api/creative-asset-groups/${cagId}`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cagData = (cagResp as any).data ?? cagResp;
      // Normalize to { fields: [...] }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields = (cagData.fields ?? cagData.assets ?? (cagData as any).schema?.fields ?? []) as Array<Record<string, unknown>>;
      const cagSchema = { fields };

      // 3. Zones for this template (endpoint confirmed in Task 1)
      // The exact path comes from docs/zones-for-template-endpoint.md.
      // Use `<ZONES_PATH>` literally — do not abstract until at least one other caller exists.
      let zones: Array<{ id: string; adCount?: number }> = [];
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zonesResp = await workApiRequest<any>(v.session, "GET", `<ZONES_PATH>`);
        zones = ((zonesResp.items ?? zonesResp.data ?? zonesResp) as Array<{ id: string; adCount?: number }>) ?? [];
      } catch (err) {
        warnings.push(`Zone resolution failed: ${(err as Error).message}. Using synthesized ads.`);
      }

      // 4. Pick winner (highest ad count). Use inline adCount when present;
      // otherwise fetch /api/zones/:id/ads and use length.
      let chosenZoneId: string | null = null;
      let mockAds: Record<string, unknown>[] = [];
      if (zones.length === 0) {
        if (warnings.length === 0) warnings.push("No zones are bound to this template. Using synthesized ads.");
      } else {
        const counted: Array<{ id: string; count: number; ads: Record<string, unknown>[] }> = [];
        for (const z of zones) {
          if (typeof z.adCount === "number") {
            counted.push({ id: z.id, count: z.adCount, ads: [] }); // ads fetched on-demand below
          } else {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const adsResp = await workApiRequest<any>(v.session, "GET", `/api/zones/${z.id}/ads`);
              const ads = ((adsResp.items ?? adsResp.data ?? adsResp) as Record<string, unknown>[]) ?? [];
              counted.push({ id: z.id, count: ads.length, ads });
            } catch {
              counted.push({ id: z.id, count: 0, ads: [] });
            }
          }
        }
        // Stable sort by count desc; ties keep API order.
        counted.sort((a, b) => b.count - a.count);
        const winner = counted[0];
        if (winner && winner.count > 0) {
          // If ads weren't materialized (inline-count branch), fetch now.
          if (winner.ads.length === 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const adsResp = await workApiRequest<any>(v.session, "GET", `/api/zones/${winner.id}/ads`);
            winner.ads = ((adsResp.items ?? adsResp.data ?? adsResp) as Record<string, unknown>[]) ?? [];
          }
          chosenZoneId = winner.id;
          mockAds = winner.ads;
        } else {
          warnings.push("Zones are bound to this template but contain no ads. Using synthesized ads.");
        }
      }

      const source: "zone" | "synthesized" = mockAds.length > 0 ? "zone" : "synthesized";
      if (source === "synthesized") {
        mockAds = generateMockAds(cagData, 2);
      }

      const result = {
        templateId,
        version: tplVersion,
        html, css,
        creativeAssetGroupId: cagId,
        cagSchema,
        chosenZoneId,
        mockAds,
        source,
        warnings,
      };
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: "text" as const, text: handleWorkApiError(err) }] };
    }
  });
```

Replace `<ZONES_PATH>` with the exact path from Task 1's decision record (e.g. `/api/templates/${templateId}/zones`).

- [ ] **Step 2: Run the new tests**

```bash
cd $MCP && npx vitest run src/tests/templateTools.preview-bundle.test.ts
```

Expected: all six PASS.

- [ ] **Step 3: Run the full mcp suite to confirm nothing else broke**

```bash
cd $MCP && npx vitest run
```

Expected: every test passes.

- [ ] **Step 4: Commit**

```bash
cd $MCP && git add src/tools/templateTools.ts && git commit -m "feat(mcp): get_template_preview_bundle tool"
```

---

## Task 3a: Helper script `resolve-zone-and-ads.mjs` — failing tests first

**Files:**
- Create: `$PLUGIN/tests/resolve-zone-and-ads.test.mjs`
- Create: `$PLUGIN/tests/fixtures/preview-bundles/zone.json`
- Create: `$PLUGIN/tests/fixtures/preview-bundles/synthesized.json`
- Create: `$PLUGIN/tests/fixtures/preview-bundles/invalid-ads.json`

- [ ] **Step 1: Write the three fixtures**

`$PLUGIN/tests/fixtures/preview-bundles/zone.json`:

```json
{
  "templateId": "tpl_x",
  "version": 3,
  "html": "<h1>{{ headline }}</h1>",
  "css": "h1{color:red}",
  "creativeAssetGroupId": "cag_y",
  "cagSchema": { "fields": [{ "name": "headline", "type": "string" }] },
  "chosenZoneId": "zn_B",
  "mockAds": [{ "headline": "Real B1" }, { "headline": "Real B2" }],
  "source": "zone",
  "warnings": []
}
```

`$PLUGIN/tests/fixtures/preview-bundles/synthesized.json`:

```json
{
  "templateId": "tpl_x",
  "version": 3,
  "html": "<h1>{{ headline }}</h1>",
  "css": "",
  "creativeAssetGroupId": "cag_y",
  "cagSchema": { "fields": [{ "name": "headline", "type": "string" }] },
  "chosenZoneId": null,
  "mockAds": [{ "headline": "Mock headline 1" }, { "headline": "Mock headline 2" }],
  "source": "synthesized",
  "warnings": ["No zones are bound to this template. Using synthesized ads."]
}
```

`$PLUGIN/tests/fixtures/preview-bundles/invalid-ads.json` — bundle says `source:zone` but ads miss the `headline` field, so the helper must fall back:

```json
{
  "templateId": "tpl_x",
  "version": 3,
  "html": "",
  "css": "",
  "creativeAssetGroupId": "cag_y",
  "cagSchema": { "fields": [{ "name": "headline", "type": "string" }] },
  "chosenZoneId": "zn_C",
  "mockAds": [{ "wrongField": "x" }],
  "source": "zone",
  "warnings": []
}
```

- [ ] **Step 2: Write the failing tests**

Create `$PLUGIN/tests/resolve-zone-and-ads.test.mjs`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBundle } from '../scripts/resolve-zone-and-ads.mjs';

const FIXTURES = fileURLToPath(new URL('./fixtures/preview-bundles/', import.meta.url));

function tmp() {
  const dir = mkdtempSync(join(tmpdir(), 'lincx-resolve-'));
  return {
    root: dir,
    htmlPath: join(dir, 'tpl.html'),
    cssPath: join(dir, 'tpl.css'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

function loadFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf8'));
}

test('zone-source bundle: writes html/css and emits zone-resolved patch', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('zone.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(readFileSync(htmlPath, 'utf8'), '<h1>{{ headline }}</h1>');
    assert.equal(readFileSync(cssPath, 'utf8'), 'h1{color:red}');
    assert.equal(patch.id, 'e1');
    assert.equal(patch.mockAdsSource.kind, 'zone-resolved');
    assert.equal(patch.mockAdsSource.zoneId, 'zn_B');
    assert.deepEqual(patch.mockAds, [{ headline: 'Real B1' }, { headline: 'Real B2' }]);
    assert.deepEqual(patch.mockAdsSource.warnings, []);
    assert.deepEqual(patch.cagSchema, { fields: [{ name: 'headline', type: 'string' }] });
  } finally { cleanup(); }
});

test('synthesized bundle: emits synthesized patch with warnings', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('synthesized.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(patch.mockAdsSource.kind, 'synthesized');
    assert.equal(patch.mockAdsSource.zoneId, null);
    assert.equal(patch.mockAdsSource.warnings.length, 1);
  } finally { cleanup(); }
});

test('zone bundle whose ads fail CAG validation falls back to synthesized-fallback', () => {
  const { root, htmlPath, cssPath, cleanup } = tmp();
  try {
    const patch = resolveBundle({
      bundle: loadFixture('invalid-ads.json'),
      entryId: 'e1',
      htmlPath, cssPath,
      projectRoot: root,
    });
    assert.equal(patch.mockAdsSource.kind, 'synthesized-fallback');
    assert.equal(patch.mockAds.length, 2);
    assert.ok(patch.mockAds.every(a => 'headline' in a), 'fallback ads must include all CAG fields');
    assert.match(patch.mockAdsSource.warnings.join(' '), /CAG validation/i);
  } finally { cleanup(); }
});

test('refuses to write outside the project root', () => {
  const { root, cleanup } = tmp();
  try {
    assert.throws(
      () => resolveBundle({
        bundle: loadFixture('zone.json'),
        entryId: 'e1',
        htmlPath: '/etc/passwd',
        cssPath: join(root, 'ok.css'),
        projectRoot: root,
      }),
      /outside project root/i,
    );
  } finally { cleanup(); }
});
```

- [ ] **Step 3: Run; confirm all four fail**

```bash
cd $PLUGIN && node --test tests/resolve-zone-and-ads.test.mjs
```

Expected: all FAIL with `Cannot find module '../scripts/resolve-zone-and-ads.mjs'`.

- [ ] **Step 4: Commit failing tests + fixtures**

```bash
cd $PLUGIN && git add tests/resolve-zone-and-ads.test.mjs tests/fixtures/preview-bundles && git commit -m "test(plugin): resolve-zone-and-ads (failing tests + fixtures)"
```

---

## Task 3b: Implement `resolve-zone-and-ads.mjs`

**Files:**
- Create: `$PLUGIN/scripts/resolve-zone-and-ads.mjs`

- [ ] **Step 1: Write the helper**

Create `$PLUGIN/scripts/resolve-zone-and-ads.mjs`:

```javascript
import { writeFileSync } from 'node:fs';
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
export async function cli(argv) {
  const [bundlePath, entryId, htmlPath, cssPath, projectRoot] = argv;
  if (!bundlePath || !entryId || !htmlPath || !cssPath || !projectRoot) {
    process.stderr.write('usage: resolve-zone-and-ads <bundlePath> <entryId> <htmlPath> <cssPath> <projectRoot>\n');
    return 2;
  }
  const { readFileSync } = await import('node:fs');
  const bundle = JSON.parse(readFileSync(bundlePath, 'utf8'));
  const patch = resolveBundle({ bundle, entryId, htmlPath, cssPath, projectRoot });
  process.stdout.write(JSON.stringify(patch));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(await cli(process.argv.slice(2)));
}
```

- [ ] **Step 2: Export `synthesizeMockAds` from `preview-render.mjs`**

Open `$PLUGIN/scripts/preview-render.mjs`. Both `validateAdsShape` and `synthesizeMockAds` are already declared with `export function` (verify lines 31 and 44 of the file). No change needed; if either is missing the `export` keyword, add it.

- [ ] **Step 3: Run the helper tests**

```bash
cd $PLUGIN && node --test tests/resolve-zone-and-ads.test.mjs
```

Expected: all four PASS.

- [ ] **Step 4: Run the full plugin suite**

```bash
cd $PLUGIN && node --test tests/
```

Expected: every test passes (existing tests untouched).

- [ ] **Step 5: Commit**

```bash
cd $PLUGIN && git add scripts/resolve-zone-and-ads.mjs && git commit -m "feat(plugin): resolve-zone-and-ads helper"
```

---

## Task 4: Update `editing-lincx-templates` SKILL.md (Flow A rewrite)

**Files:**
- Modify: `$PLUGIN/skills/editing-lincx-templates/SKILL.md` (Flow A section, lines ~66–75; Session-state shape, lines ~38–60)

- [ ] **Step 1: Update the session-state shape block**

In `$PLUGIN/skills/editing-lincx-templates/SKILL.md`, replace the JSON block under `## Session state` with the version below:

```json
{
  "previewDisabled": false,
  "activeTemplates": [
    {
      "id": "<stable id, e.g. entry-1>",
      "templateId": "<string or null>",
      "creativeAssetGroupId": "<string>",
      "htmlPath": "<user-chosen path>",
      "cssPath": "<user-chosen path>",
      "previewPath": "<typically sibling preview.html>",
      "version": "<number or null>",
      "dirty": false,
      "cagSchema": { "fields": [ ... ] },
      "mockAdsSource": {
        "kind": "zone-resolved | zone | synthesized | synthesized-fallback",
        "zoneId": "<string or null>",
        "warnings": ["..."]
      },
      "mockAds": []
    }
  ]
}
```

- [ ] **Step 2: Replace Flow A**

In the same file, replace the entire **Flow A — Adjust an existing template** section with:

```markdown
### Flow A — Adjust an existing template (from `/lincx-template-edit <id>`)

1. `auth_status` — if unauthenticated, tell the user to run `auth_login` and stop.
2. Ask the user where to place the files (prompt for `htmlPath` and `cssPath` under their current project). Do not default silently.
3. `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId=<id>)`. Surface any error inline; do not mutate session state on error.
4. Persist the returned bundle to `./.lincx-session.bundle.json` (caller-local, gitignored).
5. Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/resolve-zone-and-ads.mjs ./.lincx-session.bundle.json <entryId> <htmlPath> <cssPath> <projectRoot>`. The script writes html/css to disk and prints a session-state patch on stdout.
6. Merge the patch into `.lincx-session.json` via `upsertEntry`. Set `dirty:false`, `previewOpened:false`. Delete `./.lincx-session.bundle.json`.
7. If `mockAdsSource.warnings` is non-empty, print each warning to the user once.
8. Dispatch the renderer: `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>`. The browser opens.
9. Converse with the user. Apply the consult-references rule before authoring edits. Every Edit/Write triggers the hook, which re-renders silently using the cached `mockAds`. Mark `dirty:true` after any write.
10. On `/lincx-template-save` → Flow C.
```

- [ ] **Step 3: Update Flow F (refresh schema)**

Replace **Flow F — Refresh schema** with:

```markdown
### Flow F — Refresh schema (from `/lincx-template-refresh-schema`)

1. For each entry whose `mockAdsSource.kind` is `zone-resolved` or `synthesized-fallback`:
   - `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId=entry.templateId)`.
   - Run the resolver script as in Flow A step 5; merge the resulting patch.
   - Print any `warnings`.
2. For entries whose `kind` is `zone` (manual override) or `synthesized` (Flow B), only re-fetch the CAG via `mcp__claude_ai_Lincx__get_creative_asset_group(id=entry.creativeAssetGroupId)` and replace `cagSchema`. Leave `mockAds` and `mockAdsSource` unchanged.
3. Dispatch `preview-render.mjs` for each affected entry.
```

- [ ] **Step 4: Commit**

```bash
cd $MP && git add plugins/templates-editor-plugin/skills/editing-lincx-templates/SKILL.md && git commit -m "feat(plugin): rewrite Flow A around get_template_preview_bundle"
```

---

## Task 5: Update `lincx-template-edit` command file

**Files:**
- Modify: `$PLUGIN/commands/lincx-template-edit.md`

- [ ] **Step 1: Replace the file body**

Open `$PLUGIN/commands/lincx-template-edit.md` and read the existing content (Read tool first, then Edit). Replace the numbered steps in the body with:

```markdown
Invoke the `editing-lincx-templates` skill in **adjust** mode with `templateId={{arg}}`. The skill will:

1. Verify auth via `auth_status`.
2. Ask the user for `htmlPath` and `cssPath`.
3. Call `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId={{arg}})`. The bundle includes html, css, the CAG schema, the chosen zone id, and a `mockAds` array (real ads from the highest-traffic zone, or synthesized from the CAG if no zone is bound).
4. Persist the bundle to `./.lincx-session.bundle.json`, then run `node ${CLAUDE_PLUGIN_ROOT}/scripts/resolve-zone-and-ads.mjs ./.lincx-session.bundle.json <entryId> <htmlPath> <cssPath> <projectRoot>` to write files and produce a session-state patch.
5. Merge the patch into `./.lincx-session.json` via `scripts/session-state.mjs::upsertEntry` with `dirty:false`. Delete `./.lincx-session.bundle.json`.
6. Surface any `mockAdsSource.warnings` to the user.
7. Dispatch `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` to open the browser preview.
```

- [ ] **Step 2: Commit**

```bash
cd $MP && git add plugins/templates-editor-plugin/commands/lincx-template-edit.md && git commit -m "docs(plugin): /lincx-template-edit reflects bundle flow"
```

---

## Task 6: Update `lincx-template-refresh-schema` command file

**Files:**
- Modify: `$PLUGIN/commands/lincx-template-refresh-schema.md`

- [ ] **Step 1: Read existing file, then replace the body**

```markdown
Invoke the `editing-lincx-templates` skill's **refresh-schema** flow:

1. For each session-state entry with `mockAdsSource.kind` in {`zone-resolved`, `synthesized-fallback`}: re-call `mcp__claude_ai_Lincx__get_template_preview_bundle(templateId=entry.templateId)`, run the resolver script, merge the patch, surface warnings.
2. For entries with `kind` in {`zone`, `synthesized`}: only refresh the CAG via `mcp__claude_ai_Lincx__get_creative_asset_group(id=entry.creativeAssetGroupId)` and replace `cagSchema`. Do not touch `mockAds` or `mockAdsSource`.
3. Dispatch `node ${CLAUDE_PLUGIN_ROOT}/scripts/preview-render.mjs <entryId>` for each affected entry.
```

- [ ] **Step 2: Commit**

```bash
cd $MP && git add plugins/templates-editor-plugin/commands/lincx-template-refresh-schema.md && git commit -m "docs(plugin): /lincx-template-refresh-schema reflects bundle flow"
```

---

## Task 7: Golden transcript fixture for the new Flow A

**Files:**
- Create: `$PLUGIN/tests/transcripts/flow-a-bundle.md`

- [ ] **Step 1: Write the transcript**

Create `$PLUGIN/tests/transcripts/flow-a-bundle.md` modeling a real session. The transcript is documentation; it doesn't run as a test, but lives next to other transcripts as the source of truth for how the flow is supposed to look.

```markdown
# Flow A — bundle-driven preview (golden)

## Setup
- Authenticated. Network: acme. Template `tpl_x` exists. Zone `zn_B` serves `tpl_x` with 3 ads.

## Transcript

> /lincx-template-edit tpl_x

assistant: Where should I place the html and css?

user: ./templates/tpl_x.html and ./templates/tpl_x.css

assistant: [calls auth_status → ok]
assistant: [calls get_template_preview_bundle(templateId="tpl_x")]
assistant: [bundle returned: source="zone", chosenZoneId="zn_B", 3 mockAds]
assistant: [writes ./.lincx-session.bundle.json]
assistant: [runs resolve-zone-and-ads.mjs ./.lincx-session.bundle.json entry-1 ./templates/tpl_x.html ./templates/tpl_x.css .]
assistant: [merges patch via upsertEntry; deletes ./.lincx-session.bundle.json]
assistant: [runs preview-render.mjs entry-1; browser opens with 3 ad iterations]
assistant: Ready. Preview is open against zone zn_B (3 ads). What would you like to change?

## Variations

- **No zones bound** — bundle.source="synthesized", warnings=["No zones are bound..."]; assistant prints warning once, preview still opens.
- **Zone returns ads that fail CAG validation** — patch.mockAdsSource.kind="synthesized-fallback"; warning printed; preview opens with synthesized ads.
```

- [ ] **Step 2: Commit**

```bash
cd $MP && git add plugins/templates-editor-plugin/tests/transcripts/flow-a-bundle.md && git commit -m "docs(plugin): golden transcript for bundle-driven Flow A"
```

---

## Task 8: End-to-end manual smoke test

This is the only step that hits the real work API. It cannot be automated in this plan.

- [ ] **Step 1: Pick a real template id**

Use any existing template id from `mcp__claude_ai_Lincx__list_templates` that has at least one zone serving it. Note the id and the expected zone.

- [ ] **Step 2: Run the bundle tool against it**

In a Claude Code session with the Lincx MCP wired up:

```
mcp__claude_ai_Lincx__get_template_preview_bundle(templateId="<real_id>")
```

Confirm the response has `source:"zone"`, a non-null `chosenZoneId`, and a non-empty `mockAds` array. If `source:"synthesized"`, confirm the warning explains why.

- [ ] **Step 3: Run /lincx-template-edit end-to-end**

```
/lincx-template-edit <real_id>
```

Provide html/css paths under a fresh scratch directory. Confirm:
1. Files appear at the chosen paths.
2. `.lincx-session.json` has `mockAdsSource.kind:"zone-resolved"` (or whichever fallback fired).
3. `.lincx-session.bundle.json` was deleted.
4. Browser opens; the preview shows N iterations matching the ad count.
5. Editing the html re-renders silently within ~1 second.

- [ ] **Step 4: Commit a CHANGELOG entry**

Append to `$PLUGIN/README.md` (or create `$PLUGIN/CHANGELOG.md` if absent) a one-liner under a new dated section:

```markdown
## 2026-05-08
- Flow A now pulls real ads from the zone with the highest traffic that serves the template, falling back to CAG synthesis only when no zone is bound or the chosen zone is empty. Backed by the new `get_template_preview_bundle` MCP tool.
```

```bash
cd $MP && git add plugins/templates-editor-plugin/README.md && git commit -m "docs(plugin): changelog for bundle-driven preview"
```

---

## Self-Review Notes

- **Spec coverage:** every numbered section of the spec maps to at least one task — Architecture (Tasks 2–4), Components & Files (Tasks 2c, 3b, 4–7), Data Flow (Task 4 step 2 + Task 7 transcript), Failure Modes (Tasks 2b tests 3–6 + Task 3a test 3), Testing (Tasks 2a, 2b, 3a, 7), Open Items (Task 1).
- **Placeholder scan:** the only intentional `<placeholder>` is `<ZONES_PATH>` / `<ZONES_PATH_RE>` in Tasks 2b and 2c, both gated on Task 1's decision record. No other unresolved markers.
- **Type consistency:** `mockAdsSource.kind` enum (`zone-resolved | zone | synthesized | synthesized-fallback`) is used identically in the bundle return shape (Task 2c), the helper output (Task 3b), the SKILL.md schema (Task 4), and the refresh logic (Task 6). `resolveBundle` signature is identical in both the implementation (Task 3b) and the tests (Task 3a).
