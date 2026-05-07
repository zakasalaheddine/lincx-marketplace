# Output template — the four-part contract

Every report response is exactly four parts in this order. No exceptions.

## 1. Headline (≤ 25 words, one sentence)

Lead with the most decision-relevant number for this report:

- Campaign performance → spend or conversions for the period; include WoW direction only if a prior range was queried.
- Revenue summary → total revenue and fill rate for the period.
- Creative anomalies → count of winners/losers, or the single biggest mover.

Always name the entity and the date range. No hedging adjectives ("solid", "decent", "healthy"). Numbers carry the verdict.

## 2. Narrative (2–4 sentences)

Explain the headline. Cite the one row or driver that matters most. If nothing notable, say so explicitly — do not pad. Never speculate on cause; the data does not support it.

## 3. Markdown table

- **Cap at 30 rows.** For longer series, collapse to daily aggregates or top-N + bottom-N as the sub-skill dictates.
- **Column order is fixed per report** — see each sub-skill's `references/` notes.
- **Number formatting:** currency `$1,234.56` (2 decimals); rates `12.3%`; counts with thousands separators (`1,234,567`); right-aligned.
- **Sort:** chronological for time-series; descending by primary metric for ranks; descending by `|delta_pct|` for anomalies.

## 4. Footer (one line, fixed format)

`Source: dimension set "<name>" (<id>) · range <YYYY-MM-DD> → <YYYY-MM-DD> · resolution <day|hour> · network <active_network>`

The footer makes every result auditable — a manager can hand the answer to an analyst and they can re-run it.

If the underlying MCP response was truncated, append a second footer line:

`Note: response truncated — values above may be incomplete. Narrow the range or breakdown to see full data.`

## Forbidden

- Emoji.
- First person ("I", "we").
- Filler: "based on the data", "the data shows", "as you can see".
- Charts (Claude Desktop renders inconsistently — we do not lie about output fidelity).
- Unsolicited "next steps" or recommendations. Reports answer; they do not prescribe.
