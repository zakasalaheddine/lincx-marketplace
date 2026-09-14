# Campaign-performance dimension cheatsheet

This is a hint, not a contract. Report names and dimension spellings differ per network — always run the dimension check in `_shared/dimension-discovery.md` against the live catalog before using a report.

## What a campaign-performance report needs

| Question | Required dimensions |
|---|---|
| Daily performance of one or more campaigns (UTC days) | `campaign`, `date` |
| Same, in a local timezone | `campaign`, `date`, `hour` |
| Hour-of-day breakdown | `campaign`, `date`, `hour` |

Spellings above are typical; use whatever the report's `dimensions` array actually lists.

## Column order in the rendered table

`date | spend | impressions | clicks | conversions | ctr | ecpm`

Drop any missing column rather than synthesizing it.
