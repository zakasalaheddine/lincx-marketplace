# Campaign-performance dimension cheatsheet

This is a hint, not a contract. Always verify with `get_dimension_set` before using.

## Dimension sets the team has used for campaign perf

| Name (likely)        | Dimensions present (likely)        | Metrics present (likely)                                |
|----------------------|------------------------------------|---------------------------------------------------------|
| `campaign_daily`     | `date`, `campaign_id`              | `spend`, `impressions`, `clicks`, `conversions`, `ctr`, `ecpm` |
| `campaign_hourly`    | `hour`, `date`, `campaign_id`      | same as `campaign_daily`                                |

If the names differ on a given network, fall back to the dimension-discovery algorithm in `_shared/dimension-discovery.md`.

## Column order in the rendered table

`date | spend | impressions | clicks | conversions | ctr | ecpm`

Drop any missing column rather than synthesizing it.
