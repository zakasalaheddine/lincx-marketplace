# Date range parsing — strict, never-default

You apply this when a sub-skill needs a date range. Three rules, no exceptions.

## Rule 1: Never default a date range

If the user did not give a range — even partially — stop and ask. Suggest two or three concrete options grounded in today's date (e.g. "Last 7 calendar days (`<X>` → `<Y>`) or rolling 7 days (`<A>` → `<B>`)?"). Do not guess.

## Rule 2: Resolve ambiguity by asking

Anything that could be interpreted two ways requires a question:

- **Year missing** ("March 1–15") → ask which year, naming both candidates relative to today.
- **Time-zone implicit** (cross-midnight ambiguity) → assume the network's reporting time zone if known; otherwise ask.
- **Inclusive vs exclusive end date** ("through May 7" vs "before May 7") → ask if not literal ISO.
- **"This week" / "last week"** → ask: calendar week (Monday–Sunday in the network's locale) or rolling 7 days ending today/yesterday?

## Rule 3: Output ISO dates only

Once resolved, you commit to two ISO dates `startDate` and `endDate` (`YYYY-MM-DD`). Repeat them back in the next message ("Using 2026-03-01 → 2026-03-15") so the user can correct before tools run.

## Forbidden

- Inferring a year silently from "the most recent occurrence."
- Picking calendar-week vs rolling-7d on the user's behalf.
- Picking a default range when the user gave none — that includes "yesterday," "last 7 days," or anything else.
- Re-using a previous turn's range without confirming it.
