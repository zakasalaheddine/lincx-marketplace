# Flow A — bundle-driven preview (golden)

## Setup
- Authenticated. Network: acme. Template `tpl_x` exists. Zone `zn_B` serves `tpl_x` with 3 ads.

## Transcript

> /lincx-template-edit tpl_x

A: Where should I place the html and css?

user: ./templates/tpl_x.html and ./templates/tpl_x.css

A: [calls auth_status → ok]
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
